import { useEffect, useMemo, useState } from "react";
import { getDashboard, uploadFeedback, rerunUpload, followRun, markNotificationsRead, setPasscode } from "./api.js";
import { parseCsv, summarize, sourceLabel } from "./feedback.js";
import batch1Csv from "../data/quickbite_batch1_sep2026.csv?raw";
import batch2Csv from "../data/quickbite_batch2_oct2026.csv?raw";
import Sidebar from "./components/Sidebar.jsx";
import StatCard from "./components/StatCard.jsx";
import TrendCard from "./components/TrendCard.jsx";
import SentimentCard from "./components/SentimentCard.jsx";
import SourcesCard from "./components/SourcesCard.jsx";
import FeedbackTable from "./components/FeedbackTable.jsx";
import ReportPanel from "./components/ReportPanel.jsx";
import UploadPanel from "./components/UploadPanel.jsx";
import ThemesCard from "./components/ThemesCard.jsx";
import Notifications from "./components/Notifications.jsx";
import PasscodeDialog from "./components/PasscodeDialog.jsx";

// Bundled demo files: shown while Snowflake is empty, and used by "Load demo data".
const DEMO_FILES = [
  { fileName: "quickbite_batch1_sep2026.csv", rows: parseCsv(batch1Csv) },
  { fileName: "quickbite_batch2_oct2026.csv", rows: parseCsv(batch2Csv) },
];
const DEMO = { previous: DEMO_FILES[0].rows, current: DEMO_FILES[1].rows };

