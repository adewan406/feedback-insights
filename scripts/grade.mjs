// Grades an agent report against data/answer_key.json.
// Usage: node scripts/grade.mjs results/agent_report_run1.json
//
// The agent invents its own theme names, so we first match each agent theme to the
// answer-key theme it overlaps with most (by which feedback ids it labeled).
import { readFileSync } from "node:fs";

const key = JSON.parse(readFileSync(new URL("../data/answer_key.json", import.meta.url), "utf8"));
const report = JSON.parse(readFileSync(process.argv[2] || "results/agent_report_run1.json", "utf8"));

// 1. Map agent theme -> answer-key theme (majority vote over shared ids).
const votes = {};
for (const [id, label] of Object.entries(report.labels)) {
  const truth = key.labels[id];
  if (!truth) continue;
  votes[label.theme] ??= {};
  votes[label.theme][truth] = (votes[label.theme][truth] || 0) + 1;
}
const mapTo = {};
for (const [agentTheme, v] of Object.entries(votes)) {
  mapTo[agentTheme] = Object.entries(v).sort((a, b) => b[1] - a[1])[0][0];
}

// 2. Label accuracy: is each review in a theme that maps to its true theme?
const ids = Object.keys(key.labels);
const correct = ids.filter((id) => mapTo[report.labels[id]?.theme] === key.labels[id]);
const wrong = ids.filter((id) => !correct.includes(id));

// 3. The big checks.
const top3 = report.priorities.map((p) => mapTo[p.theme] || `(${p.theme})`);
const want = new Set(key.top3_this_month);
const top3Hits = top3.filter((t) => want.has(t)).length;
const urgentIds = report.urgent.map((u) => u.id);
const newTheme = report.themes.find((t) => mapTo[t.id] === key.new_problem);
const improved = key.improved.map((k) => report.themes.find((t) => mapTo[t.id] === k)?.trend === "improving");
const tricky = key.tricky_cases.filter((t) => mapTo[report.labels[t.id]?.theme] === t.true_theme).length;

const checks = [
  ["Top 3 this month matches answer key", top3Hits === 3, `${top3Hits}/3 → ${top3.join(", ")}`],
  ["Allergy item flagged urgent", urgentIds.includes(key.urgent_flag.id), urgentIds.join(", ") || "none"],
  ["No false urgent flags", urgentIds.every((id) => id === key.urgent_flag.id), urgentIds.filter((id) => id !== key.urgent_flag.id).join(", ") || "none"],
  ["New problem detected (rating screen bug)", newTheme?.trend === "new", newTheme ? `${newTheme.name}: ${newTheme.lastMonth} → ${newTheme.thisMonth}, ${newTheme.trend}` : "not found"],
  ["Improvements detected (tracking, promos)", improved.every(Boolean), improved.map((ok, i) => `${key.improved[i]}=${ok ? "improving" : "missed"}`).join(", ")],
  ["Label accuracy ≥ 80%", correct.length / ids.length >= 0.8, `${correct.length}/${ids.length} (${Math.round((100 * correct.length) / ids.length)}%)`],
  ["Tricky cases labeled right ≥ 70%", tricky / key.tricky_cases.length >= 0.7, `${tricky}/${key.tricky_cases.length}`],
];

console.log("\nTheme mapping (agent → answer key):");
for (const t of report.themes) console.log(`  ${t.name.padEnd(36)} → ${mapTo[t.id] || "(no reviews)"}`);
console.log("\nResults:");
for (const [name, ok, detail] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(42)} ${detail}`);
console.log(`\nScore: ${checks.filter((c) => c[1]).length}/${checks.length} checks passed`);
if (process.argv.includes("--wrong")) {
  console.log("\nMislabeled:");
  for (const id of wrong) console.log(`  ${id} truth=${key.labels[id]} agent=${report.labels[id]?.theme}`);
}
