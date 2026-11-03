// Sends one sample report email using the keys in .dev.vars (no AI, no Snowflake).
// Usage: node scripts/test_email.mjs
import { readFileSync } from "node:fs";
import { sendReportEmail, emailConfigured } from "../worker/email.js";

const env = Object.fromEntries(
  [...readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").matchAll(/^(\w+)="?(.*?)"?$/gm)].map((m) => [m[1], m[2]]),
);
if (!emailConfigured(env)) throw new Error("Add RESEND_API_KEY and NOTIFY_EMAIL to .dev.vars first.");

const sample = {
  insight: "This is a test email from Feedback Insights. Rating screen complaints jumped from 0 to 13.",
  summary: "Sample report so you can check the email looks right. Real reports arrive after each upload.",
  urgent: [{ id: "B2-042", text: "Sample urgent feedback text.", reason: "Sample: possible safety risk.", action: "Sample: call the customer today." }],
  priorities: [{ name: "Rating screen bug", trend: "new", why: "13 customers can't close the rating popup.", fix: "Roll back the popup change from update 5.2." }],
};
await sendReportEmail(env, { runId: `test-${Date.now()}`, report: sample });
console.log("Sent! Check the inbox for", env.NOTIFY_EMAIL.replace(/(.).*(@.*)/, "$1…$2"));
