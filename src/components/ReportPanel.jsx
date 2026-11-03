// Base44-style AI report panel: the automation's progress while it runs, the report when done.

const TREND_LABEL = { new: "New", worsening: "Worse", stable: "Steady", improving: "Better" };

// The automation's steps, in order, and which run stage each one belongs to.
const PIPELINE = [
  { key: "saving_raw", text: "Save raw feedback to Snowflake" },
  { key: "analyzing", text: "Insights Agent analyzes it" },
  { key: "saving", text: "Save report + labels to Snowflake" },
  { key: "notifying", text: "Notify the team" },
];
const STAGE_INDEX = { saving_raw: 0, analyzing: 1, notifying: 3, done: 4 };

function Steps({ steps }) {
  // One line per step: the latest status of each.
  const latest = new Map();
  for (const s of steps) latest.set(s.step, s);
  return (
    <ol className="steps">
      {[...latest.values()].map((s) => (
        <li key={s.step} className={`step step-${s.status}`}>
          <span className="step-icon" aria-hidden="true">{s.status === "done" ? "✓" : "◌"}</span>
          <span>
            {s.text}
            {s.detail && <span className="step-detail">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Pipeline({ run }) {
  const failed = run.stage === "failed";
  // On failure, the step that broke is the first one not finished.
  const reached = failed ? (run.progress.length ? 1 : 0) : STAGE_INDEX[run.stage] ?? 0;
  return (
    <div className="pipeline">
      <p className="section-label">Automation</p>
      <ol className="steps">
        {PIPELINE.map((p, i) => {
          const status = i < reached ? "done" : i === reached ? (failed ? "failed" : "running") : "waiting";
          return (
            <li key={p.key} className={`step step-${status}`}>
              <span className="step-icon" aria-hidden="true">{{ done: "✓", running: "◌", failed: "✕", waiting: "○" }[status]}</span>
              <span>
                {p.text}
                {p.key === "analyzing" && run.progress.length > 0 && status !== "done" && (
                  <span className="sub-steps"><Steps steps={failed ? run.progress.filter((s) => s.status === "done") : run.progress} /></span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {run.error && <p className="error">{run.error}</p>}
    </div>
  );
}

export function TrendBadge({ trend }) {
  return <span className={`trend trend-${trend}`}>{TREND_LABEL[trend] || trend}</span>;
}

export default function ReportPanel({ report, run, canRun, onRun, quoteFor }) {
  const showPipeline = run && (run.active || run.stage === "failed");
  return (
    <aside className="card report-panel" id="report">
      <div className="card-head">
        <h2>✦ AI report</h2>
        {canRun && (
          <button className="btn btn-primary btn-sm" onClick={onRun} disabled={run?.active}>
            {run?.active ? "Running…" : report ? "Re-run" : "Run analysis"}
          </button>
        )}
      </div>

      {showPipeline && <Pipeline run={run} />}

      {!report && !run?.active && (
        <div className="empty">
          <p className="empty-title">No report yet</p>
          <p className="muted">
            Upload feedback to start the automation. It saves the feedback to Snowflake, runs the Insights Agent and notifies the team. It takes about a minute.
          </p>
        </div>
      )}

      {report && !run?.active && (
        <div className="report">
          {report.urgent.map((u) => (
            <div key={u.id} className="urgent" role="alert">
              <p className="urgent-title">⚠ Urgent: needs a human today</p>
              <p className="urgent-quote">“{u.text}”</p>
              <p><strong>Why:</strong> {u.reason}</p>
              <p><strong>Do now:</strong> {u.action}</p>
              <p className="mono">{u.id}</p>
            </div>
          ))}

          <p className="report-summary">{report.summary}</p>

          <p className="section-label">Fix first</p>
          <ol className="priorities">
            {report.priorities.map((p, i) => (
              <li key={p.theme} className="priority">
                <div className="priority-head">
                  <span className="priority-rank">{i + 1}</span>
                  <strong>{p.name}</strong>
                  <TrendBadge trend={p.trend} />
                </div>
                <p>{p.why}</p>
                <p className="priority-fix"><strong>Next step:</strong> {p.fix}</p>
                {p.evidence.slice(0, 2).map((id) => (
                  <p key={id} className="evidence">
                    <span className="mono">{id}</span> “{quoteFor(id)}”
                  </p>
                ))}
                <p className="muted small">
                  Priority score {p.score} = feedback × impact {p.impact}/3
                  {p.impactFlags?.length ? ` (${p.impactFlags.map((f) => f.replace(/_/g, " ")).join(", ")})` : ""}
                  {p.trend === "new" || p.trend === "worsening" ? " × 1.5 for trend" : ""}
                </p>
              </li>
            ))}
          </ol>

          <details className="agent-trace">
            <summary>How the agent got here</summary>
            <Steps steps={report.steps || []} />
          </details>

          <p className="footnote">
            AI-generated by {report.model.split("/").pop()} in {report.seconds}s on{" "}
            {new Date(report.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {report.reusedLabels ? `, reusing ${report.reusedLabels} labels from last batch` : ""}
            {report.tokens ? ` · ${Math.round((report.tokens.input + report.tokens.output) / 1000)}k tokens via Snowflake Cortex` : ""}. Saved in Snowflake. Review before acting.
          </p>
        </div>
      )}
    </aside>
  );
}
