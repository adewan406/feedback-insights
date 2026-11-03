// WHOOP-style: one plain-English insight sentence above the trend chart.
// The AI agent writes this sentence; before a report exists it's simple math.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { weeklyRating } from "../feedback.js";

function insight(now, before, thisLabel, lastLabel) {
  if (now.avgStars === null) return "Not enough rated feedback to spot a trend yet.";
  if (before.avgStars === null) return `${thisLabel} feedback averages ${now.avgStars.toFixed(2)} stars.`;
  const diff = now.avgStars - before.avgStars;
  const dir = Math.abs(diff) < 0.05 ? "about the same as" : diff < 0 ? "below" : "above";
  return `${thisLabel}'s average rating is ${now.avgStars.toFixed(2)}★. This is ${dir} ${lastLabel} (${before.avgStars.toFixed(2)}★).`;
}

function WeekTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tooltip">
      <strong>Week of {p.label}</strong>
      <div>{p.avg.toFixed(2)}★ average · {p.count} rated</div>
    </div>
  );
}

export default function TrendCard({ rows, now, before, thisLabel, lastLabel, aiInsight }) {
  const data = weeklyRating(rows);
  return (
    <div className="card chart-card">
      <div className="card-head">
        <h2>Rating trend</h2>
        <span className="muted">Weekly average · {before.count ? `${lastLabel} – ${thisLabel}` : thisLabel}</span>
      </div>
      {aiInsight ? (
        <p className="insight"><span className="ai-tag">✦ AI insight</span>{aiInsight}</p>
      ) : (
        <p className="insight">{insight(now, before, thisLabel, lastLabel)}</p>
      )}
      <div className="chart-box" style={{ height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            {before.avgStars !== null && (
              <ReferenceLine y={before.avgStars} stroke="var(--text-muted)" strokeDasharray="4 4"
                label={{ value: `${lastLabel} avg`, position: "insideTopRight", fill: "var(--text-muted)", fontSize: 11 }} />
            )}
            <Tooltip content={<WeekTooltip />} cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }} />
            <Line type="linear" dataKey="avg" isAnimationActive={false} stroke="var(--series-1)" strokeWidth={2}
              dot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: "var(--surface)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