// "2026-10-14" -> "Oct 2026", using the most common month in the batch.
function monthLabel(rows) {
  const counts = {};
  for (const r of rows) if (r.date) counts[r.date.slice(0, 7)] = (counts[r.date.slice(0, 7)] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "—";
  return new Date(top[0] + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function App() {
  // mode: loading | snowflake (real data) | empty (Snowflake has nothing yet) | offline (can't reach the Worker)
  const [data, setData] = useState({ mode: "loading", ...DEMO, report: null, notifications: [] });
  const [source, setSource] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [run, setRun] = useState(null); // { stage, progress, error, active }
  const [askPasscode, setAskPasscode] = useState(null); // the action to retry once a passcode is entered

  async function refresh() {
    try {
      const d = await getDashboard();
      if (d.empty) setData({ mode: "empty", ...DEMO, report: null, notifications: d.notifications });
      else setData({ mode: "snowflake", ...d });
      return d;
    } catch {
      setData((old) => ({ ...old, mode: "offline" }));
    }
  }

  useEffect(() => {
    refresh().then((d) => {
      // If an automation run is still going (e.g. the page was reloaded), keep following it.
      const last = d?.lastRun;
      if (last && !["done", "failed"].includes(last.stage)) track(last.runId);
    });
  }, []);

  // Follows one automation run, updating the panel as it goes, then reloads the dashboard.
  async function track(runId) {
    setRun({ stage: "saving_raw", progress: [], error: "", active: true });
    try {
      await followRun(runId, (s) => setRun({ stage: s.stage, progress: s.progress, error: "", active: true }));
      setRun((r) => ({ ...r, stage: "done", active: false }));
      return true;
    } catch (err) {
      setRun((r) => ({ ...r, stage: "failed", error: err.message, active: false }));
      return false;
    } finally {
      await refresh();
    }
  }

  async function start(trigger) {
    setRun({ stage: "saving_raw", progress: [], error: "", active: true });
    try {
      const { runId } = await trigger();
      return await track(runId);
    } catch (err) {
      if (err.needsPasscode) {
        setRun(null);
        setAskPasscode(() => trigger);
        return false;
      }
      setRun({ stage: "failed", progress: [], error: err.message, active: false });
      return false;
    }
  }

  function submitPasscode(code) {
    setPasscode(code);
    const retry = askPasscode;
    setAskPasscode(null);
    start(retry);
  }

  // Upload = the automation's trigger.
  function handleUpload(rows, fileName) {
    setShowUpload(false);
    setSource("all");
    start(() => uploadFeedback(rows, fileName));
  }

  // First-time setup: send last month, then this month, through the automation.
  async function loadDemo() {
    for (const f of DEMO_FILES) {
      if (!(await start(() => uploadFeedback(f.rows, f.fileName)))) return;
    }
  }

  async function handleOpenNotifications() {
    if (!data.notifications.some((n) => !n.read)) return;
    setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
    markNotificationsRead().catch(() => {}); // visitors without the passcode just won't save "read"
  }

  const { report } = data;
  const filter = (rows) => (source === "all" ? rows : rows.filter((r) => r.source === source));
  const current = useMemo(() => filter(data.current), [data, source]);
  const previous = useMemo(() => filter(data.previous), [data, source]);
  const now = summarize(current);
  const before = summarize(previous);
  const thisLabel = monthLabel(data.current);
  const lastLabel = data.previous.length ? monthLabel(data.previous) : "no earlier batch";
  const sources = [...new Set([...data.current, ...data.previous].map((r) => r.source))];
  const textById = useMemo(() => new Map([...data.previous, ...data.current].map((r) => [r.id, r.text])), [data]);
  const themeNames = report ? Object.fromEntries(report.themes.map((t) => [t.id, t.name])) : {};
  const live = data.mode === "snowflake";

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <header className="page-header">
          <div>
            <p className="eyebrow">QuickBite</p>
            <h1>Feedback insights</h1>
          </div>
          <div className="header-actions">
            <Notifications items={data.notifications} onOpen={handleOpenNotifications} />
            <button className="btn btn-primary" onClick={() => setShowUpload(true)} disabled={run?.active || data.mode === "offline"}>
              + Upload feedback
            </button>
          </div>
        </header>

        {data.mode === "empty" && (
          <div className="banner">
            <span>Snowflake is empty. You're looking at the bundled demo files. Send them through the automation to save them and run the agent.</span>
            <button className="btn btn-primary btn-sm" onClick={loadDemo} disabled={run?.active}>Load demo data into Snowflake</button>
          </div>
        )}
        {data.mode === "offline" && (
          <div className="banner banner-warn">Can't reach the server, so this is the bundled demo data. Start it with <code>npm run api</code>.</div>
        )}

        <div className="toolbar">
          <span className="chip">📅 {thisLabel} vs {lastLabel}</span>
          <label className="chip">
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
          </label>
          <span className="chip chip-quiet">
            <span className={`status-dot ${live ? "on" : ""}`} aria-hidden="true" />
            {live ? `Snowflake · ${data.currentUpload.fileName}` : data.mode === "loading" ? "Connecting…" : "Local demo data"}
          </span>
        </div>

        <p className="section-label">Feedback this batch</p>
        <section className="stat-row">
          <StatCard title="Total feedback" value={now.count} prev={previous.length ? before.count : null} format={(v) => v} />
          <StatCard title="Average rating" value={now.avgStars} prev={before.avgStars} format={(v) => v.toFixed(2) + "★"} good="up" />
          <StatCard title="Negative share" value={now.negativeShare} prev={before.negativeShare} format={(v) => Math.round(v * 100) + "%"} formatDiff={(d) => Math.round(d * 100) + " pts"} hint="Rated 1–2 stars" good="down" />
          <StatCard title="Support tickets" value={now.supportCount} prev={previous.length ? before.supportCount : null} format={(v) => v} />
        </section>

        <div className="content-grid">
          <div className="charts">
            <TrendCard rows={[...previous, ...current]} now={now} before={before} thisLabel={thisLabel} lastLabel={lastLabel}
              aiInsight={report?.insight} />
            <div className="two-col">
              <ThemesCard report={report} />
              <SentimentCard current={current} previous={previous} thisLabel={thisLabel} lastLabel={lastLabel} />
            </div>
            <SourcesCard rows={current} />
          </div>
          <ReportPanel report={report} run={run} canRun={live} onRun={() => start(() => rerunUpload(data.currentUpload.id))}
            quoteFor={(id) => textById.get(id) || ""} />
        </div>

        <FeedbackTable rows={current} labels={report?.labels} themeNames={themeNames} />
      </main>

      {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onUpload={handleUpload} />}
      {askPasscode && <PasscodeDialog onSubmit={submitPasscode} onClose={() => setAskPasscode(null)} />}
    </div>
  );
}
