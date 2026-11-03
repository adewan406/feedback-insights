// Upload a CSV or paste feedback (one per line). Becomes "this month".
import { useState } from "react";
import { parseCsv, parsePasted } from "../feedback.js";

export default function UploadPanel({ onClose, onUpload }) {
  const [mode, setMode] = useState("csv");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (!rows.length) return setError("No feedback found. The CSV needs a column called text, feedback, or review.");
    onUpload(rows, file.name);
  }

  function handlePaste() {
    const rows = parsePasted(pasted);
    if (!rows.length) return setError("Paste at least one line of feedback.");
    onUpload(rows, "pasted text");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Upload feedback">
        <div className="card-head">
          <h2>Upload feedback</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tabs">
          <button className={mode === "csv" ? "tab active" : "tab"} onClick={() => setMode("csv")}>CSV file</button>
          <button className={mode === "paste" ? "tab active" : "tab"} onClick={() => setMode("paste")}>Paste text</button>
        </div>
        {mode === "csv" ? (
          <label className="dropzone">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
            <strong>Choose a CSV file</strong>
            <span className="muted">Columns: date, source, text, star_rating</span>
          </label>
        ) : (
          <>
            <textarea rows={8} placeholder={"One piece of feedback per line…\nThe app crashed at checkout\nLove the new tracking map!"}
              value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button className="btn btn-primary" onClick={handlePaste}>Add feedback</button>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <p className="footnote">Uploading starts the automation: save to Snowflake → AI agent → notify. Your upload becomes the new batch and is compared with the one before it.</p>
      </div>
    </div>
  );
}
