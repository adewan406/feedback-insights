// Re-runs the automation on the newest upload in Snowflake (same as the Re-run button), and follows it.
// Usage: API=https://feedback-insights.snowflake-site.workers.dev node scripts/rerun.mjs
import { readFileSync } from "node:fs";

const API = process.env.API || "http://127.0.0.1:8787";
// The live site needs the demo passcode (read from the private file, never printed).
const PASSCODE = (() => { try { return readFileSync(new URL("../secrets/app_passcode.txt", import.meta.url), "utf8").trim(); } catch { return ""; } })();

const { currentUpload } = await (await fetch(`${API}/api/dashboard`)).json();
if (!currentUpload) throw new Error("Nothing uploaded yet.");
const res = await fetch(`${API}/api/runs`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-app-passcode": PASSCODE },
  body: JSON.stringify({ uploadId: currentUpload.id }),
});
const started = await res.json();
if (!res.ok) throw new Error(started.error);
console.log(`Re-running ${currentUpload.fileName} → run ${started.runId}`);

let last = "";
for (const t0 = Date.now(); ; ) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await (await fetch(`${API}/api/runs/${started.runId}`)).json();
  const line = `${s.stage} (workflow: ${s.workflow})${s.progress.length ? " | " + s.progress.at(-1).text : ""}`;
  if (line !== last) console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${line}`);
  last = line;
  if (s.stage === "done") break;
  if (s.stage === "failed") {
    console.log("FAILED:", s.error);
    process.exit(1);
  }
}
