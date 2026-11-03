// The Cloudflare Worker: serves the API. (The React site is served from ./dist automatically.)
import { runAgent } from "./agent.js";
import { select } from "./snowflake.js";
import * as db from "./db.js";

export { FeedbackPipeline } from "./pipeline.js"; // the automation (Cloudflare Workflow)

const MAX_ITEMS = 300; // per batch, keeps the free AI quota safe

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    // Anyone can view the dashboard; anything that costs AI, Snowflake or email needs the demo passcode.
    if (request.method === "POST" && !passcodeOk(request, env)) {
      return json({ error: "Passcode required", needsPasscode: true }, 401);
    }
    try {
      if (route === "GET /api/dashboard") return json(await dashboard(env));
      if (route === "POST /api/uploads") return await upload(request, env);
      if (route === "POST /api/runs") return await rerun(request, env);
      if (request.method === "GET" && url.pathname.startsWith("/api/runs/")) return await runStatus(env, url.pathname.split("/").pop());
      if (route === "POST /api/notifications/read") {
        await db.markAllRead(env);
        return json({ ok: true });
      }
      if (route === "POST /api/analyze") return analyze(request, env, ctx);
      if (route === "GET /api/health") return health(env);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || "Server error" }, 500);
    }
    return json({ error: "Not found" }, 404);
  },
};

function passcodeOk(request, env) {
  if (!env.APP_PASSCODE) return true; // not set (local dev): open
  return request.headers.get("x-app-passcode") === env.APP_PASSCODE;
}

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;

// ---------- Automation trigger: a new upload ----------

async function upload(request, env) {
  const body = await request.json().catch(() => ({}));
  const rows = clean(body.rows);
  if (!rows.length) return json({ error: "No feedback to upload." }, 400);
  if (rows.length > MAX_ITEMS) return json({ error: `Max ${MAX_ITEMS} pieces of feedback per upload.` }, 400);

  // Feedback ids must be unique across uploads, or labels from last month get mixed up with this month.
  const [latest] = await db.latestUploads(env, 1);
  const taken = new Set((await db.loadRows(env, latest?.UPLOAD_ID)).map((r) => r.id));
  const uploadId = newId("up");
  for (const r of rows) {
    const base = r.id || "F";
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}~${n}`;
    taken.add(id);
    r.id = id;
  }

  const runId = newId("run");
  await env.PIPELINE.create({ id: runId, params: { runId, uploadId, fileName: String(body.fileName || "upload").slice(0, 200), rows } });
  return json({ uploadId, runId }, 202);
}

// Manual trigger: re-run the automation on an upload that's already in Snowflake.
async function rerun(request, env) {
  const { uploadId } = await request.json().catch(() => ({}));
  if (!uploadId) return json({ error: "uploadId is required" }, 400);
  const runId = newId("run");
  await env.PIPELINE.create({ id: runId, params: { runId, uploadId } });
  return json({ uploadId, runId }, 202);
}

// Where is this run? Combines the Workflow's status with what's saved in Snowflake.
async function runStatus(env, runId) {
  const [instance, run] = await Promise.all([
    env.PIPELINE.get(runId).then((i) => i.status()).catch(() => null),
    db.getRun(env, runId),
  ]);
  const workflow = instance?.status || "unknown";
  let stage = run?.STATUS || "saving_raw";
  if (workflow === "errored") stage = "failed";
  return json({
    runId,
    workflow,
    stage, // saving_raw → analyzing → notifying → done | failed
    error: run?.ERROR || (workflow === "errored" ? instance?.error?.message || "The automation failed." : null),
    progress: run?.REPORT?.progress || run?.REPORT?.steps || [],
  });
}

// ---------- Dashboard data (all from Snowflake) ----------

async function dashboard(env) {
  const [uploads, notifications] = await Promise.all([db.latestUploads(env, 2), db.listNotifications(env)]);
  const [cur, prev] = uploads;
  if (!cur) return { empty: true, notifications };

  const [current, previous, report, lastRun] = await Promise.all([
    db.loadRows(env, cur.UPLOAD_ID),
    db.loadRows(env, prev?.UPLOAD_ID),
    db.latestReport(env, cur.UPLOAD_ID),
    select(env, "SELECT RUN_ID, STATUS FROM AGENT_RUNS WHERE UPLOAD_ID = ? ORDER BY CREATED_AT DESC LIMIT 1", [cur.UPLOAD_ID]),
  ]);
  return {
    empty: false,
    currentUpload: { id: cur.UPLOAD_ID, fileName: cur.FILE_NAME, uploadedAt: cur.UPLOADED_AT },
    previousUpload: prev ? { id: prev.UPLOAD_ID, fileName: prev.FILE_NAME, uploadedAt: prev.UPLOADED_AT } : null,
    current,
    previous,
    report,
    lastRun: lastRun[0] ? { runId: lastRun[0].RUN_ID, stage: lastRun[0].STATUS } : null,
    notifications,
  };
}

// ---------- Direct agent run (nothing saved): used by scripts/run_agent.mjs for grading ----------

// Runs the agent and streams progress back as one JSON object per line.
// The last line is the finished report.
async function analyze(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON: { current: [...], previous: [...] }" }, 400);
  }
  const current = clean(body.current);
  const previous = clean(body.previous);
  if (!current.length) return json({ error: "No feedback to analyze." }, 400);
  if (current.length > MAX_ITEMS || previous.length > MAX_ITEMS) {
    return json({ error: `Max ${MAX_ITEMS} pieces of feedback per batch.` }, 400);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = (obj) => writer.write(new TextEncoder().encode(JSON.stringify(obj) + "\n"));

  const work = (async () => {
    try {
      const report = await runAgent(env, { current, previous }, (step) => send({ type: "step", ...step }));
      await send({ type: "report", report });
    } catch (err) {
      console.error(err);
      await send({ type: "error", error: err.message || "The agent failed." });
    } finally {
      await writer.close();
    }
  })();
  ctx.waitUntil(work); // keep the Worker alive until the agent finishes

  return new Response(readable, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}

// Checks the Snowflake login works and the tables exist.
async function health(env) {
  try {
    const [who] = await select(env, "SELECT CURRENT_USER() AS USER_NAME, CURRENT_ROLE() AS ROLE_NAME, CURRENT_DATABASE() AS DB");
    const tables = await select(env,
      "SELECT TABLE_NAME FROM FEEDBACK_INSIGHTS.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'APP' ORDER BY TABLE_NAME");
    return json({ snowflake: "connected", ...who, tables: tables.map((t) => t.TABLE_NAME) });
  } catch (err) {
    return json({ snowflake: "error", detail: err.message }, 502);
  }
}

// Keep only the fields we need, with sane types and lengths.
function clean(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.text === "string" && r.text.trim())
    .map((r) => ({
      id: String(r.id ?? "").slice(0, 40),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date ?? "")) ? String(r.date) : "",
      source: String(r.source ?? "unknown").slice(0, 40),
      text: r.text.trim().slice(0, 2000),
      stars: Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 5 ? r.stars : null,
    }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
