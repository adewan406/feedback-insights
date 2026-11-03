// Everything about turning raw feedback into numbers. No React in here.
import Papa from "papaparse";

// ---------- Reading feedback in ----------

// e.g. "P7K2" — so feedback ids from different uploads never collide.
const batchPrefix = (letter) => letter + Date.now().toString(36).slice(-4).toUpperCase();

// Accepts CSVs with slightly different column names (e.g. "rating" vs "star_rating").
const COLUMN_ALIASES = {
  id: ["id"],
  date: ["date", "created_at", "timestamp"],
  source: ["source", "channel"],
  text: ["text", "feedback", "review", "message", "comment"],
  stars: ["star_rating", "stars", "rating", "score"],
};

function pick(row, names) {
  for (const n of names) if (row[n] !== undefined && row[n] !== "") return row[n];
  return "";
}

export function parseCsv(csvText, idPrefix = batchPrefix("U")) {
  const { data } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return data
    .map((row, i) => toFeedback({
      id: pick(row, COLUMN_ALIASES.id) || `${idPrefix}-${String(i + 1).padStart(3, "0")}`,
      date: pick(row, COLUMN_ALIASES.date),
      source: pick(row, COLUMN_ALIASES.source),
      text: pick(row, COLUMN_ALIASES.text),
      stars: pick(row, COLUMN_ALIASES.stars),
    }))
    .filter((f) => f.text);
}

// Pasted text: one piece of feedback per line, dated today.
export function parsePasted(text, idPrefix = batchPrefix("P")) {
  const today = new Date().toISOString().slice(0, 10);
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => toFeedback({ id: `${idPrefix}-${String(i + 1).padStart(3, "0")}`, date: today, source: "pasted", text: line, stars: "" }));
}

function toFeedback({ id, date, source, text, stars }) {
  const n = Number(stars);
  return {
    id: String(id),
    date: String(date).slice(0, 10),
    source: (source || "unknown").toLowerCase().replace(/\s+/g, "_"),
    text: String(text).trim(),
    stars: stars === "" || Number.isNaN(n) ? null : n,
  };
}

// ---------- Summary numbers ----------

export function summarize(rows) {
  const rated = rows.filter((r) => r.stars !== null);
  const avg = rated.length ? rated.reduce((s, r) => s + r.stars, 0) / rated.length : null;
  return {
    count: rows.length,
    avgStars: avg,
    negativeShare: rated.length ? rated.filter((r) => r.stars <= 2).length / rated.length : null,
    supportCount: rows.filter((r) => r.source === "support").length,
  };
}

// Star ratings grouped into simple sentiment buckets.
export const SENTIMENT_BUCKETS = [
  { key: "negative", label: "Negative (1–2★)", test: (s) => s !== null && s <= 2 },
  { key: "neutral", label: "Neutral (3★)", test: (s) => s === 3 },
  { key: "positive", label: "Positive (4–5★)", test: (s) => s !== null && s >= 4 },
  { key: "unrated", label: "No rating", test: (s) => s === null },
];

export function sentimentCompare(current, previous) {
  return SENTIMENT_BUCKETS.map((b) => ({
    bucket: b.label,
    thisMonth: current.filter((r) => b.test(r.stars)).length,
    lastMonth: previous.filter((r) => b.test(r.stars)).length,
  }));
}

// Average star rating per week (weeks start on Monday), across both batches.
export function weeklyRating(rows) {
  const weeks = new Map();
  for (const r of rows) {
    if (r.stars === null || !r.date) continue;
    const d = new Date(r.date + "T00:00:00");
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back up to Monday
    const key = d.toISOString().slice(0, 10);
    const w = weeks.get(key) || { sum: 0, n: 0 };
    w.sum += r.stars;
    w.n += 1;
    weeks.set(key, w);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, w]) => ({ week, label: shortDate(week), avg: +(w.sum / w.n).toFixed(2), count: w.n }));
}

export function countBy(rows, field) {
  const counts = {};
  for (const r of rows) counts[r[field]] = (counts[r[field]] || 0) + 1;
  return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// ---------- Formatting ----------

export function shortDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const SOURCE_LABELS = {
  app_store: "App Store",
  google_play: "Google Play",
  survey: "Survey",
  support: "Support ticket",
  pasted: "Pasted",
};

export const sourceLabel = (s) => SOURCE_LABELS[s] || s.replace(/_/g, " ");
