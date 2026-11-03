// Sends the team an email when a report is ready (automation step 3b), using Resend's free tier.
// Needs two secrets: RESEND_API_KEY and NOTIFY_EMAIL. Without them, email is skipped.

export const emailConfigured = (env) => Boolean(env.RESEND_API_KEY && env.NOTIFY_EMAIL);

export async function sendReportEmail(env, { runId, report }) {
  const urgent = report.urgent.length;
  const subject = urgent
    ? `⚠ ${urgent} urgent issue${urgent > 1 ? "s" : ""} in new feedback: ${report.priorities[0]?.name || "report ready"}`
    : `Feedback report ready. Fix first: ${report.priorities[0]?.name || "see dashboard"}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": runId, // a retried step won't send the same email twice
    },
    body: JSON.stringify({
      from: "Feedback Insights <onboarding@resend.dev>",
      to: [env.NOTIFY_EMAIL],
      subject,
      html: html(report, env.APP_URL),
      text: text(report, env.APP_URL),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// Feedback text comes from the public, and the report is AI-written: escape everything.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function html(report, appUrl) {
  const urgent = report.urgent
    .map((u) => `<div style="border:1px solid #c2362f;background:#fbeaea;border-radius:8px;padding:12px;margin:0 0 12px">
      <strong style="color:#c2362f">⚠ Urgent: needs a human today (${esc(u.id)})</strong>
      <p style="font-style:italic">“${esc(u.text)}”</p>
      <p><strong>Why:</strong> ${esc(u.reason)}<br><strong>Do now:</strong> ${esc(u.action)}</p></div>`)
    .join("");
  const priorities = report.priorities
    .map((p, i) => `<li style="margin-bottom:10px"><strong>${i + 1}. ${esc(p.name)}</strong> (${esc(p.trend)})<br>${esc(p.why)}<br><em>Next step:</em> ${esc(p.fix)}</li>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#0b0b0b;line-height:1.5">
    <h2 style="margin:0 0 8px">Feedback Insights report</h2>
    <p style="font-size:16px">${esc(report.insight)}</p>
    ${urgent}
    <p>${esc(report.summary)}</p>
    <h3 style="margin:16px 0 8px">Fix first</h3><ol style="padding-left:18px;list-style:none">${priorities}</ol>
    ${appUrl ? `<p><a href="${esc(appUrl)}">Open the dashboard</a></p>` : ""}
    <p style="color:#77766f;font-size:12px">AI-generated. Review before acting.</p></div>`;
}

function text(report, appUrl) {
  return [
    report.insight,
    ...report.urgent.map((u) => `URGENT (${u.id}): ${u.reason} Do now: ${u.action}`),
    report.summary,
    "Fix first:",
    ...report.priorities.map((p, i) => `${i + 1}. ${p.name}: ${p.why} Next step: ${p.fix}`),
    appUrl ? `Dashboard: ${appUrl}` : "",
    "AI-generated. Review before acting.",
  ].filter(Boolean).join("\n\n");
}
