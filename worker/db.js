// Every read and write the app does in Snowflake, in one place.
import { query, select } from "./snowflake.js";

// ---------- Uploads + raw feedback (automation step 1) ----------

export async function saveUpload(env, { uploadId, fileName, rows }) {
  // Safe to retry: clear anything a failed earlier attempt left behind.
  await query(env, "DELETE FROM FEEDBACK_RAW WHERE UPLOAD_ID = ?", [uploadId]);
  await query(env, "DELETE FROM UPLOADS WHERE UPLOAD_ID = ?", [uploadId]);
  await query(env, "INSERT INTO UPLOADS (UPLOAD_ID, FILE_NAME, ITEM_COUNT) VALUES (?, ?, ?)", [uploadId, fileName, rows.length]);
  await query(
    env,
    "INSERT INTO FEEDBACK_RAW (UPLOAD_ID, FEEDBACK_ID, FEEDBACK_DATE, SOURCE, TEXT, STARS) VALUES (?, ?, ?, ?, ?, ?)",
    rows.map((r) => [uploadId, r.id, r.date || null, r.source, r.text, r.stars]),
  );
}

// The upload that came right before this one (null for the very first upload).
export async function previousUploadId(env, uploadId) {
  const rows = await select(
    env,
    `SELECT UPLOAD_ID FROM UPLOADS
     WHERE UPLOADED_AT < (SELECT UPLOADED_AT FROM UPLOADS WHERE UPLOAD_ID = ?)
     ORDER BY UPLOADED_AT DESC LIMIT 1`,
    [uploadId],
  );
  return rows[0]?.UPLOAD_ID || null;
}

export async function loadRows(env, uploadId) {
  if (!uploadId) return [];
  const rows = await select(
    env,
    `SELECT FEEDBACK_ID, TO_VARCHAR(FEEDBACK_DATE, 'YYYY-MM-DD') AS FEEDBACK_DATE, SOURCE, TEXT, STARS
     FROM FEEDBACK_RAW WHERE UPLOAD_ID = ? ORDER BY FEEDBACK_DATE, FEEDBACK_ID`,
    [uploadId],
  );
  return rows.map((r) => ({
    id: r.FEEDBACK_ID,
    date: r.FEEDBACK_DATE || "",
    source: r.SOURCE,
    text: r.TEXT,
    stars: r.STARS === null ? null : Number(r.STARS),
  }));
}

export async function latestUploads(env, limit = 2) {
  return select(
    env,
    `SELECT UPLOAD_ID, FILE_NAME, ITEM_COUNT, TO_VARCHAR(UPLOADED_AT, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS UPLOADED_AT
     FROM UPLOADS ORDER BY UPLOADED_AT DESC LIMIT ${Number(limit)}`,
  );
}

// ---------- Agent runs (automation step 2) ----------

export async function createRun(env, { runId, uploadId, previousUploadId }) {
  await query(env, "DELETE FROM AGENT_RUNS WHERE RUN_ID = ?", [runId]);
  await query(env, "INSERT INTO AGENT_RUNS (RUN_ID, UPLOAD_ID, PREVIOUS_UPLOAD_ID, STATUS) VALUES (?, ?, ?, 'analyzing')", [
    runId, uploadId, previousUploadId,
  ]);
}

// Live progress: the agent's steps so far, stored in REPORT until the real report replaces it.
export async function saveProgress(env, runId, steps) {
  await query(env, "UPDATE AGENT_RUNS SET REPORT = PARSE_JSON(?) WHERE RUN_ID = ? AND STATUS = 'analyzing'", [
    JSON.stringify({ progress: steps }), runId,
  ]);
}

// Runs started today (Snowflake account time zone), for the daily cap.
export async function runsToday(env) {
  const [row] = await select(env, "SELECT COUNT(*) AS N FROM AGENT_RUNS WHERE CREATED_AT >= DATE_TRUNC('day', CURRENT_TIMESTAMP())");
  return Number(row.N);
}

export async function setRunStatus(env, runId, status, error = null) {
  await query(env, "UPDATE AGENT_RUNS SET STATUS = ?, ERROR = ? WHERE RUN_ID = ?", [status, error, runId]);
}

