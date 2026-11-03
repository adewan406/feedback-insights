// Top themes the agent found: this month's count, last month's count, and the trend.
import { TrendBadge } from "./ReportPanel.jsx";

export default function ThemesCard({ report }) {
  if (!report) {
    return (
      <div className="card chart-card">
        <div className="card-head"><h2>Top themes</h2></div>
        <p className="muted">Run the AI report to group feedback into themes.</p>
      </div>
    );
  }
  const themes = report.themes.filter((t) => t.thisMonth || t.lastMonth).sort((a, b) => b.thisMonth - a.thisMonth);
  const max = Math.max(1, ...themes.map((t) => Math.max(t.thisMonth, t.lastMonth)));
  return (
    <div className="card chart-card">
      <div className="card-head">
        <h2>Top themes</h2>
        <span className="muted">this month (last month)</span>
      </div>
      <ul className="bar-list">
        {themes.map((t) => (
          <li key={t.id} title={`${t.name}: ${t.thisMonth} this month, ${t.lastMonth} last month`}>
            <span className="bar-fill" style={{ width: `${(t.thisMonth / max) * 100}%` }} />
            <span className="bar-name">{t.name}</span>
            <span className="bar-value">
              {t.id !== "praise" && t.id !== "other" && <TrendBadge trend={t.trend} />} {t.thisMonth}
              <span className="muted"> ({t.lastMonth})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
