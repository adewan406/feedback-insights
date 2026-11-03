// Everything the page asks the Worker for. The Worker is the only thing that talks to Snowflake and the AI.

// The demo passcode is typed by a person and remembered on this device only. It's never in the code.
const PASSCODE_KEY = "feedback-insights:passcode";
export function setPasscode(value) {
  try { localStorage.setItem(PASSCODE_KEY, value); } catch { memoryPasscode = value; }
}
let memoryPasscode = "";
function getPasscode() {
  try { return localStorage.getItem(PASSCODE_KEY) || memoryPasscode; } catch { return memoryPasscode; }
}

async function call(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", "x-app-passcode": getPasscode(), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Server error (${res.status})`);
    err.needsPasscode = Boolean(body.needsPasscode);
    throw err;
  }
  return body;
}

export const getDashboard = () => call("/api/dashboard");
export const markNotificationsRead = () => call("/api/notifications/read", { method: "POST" });

// Triggers the automation with new feedback. Returns { uploadId, runId }.
export const uploadFeedback = (rows, fileName) =>
  call("/api/uploads", { method: "POST", body: JSON.stringify({ rows, fileName }) });

// Triggers the automation again on an upload that's already saved.
export const rerunUpload = (uploadId) => call("/api/runs", { method: "POST", body: JSON.stringify({ uploadId }) });

// Checks on a run every few seconds until it's done or failed. Calls onUpdate with each status.
export async function followRun(runId, onUpdate) {
  for (;;) {
    const status = await call(`/api/runs/${runId}`);
    onUpdate(status);
    if (status.stage === "done") return status;
    if (status.stage === "failed") throw new Error(friendlyError(status.error));
    await new Promise((r) => setTimeout(r, 3000));
  }
}

function friendlyError(message = "") {
  return message || "The automation failed.";
}
