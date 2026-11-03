// Triggers the automation by uploading a CSV, then follows the run until it finishes.
// Usage (with `npm run api` running):  node scripts/upload.mjs data/quickbite_batch1_sep2026.csv
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv } from "../src/feedback.js";

const API = process.env.API || "http://127.0.0.1:8787";
// The live site needs the demo passcode (read from the private file, never printed).
const PASSCODE = (() => { try { return readFileSync(new URL("../secrets/app_passcode.txt", import.meta.url), "utf8").trim(); } catch { return ""; } })();
const file = process.argv[2];
if (!file) throw new Error("Pass a CSV file path.");
const rows = parseCsv(readFileSync(file, "utf8"));

const res = await fetch(`${API}/api/uploads`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-app-passcode": PASSCODE },
  body: JSON.stringify({ fileName: basename(file), rows }),
});
const started = await res.json();
if (!res.ok) throw new Error(started.error);
console.log(`Uploaded ${rows.length} rows → upload ${started.uploadId}, run ${started.runId}`);

let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await (await fetch(`${API}/api/runs/${started.runId}`)).json();
  const line = `${s.stage} (workflow: ${s.workflow})${s.progress.length ? " | " + s.progress.at(-1).text : ""}`;
  if (line !== last) console.log(line);
  last = line;
  if (s.stage === "done") break;
  if (s.stage === "failed") {
    console.log("FAILED:", s.error);
    process.exit(1);
  }
}
