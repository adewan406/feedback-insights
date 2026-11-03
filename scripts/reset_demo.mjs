// Demo-day reset: keeps ONLY the oldest upload (September) and its finished report in Snowflake,
// and deletes every later upload, run, label and notification, so October can be uploaded fresh on stage.
// Usage: node scripts/reset_demo.mjs          (shows what would be deleted)
//        node scripts/reset_demo.mjs --yes    (actually deletes)
import { readFileSync } from "node:fs";
import { query, select } from "../worker/snowflake.js";

const vars = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "")).vars;
const key = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/SNOWFLAKE_PRIVATE_KEY="(.*)"/)[1];
const env = { ...vars, SNOWFLAKE_PRIVATE_KEY: key };

const uploads = await select(env, "SELECT UPLOAD_ID, FILE_NAME FROM UPLOADS ORDER BY UPLOADED_AT");
if (!uploads.length) throw new Error("Snowflake has no uploads. Use “Load demo data” on the site instead.");
const [keep, ...drop] = uploads;
const keepRun = (await select(env,
  "SELECT RUN_ID FROM AGENT_RUNS WHERE UPLOAD_ID = ? AND STATUS = 'done' ORDER BY CREATED_AT DESC LIMIT 1", [keep.UPLOAD_ID]))[0];
if (!keepRun) throw new Error(`${keep.FILE_NAME} has no finished report. Re-run it on the site first.`);

console.log(`Keep: ${keep.FILE_NAME} with its latest report (${keepRun.RUN_ID})`);
console.log(`Delete: ${drop.map((u) => u.FILE_NAME).join(", ") || "no other uploads"}, older ${keep.FILE_NAME} runs, and all notifications`);
if (!process.argv.includes("--yes")) {
  console.log("\nNothing deleted. Add --yes to do it.");
  process.exit(0);
}

for (const u of drop) {
  await query(env, "DELETE FROM FEEDBACK_LABELS WHERE UPLOAD_ID = ?", [u.UPLOAD_ID]);
  await query(env, "DELETE FROM AGENT_RUNS WHERE UPLOAD_ID = ?", [u.UPLOAD_ID]);
  await query(env, "DELETE FROM FEEDBACK_RAW WHERE UPLOAD_ID = ?", [u.UPLOAD_ID]);
  await query(env, "DELETE FROM UPLOADS WHERE UPLOAD_ID = ?", [u.UPLOAD_ID]);
}
await query(env, "DELETE FROM FEEDBACK_LABELS WHERE UPLOAD_ID = ? AND RUN_ID <> ?", [keep.UPLOAD_ID, keepRun.RUN_ID]);
await query(env, "DELETE FROM AGENT_RUNS WHERE UPLOAD_ID = ? AND RUN_ID <> ?", [keep.UPLOAD_ID, keepRun.RUN_ID]);
await query(env, "DELETE FROM NOTIFICATIONS");
console.log("Done. The site now shows only September; upload October during the demo.");
