# Feedback Insights

**An AI user-research assistant for product teams.** Upload user feedback (app reviews, survey answers, support tickets) and Feedback Insights finds the themes, ranks the biggest problems, tells the team what to fix first, and flags anything urgent, like a safety issue.

**Live demo:** https://feedback-insights.snowflake-site.workers.dev
(Anyone can view the dashboard. Uploading and running the AI need a demo passcode, so strangers can't use up the AI credits.)

Built for the AI Club / CU Boulder Applied AI Capstone (November 2026). The demo client is **QuickBite**, a fictional food delivery app. All the feedback data is made up.

## Why

Star ratings hide what's broken. In the demo data, October's average rating went *up* (2.59★ → 2.70★) in the same month a new bug started blocking people from ordering, because sarcastic reviews give 5★ and support tickets have no stars. Feedback Insights reads the words instead.

## The AI agent (`worker/agent.js`)

The Insights Agent takes a batch of feedback and works through 7 steps on its own. The LLM makes the judgment calls, and plain code does the math:

| Step | Decided by | What happens |
|---|---|---|
| 1. Discover themes | AI | Groups feedback by the screen or team that owns it (reuses last month's themes) |
| 2. Label every review | AI | Theme and sentiment from the words, not the stars (catches sarcasm) |
| 3. Self-check | AI | Re-reads only the reviews it was unsure about |
| 4. Verify urgent | AI | A "safety reviewer" confirms health, fraud or legal risks |
| 5. Compare months | Code | Counts per theme: new, worse, steady or better |
| 6. Rate impact | AI + code | AI answers yes/no (blocks ordering? costs money? safety risk?), then code computes `priority = complaints × impact × 1.5 if new or worsening` |
| 7. Write report | AI | Top 3 fixes with quoted evidence, plus a one-sentence insight |

The LLM is **Claude (`claude-sonnet-4-5`) running inside Snowflake Cortex**. The model is one setting (`AI_MODEL` in `wrangler.jsonc`).

## The automation (`worker/pipeline.js`)

A **Cloudflare Workflow**, separate from the agent, that starts whenever feedback is uploaded:

1. **Save raw feedback** to Snowflake
2. **Run the Insights Agent**, then save its report and labels to Snowflake
3. **Notify the team**: the dashboard's notification bell, plus an email via Resend

Each step is saved when it finishes and retries on its own if it fails. If a run fails anyway, it's marked as failed and a notification goes out, so nothing fails silently.

## Snowflake

Snowflake is both the database and the AI engine:

- **Tables** (`setup.sql`): `UPLOADS`, `FEEDBACK_RAW`, `AGENT_RUNS` (each report as JSON), `FEEDBACK_LABELS` (reused next month, which roughly halves AI cost) and `NOTIFICATIONS`
- **Cortex** runs the LLM (`SNOWFLAKE.CORTEX.COMPLETE`), so feedback stays in Snowflake
- The app logs in as a **service user with key-pair auth**, and its role can only read and write these 5 tables

## Testing

`data/` has 120 fictional reviews (September and October) plus an **answer key** (`data/ANSWER_KEY.md`): the true themes, the top 3, one rare-but-serious allergy report and 21 tricky cases such as sarcasm. `scripts/grade.mjs` grades any agent report against it.

With Claude via Cortex, **4 of 4 runs passed all 7 checks**: the right top 3, the allergy report flagged urgent with 0 false alarms, 98% of reviews labeled correctly, and 0 of 3 "prompt injection" trick reviews obeyed. Failure points and how far to trust the system are in [`docs/failure-points-and-trust.md`](docs/failure-points-and-trust.md).

## Project layout

```
src/            React dashboard (Vite + Recharts)
worker/         Cloudflare Worker: API, agent, automation, Snowflake + email code
data/           Fictional QuickBite feedback + answer key
scripts/        Data generator, test/grading scripts, demo reset
docs/           Failure points and trust analysis
results/        Saved agent reports from testing
setup.sql       Snowflake database, tables, role and service user
```

## How to run it

You need Node.js, a Cloudflare account (with `wrangler` logged in), a Snowflake account with Cortex, and optionally a Resend account for email.

1. **Install:** `npm install`
2. **Snowflake:** create a key pair (`openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out secrets/rsa_key.p8`, then `openssl rsa -in secrets/rsa_key.p8 -pubout -out secrets/rsa_key.pub`). Put the public key in `setup.sql` and run it in Snowsight as `ACCOUNTADMIN`. Set your account, user and key fingerprint under `vars` in `wrangler.jsonc`.
3. **Local secrets:** create `.dev.vars` (it's git-ignored):
   ```
   SNOWFLAKE_PRIVATE_KEY="<private key body>"
   RESEND_API_KEY="<optional>"
   NOTIFY_EMAIL="<optional>"
   ```
4. **Run locally:** `npm run api` (Worker on port 8787) and `npm run dev` (site on http://127.0.0.1:5173)
5. **Deploy:** add each secret with `npx wrangler secret put <NAME>` (including `APP_PASSCODE`), then `npm run deploy`

Useful scripts: `npm run data` regenerates the fake data and answer key, `node scripts/grade.mjs <report.json>` grades a report, and `node scripts/reset_demo.mjs --yes` resets the live demo to September only.

**Never commit** `.dev.vars` or `secrets/`. Both are in `.gitignore`.
