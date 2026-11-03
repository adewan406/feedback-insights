// One number + how it changed vs last month (Calendly-style card).
// good = "up" | "down" | undefined (undefined means a change is neither good nor bad).
export default function StatCard({ title, value, prev, format, formatDiff = format, hint, good }) {
  if (value === null || value === undefined) {
    return (
      <div className="card stat-card">
        <p className="stat-title">{title}</p>
        <p className="stat-value">—</p>
        <p className="stat-sub">No data</p>
      </div>
    );
  }
  const diff = prev === null || prev === undefined ? null : value - prev;
  let tone = "neutral";
  if (diff && good) tone = (diff > 0) === (good === "up") ? "good" : "bad";
  const arrow = !diff ? "→" : diff > 0 ? "↑" : "↓";

  return (
    <div className="card stat-card">
      <p className="stat-title">{title}</p>
      <p className="stat-value">{format(value)}</p>
      {diff === null ? (
        <p className="stat-sub">{hint || "No prior batch"}</p>
      ) : (
        <p className="stat-sub">
          <span className={`delta delta-${tone}`}>
            {arrow} {diff === 0 ? "no change" : formatDiff(Math.abs(diff))}
          </span>{" "}
          vs last month ({format(prev)})
          {hint && <span className="stat-hint">{hint}</span>}
        </p>
      )}
    </div>
  );
}
