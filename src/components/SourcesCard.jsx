// Where this month's feedback came from (Calendly "Page Traffic" style rows).
import { countBy, sourceLabel } from "../feedback.js";

export default function SourcesCard({ rows }) {
  const data = countBy(rows, "source");
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="card chart-card">
      <div className="card-head">
        <h2>Sources</h2>
        <span className="muted">this month</span>
      </div>
      <ul className="bar-list">
        {data.map((d) => (
          <li key={d.name} title={`${sourceLabel(d.name)}: ${d.value}`}>
            <span className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
            <span className="bar-name">{sourceLabel(d.name)}</span>
            <span className="bar-value">{d.value}</span>
          </li>
        ))}
        {!data.length && <li className="muted">No feedback</li>}
      </ul>
    </div>
  );
}