export async function saveResults(env, { runId, uploadId, previousUploadId, report }) {
  await query(env, "UPDATE AGENT_RUNS SET STATUS = 'notifying', MODEL = ?, SECONDS = ?, REPORT = PARSE_JSON(?) WHERE RUN_ID = ?", [
    report.model, report.seconds, JSON.stringify(report), runId,
  ]);
  await query(env, "DELETE FROM FEEDBACK_LABELS WHERE RUN_ID = ?", [runId]);
  const uploadOf = (id) => (report.currentIds.includes(id) ? uploadId : previousUploadId);
  const labelRows = Object.entries(report.labels).map(([id, l]) => [runId, uploadOf(id), id, l.theme, l.sentiment]);
  if (labelRows.length) {
    await query(env, "INSERT INTO FEEDBACK_LABELS (RUN_ID, UPLOAD_ID, FEEDBACK_ID, THEME, SENTIMENT) VALUES (?, ?, ?, ?, ?)", labelRows);
  }
}

export async function getRun(env, runId) {
  const [run] = await select(
    env,
    `SELECT RUN_ID, UPLOAD_ID, PREVIOUS_UPLOAD_ID, STATUS, ERROR, REPORT,
            TO_VARCHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS CREATED_AT
     FROM AGENT_RUNS WHERE RUN_ID = ?`,
    [runId],
  );
  return run ? { ...run, REPORT: run.REPORT ? JSON.parse(run.REPORT) : null } : null;
}

// The newest finished report for an upload.
export async function latestReport(env, uploadId) {
  const [run] = await select(
    env,
    `SELECT RUN_ID, REPORT FROM AGENT_RUNS WHERE UPLOAD_ID = ? AND STATUS = 'done'
     ORDER BY CREATED_AT DESC LIMIT 1`,
    [uploadId],
  );
  return run ? { runId: run.RUN_ID, ...JSON.parse(run.REPORT) } : null;
}

// What a later run can reuse: last time's themes and the labels for that upload's feedback.
export async function reusableLabels(env, uploadId) {
  const report = await latestReport(env, uploadId);
  if (!report) return null;
  const rows = await select(env, "SELECT FEEDBACK_ID, THEME, SENTIMENT FROM FEEDBACK_LABELS WHERE RUN_ID = ? AND UPLOAD_ID = ?", [
    report.runId, uploadId,
  ]);
  if (!rows.length) return null;
  return {
    themes: report.themes.map(({ id, name, description }) => ({ id, name, description })),
    labels: Object.fromEntries(rows.map((r) => [r.FEEDBACK_ID, { theme: r.THEME, sentiment: r.SENTIMENT }])),
  };
}

// ---------- Notifications (automation step 3) ----------

export async function addNotifications(env, runId, items) {
  await query(env, "DELETE FROM NOTIFICATIONS WHERE RUN_ID = ?", [runId]); // safe to retry
  if (!items.length) return;
  await query(
    env,
    "INSERT INTO NOTIFICATIONS (NOTIFICATION_ID, LEVEL, TITLE, BODY, RUN_ID) VALUES (?, ?, ?, ?, ?)",
    items.map((n, i) => [`${runId}-${i + 1}`, n.level, n.title, n.body, runId]),
  );
}

export async function listNotifications(env, limit = 20) {
  const rows = await select(
    env,
    `SELECT NOTIFICATION_ID, LEVEL, TITLE, BODY, RUN_ID, IS_READ,
            TO_VARCHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS CREATED_AT
     FROM NOTIFICATIONS ORDER BY CREATED_AT DESC, NOTIFICATION_ID LIMIT ${Number(limit)}`,
  );
  return rows.map((n) => ({
    id: n.NOTIFICATION_ID, level: n.LEVEL, title: n.TITLE, body: n.BODY, runId: n.RUN_ID,
    read: n.IS_READ === "true", createdAt: n.CREATED_AT,
  }));
}

export async function markAllRead(env) {
  await query(env, "UPDATE NOTIFICATIONS SET IS_READ = TRUE WHERE IS_READ = FALSE");
}
