# Security review: what's fixed and what's left

Fred reviewed the capstone on November 3, 2026, and raised 11 points. Only safe, quick fixes were made before the demo, so nothing that could break it.

## Fixed (November 3)

| # | Issue | Fix |
|---|---|---|
| 2 | If `APP_PASSCODE` wasn't set, the passcode check was skipped and anyone could upload | `worker/index.js`: with no passcode configured, every POST (upload, re-run, mark read) is **blocked** |
| 3 | No limit on how many uploads/AI runs per day | `worker/index.js` + `worker/db.js`: a **daily cap** (`DAILY_RUN_LIMIT`, default 20) counted from `AGENT_RUNS` in Snowflake. Over the cap, the API returns 429. The direct `/api/analyze` route is now **local-only** (`ALLOW_DIRECT_ANALYZE`), so the cap can't be bypassed. |
| 4 | No limit on wrong passcode attempts | `wrangler.jsonc` + `worker/index.js`: Cloudflare rate limiter allows **5 wrong passcodes per visitor (IP) per minute**, then 429 |
| 6, 7, 8 | Docs overstated safety: "the agent never acts" and "data stays in Snowflake + Cloudflare" | README, `docs/failure-points-and-trust.md` and slide notes now say the report **automatically triggers alerts and an email**, Cortex has **cross-region processing on** (`ANY_REGION`), and emails with urgent quotes go through **Resend** |
| 10 | Error messages and the public health check exposed Snowflake details (user, role, tables, raw errors) | The health check now returns only `{ ok, database }`. Server and automation errors show plain messages, and full details stay in Cloudflare logs. |
| 11 | `.gitignore` rule `*passcode*` also hid `src/components/PasscodeDialog.jsx`, so the repo couldn't build | The rule now names only `secrets/app_passcode.txt` (also covered by `secrets/`). `PasscodeDialog.jsx` is committed. |

## Left for later

| # | Issue | Why it's not fixed yet |
|---|---|---|
| 1 | *(Fred's text wasn't provided to me. Add it here.)* | — |
| 5 | *(Fred's text wasn't provided to me. Add it here.)* | — |
| 9 | *(Fred's text wasn't provided to me. Add it here.)* | — |

## Other known gaps (from `docs/failure-points-and-trust.md`)

- **One shared passcode** instead of real logins. Anyone who learns it can upload until it's changed (`wrangler secret put APP_PASSCODE`).
- **The dashboard is public to view.** That's fine for fictional data, but real feedback would need a login.
- **No PII redaction.** Customer text, including health details, is sent to the AI and quoted in emails.
- **Prompt injection** was tested with only 3 attacks.
- **The daily cap is approximate.** It counts runs that have started, so two uploads in the same second could both get through at the limit.
- **The wrong-passcode limit is approximate.** Cloudflare counts per data center and syncs with a delay. In testing, blocking (429) started after about 17 rapid wrong tries, not exactly 5. That's still enough to stop fast guessing of a 10-character random passcode.

## Re-test after the fixes (November 3)

Live site: health check returns only `{ ok, database }`; no passcode → 401; wrong passcodes → 401, then 429; `/api/analyze` → 404 in production. The full demo flow (reset, then upload October) **passed 7/7** against the answer key: 52 seconds, 60 labels reused, B2-042 flagged urgent, 5 bell notifications, and the email accepted by Resend. Then reset for the demo.
