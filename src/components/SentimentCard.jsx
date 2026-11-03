// Sentiment from star ratings: this month vs last month.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { sentimentCompare } from "../feedback.js";

function SentimentTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      {payload.map((p) => <div key={p.dataKey}>{p.name}: {p.value}</div>)}
    </div>
  );
}

export default function SentimentCard({ current, previous, thisLabel, lastLabel }) {
  const data = sentimentCompare(current, previous).map((d) => ({ ...d, bucket: d.bucket.replace(/ \(.*\)/, "") }));
  return (
    <div className="card chart-card">
      <div className="card-head">
        <h2>Sentiment</h2>
        <span className="muted">by star rating</span>
      </div>
      <div className="chart-box" style={{ height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="bucket" tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip content={<SentimentTooltip />} cursor={{ fill: "var(--hover)" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Bar dataKey="lastMonth" name={lastLabel} fill="var(--series-prior)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="thisMonth" name={thisLabel} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="footnote">ⓘ Stars can mislead: sarcastic reviews often give 5★. The AI theme column in the table reads the text instead.</p>
    </div>
  );
}
