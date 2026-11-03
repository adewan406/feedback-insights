// Asked once per device before anything that costs AI, Snowflake or email.
import { useState } from "react";

export default function PasscodeDialog({ onSubmit, onClose }) {
  const [code, setCode] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Demo passcode"
        onSubmit={(e) => { e.preventDefault(); if (code.trim()) onSubmit(code.trim()); }}>
        <div className="card-head">
          <h2>Demo passcode</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted">Anyone can view this dashboard. Uploading and running the AI need the passcode, so strangers can't use up the free AI and email limits.</p>
        <input className="search passcode-input" type="password" autoFocus placeholder="Passcode" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn btn-primary" type="submit">Continue</button>
      </form>
    </div>
  );
}
