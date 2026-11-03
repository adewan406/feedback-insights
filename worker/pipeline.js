// THE AUTOMATION: a Cloudflare Workflow, separate from the agent.
// Trigger: new feedback uploaded (POST /api/uploads) or a manual re-run.
//   ① save raw feedback to Snowflake
//   ② run the Insights Agent, save its report + labels to Snowflake
//   ③ notify the team (dashboard notifications + email)
// Each step is saved when it finishes and retried on its own if it fails.
import { WorkflowEntrypoint } from "cloudflare:workers";
import { runAgent } from "./agent.js";
import * as db from "./db.js";
import { emailConfigured, sendReportEmail } from "./email.js";
import { query } from "./snowflake.js";

const RETRY = { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" };

export class FeedbackPipeline extends WorkflowEntrypoint {
  async run(event, step) {
    const { runId, uploadId, fileName, rows } = event.payload;
    const env = this.env;

    try {
      // ① Save raw feedback (skipped on a re-run: it's already in Snowflake).
      const previousUploadId = await step.do("1. Save raw feedback to Snowflake", RETRY, async () => {
        if (rows) await db.saveUpload(env, { uploadId, fileName, rows });
        const prev = await db.previousUploadId(env, uploadId);
        await db.createRun(env, { runId, uploadId, previousUploadId: prev });
        return prev;
      });

      // ② Run the agent. Reuse last month's labels when they exist (half the AI cost).
      const report = await step.do("2a. Run Insights Agent", { retries: { limit: 1, delay: "10 seconds" }, timeout: "10 minutes" }, async () => {
        const [current, previous, reuse] = await Promise.all([
          db.loadRows(env, uploadId),
          db.loadRows(env, previousUploadId),
          previousUploadId ? db.reusableLabels(env, previousUploadId) : null,
        ]);
        const steps = [];
        const log = (s) => {
          steps.push(s);
          db.saveProgress(env, runId, steps).catch(() => {}); // best effort, for the live view
        };
        const result = await runAgent(env, { current, previous, reuse }, log);
        return { ...result, steps };
      });

      await step.do("2b. Save report + labels to Snowflake", RETRY, () =>
        db.saveResults(env, { runId, uploadId, previousUploadId, report }));

      // ③ Notify: dashboard first, then email. A failed email never fails the whole run.
      await step.do("3a. Notify the team on the dashboard", RETRY, () =>
        db.addNotifications(env, runId, notificationsFor(report, previousUploadId)));
      if (emailConfigured(env)) {
        try {
          await step.do("3b. Email the team", RETRY, async () => {
            await sendReportEmail(env, { runId, report });
            await query(env, "UPDATE NOTIFICATIONS SET EMAILED = TRUE WHERE RUN_ID = ?", [runId]);
          });
        } catch (err) {
          console.error("email failed", err);
        }
      }
      await step.do("Mark run done", RETRY, () => db.setRunStatus(env, runId, "done"));
    } catch (err) {
      console.error("pipeline failed", err); // full details stay in the Cloudflare logs
      const raw = String(err.message || err).replace(/^\w*Error:\s*/, "");
      // Database/AI errors can contain account or SQL details: show a plain message instead.
      const reason = /snowflake|sql|jwt|statement|cortex/i.test(raw) ? "A database or AI step failed." : raw;
      // Make the failure visible on the dashboard instead of failing silently.
      await step.do("Record failure", RETRY, async () => {
        await db.setRunStatus(env, runId, "failed", reason.slice(0, 500));
        await db.addNotifications(env, runId, [
          { level: "error", title: "Analysis failed", body: `${reason} The raw feedback is saved, so you can re-run it later.` },
        ]);
      });
      throw err; // the Workflow shows as failed in the Cloudflare dashboard too
    }
  }
}

// Decides what the team should hear about. Plain rules, no AI.
function notificationsFor(report, hadPrevious) {
  const out = [];
  for (const u of report.urgent) {
    out.push({ level: "urgent", title: "Urgent: needs a human today", body: `${u.id}: ${u.reason} Do now: ${u.action}` });
  }
  if (hadPrevious) {
    for (const t of report.themes.filter((t) => t.trend === "new" && t.id !== "praise" && t.id !== "other")) {
      out.push({ level: "warning", title: `New problem: ${t.name}`, body: `${t.thisMonth} complaints this batch (${t.lastMonth} last time).` });
    }
  }
  const top = report.priorities[0];
  out.push({
    level: "info",
    title: "New feedback report ready",
    body: top ? `Fix first: ${top.name}. ${report.insight}` : report.insight,
  });
  return out;
}
