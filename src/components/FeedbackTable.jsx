import { useState } from "react";
import { sourceLabel, shortDate } from "../feedback.js";

export default function FeedbackTable({ rows, labels, themeNames }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const q = query.toLowerCase();
  const matches = rows
    .filter((r) => !q || r.text.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const visible = showAll ? matches : matches.slice(0, 10);

  return (
    <section className="card table-card" id="feedback">
      <div className="card-head">
        <h2>All feedback <span className="muted">({matches.length})</span></h2>
        <input className="search" placeholder="Search feedback…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>ID</th><th>Date</th><th>Source</th><th>Stars</th>{labels && <th>AI theme</th>}<th>Feedback</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                <td className="nowrap">{r.date ? shortDate(r.date) : "—"}</td>
                <td className="nowrap">{sourceLabel(r.source)}</td>
                <td className="nowrap">{r.stars === null ? "—" : "★".repeat(r.stars)}</td>
                {labels && (
                  <td className="nowrap">
                    {labels[r.id] ? (
                      <>
                        <span className={`dot dot-${labels[r.id].sentiment}`} title={`AI sentiment: ${labels[r.id].sentiment}`} />
                        {themeNames[labels[r.id].theme] || labels[r.id].theme}
                      </>
                    ) : "—"}
                  </td>
                )}
                <td>{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matches.length > 10 && (
        <button className="btn btn-ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show less" : `Show all ${matches.length}`}
        </button>
      )}
    </section>
  );
}
