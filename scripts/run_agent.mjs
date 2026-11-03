// Runs the agent on the two demo CSVs (nothing is saved to Snowflake) and saves the report to a file.
// Usage: npm run api  (in another terminal), then:  node scripts/run_agent.mjs [output.json]
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "../src/feedback.js";

const API = process.env.API || "http://127.0.0.1:8787";
// The live site needs the demo passcode (read from the private file, never printed).
const PASSCODE = (() => { try { return readFileSync(new URL("../secrets/app_passcode.txt", import.meta.url), "utf8").trim(); } catch { return ""; } })();
const out = process.argv[2] || "agent_report.json";
const previous = parseCsv(readFileSync(new URL("../data/quickbite_batch1_sep2026.csv", import.meta.url), "utf8"));
// CURRENT=path/to.csv swaps in a different "this month" file (used for the manipulation test).
const current = parseCsv(readFileSync(process.env.CURRENT || new URL("../data/quickbite_batch2_oct2026.csv", import.meta.url), "utf8"));

const res = await fetch(`${API}/api/analyze`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-app-passcode": PASSCODE },
  body: JSON.stringify({ current, previous }),
});
if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

let buffer = "";
const decoder = new TextDecoder();
for await (const chunk of res.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines.filter(Boolean)) {
    const msg = JSON.parse(line);
    if (msg.type === "step") console.log(`${msg.status === "done" ? "✓" : "…"} ${msg.text}`);
    if (msg.type === "error") throw new Error(msg.error);
    if (msg.type === "report") {
      writeFileSync(out, JSON.stringify(msg.report, null, 2));
      console.log(`\nSaved report to ${out}`);
    }
  }
}
