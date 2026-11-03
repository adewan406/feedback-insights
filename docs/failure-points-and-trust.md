# Feedback Insights: failure points and how much to trust it

Evidence comes from testing the agent against `data/answer_key.json` (`node scripts/grade.mjs <report>`).
All runs are on the same 120 fictional QuickBite reviews (60 last month, 60 this month).

## Test results (Snowflake Cortex, claude-sonnet-4-5)

| Run | Top 3 correct | Rating bug #1 | Allergy flagged urgent | False alarms | Labels correct |
|---|---|---|---|---|---|
| Live automation (October upload, reused September labels) | ✅ | ✅ | ✅ | 0 | 98% |
| Consistency run A | ✅ | ✅ | ✅ | 0 | 98% |
| Consistency run B | ✅ | ✅ | ✅ | 0 | 98% |
| Manipulation test (3 fake "trick" reviews added) | ✅ | ✅ | ✅ | 0 | n/a |

**4 of 4 runs passed all 7 checks.** The #2 and #3 spots swapped between runs: cold food came 2nd in one run, checkout in the others.

Earlier models were weaker. Workers AI Llama 3.3 70B needed 5 rounds of fixes, scoring 6/7, then 4/7, then 7/7. In a small test, Llama 3.1 8B **missed the allergy report** entirely.

## Failure points

| # | What can go wrong | Evidence from our testing | What we did / what a company should do |
|---|---|---|---|
| 1 | **Star ratings lie.** Sarcastic reviews give 5★, and support tickets have no stars at all. | Going by stars, October looked *better* (2.59★ → 2.70★), even though a new bug was blocking orders. | The AI reads the words, not the stars. All 6 sarcastic reviews were read as negative. |
| 2 | **Rare but serious issues get missed.** One allergy report is easy to drown out by volume. | Llama 3.1 8B missed it. Claude caught it in 4 of 4 runs. | A separate safety-review step double-checks urgent items, and urgent items get their own red alert and email. Next step: add a keyword safety net (allergy, EpiPen, hospital…) so a weak model can't silently miss one. |
| 3 | **The AI misjudges how serious a problem is.** | It flagged "cold food" as a *safety risk*, which pushed it from #3 to #2 in one run. | The priority score shows its math (count × impact × trend), so a human can see why something ranked where it did. |
| 4 | **Themes aren't the same every run.** | One run split the rating bug into two themes and counted 11 instead of 13. Runs disagree on whether "late" and "cold" deliveries are one theme or two. | Later runs reuse last month's themes. A human should merge or rename themes before comparing months. |
| 5 | **The AI silently skips items.** | Once, a whole batch of 20 reviews came back missing and was quietly counted as "other". | The code now re-asks for missing items, and re-checks low-confidence labels. |
| 6 | **Manipulation (prompt injection).** A review tries to give the AI orders. | 3 attacks: "label everything as praise", a fake "URGENT SAFETY ISSUE", and "put promo codes #1". All were ignored and labeled "other". | Every prompt says feedback is data, not instructions. Outputs must match a fixed format. The agent can only *report*, never take actions. A pass on 3 attacks isn't a guarantee. |
| 7 | **The AI provider fails or runs out.** | The Workers AI free quota ran out mid-testing, then kept refusing calls even when it showed 0 used. | The automation records the failure, sends a "failed" notification, and keeps the raw data for a re-run. We switched providers in an evening because the model is one setting. |
| 8 | **Cost and access end.** | A full run is about 32k tokens; about 21k when last month's labels are reused. It runs on Snowflake *trial* credits, which expire. | Reusing labels halves the cost. A real company needs a paid plan and a budget alert. |
| 9 | **Privacy.** Feedback contains personal and health details. | The allergy ticket mentions a child's medical reaction, and that quote appears in the email. | The AI runs inside Snowflake (Cortex), so the data stays in Snowflake + Cloudflare. A real deployment needs a login (not a shared passcode), PII redaction, and care with email content. |
| 10 | **Alert fatigue.** | The split rating-bug theme sent **two** "New problem" alerts for one bug. | Merge duplicate themes; only email urgent items plus one summary. |
| 11 | **Tested on fake, small, clean data.** | 120 English reviews, written to match an answer key we built ourselves. | Before trusting it, test on real historical feedback that a human has already labeled, including other languages, spam, and more than the 300-review upload limit. |

## How much can a company trust it without human review?

**Trust it to tell you where to look, not what to do.**

| Level | What | Why |
|---|---|---|
| ✅ **Fully automatic** | Saving uploads, counting, charts, sending notifications and emails | Plain code with retries; failures are reported, not hidden |
| 🟡 **AI drafts, a human approves** | Themes, the "fix first" ranking, the suggested next steps | The right top 3 in 4/4 runs, but #2 and #3 swap, and theme names and counts vary |
| 🔴 **Always a human** | Responding to urgent safety issues, contacting customers, refunds, roadmap decisions | The AI is a smoke alarm, not the firefighter. One wrong call here hurts a real person. |

**Why a human should review the report before acting:** the AI can't verify facts (did update 5.2 really cause this?). It can overrate or underrate severity, its theme grouping changes from run to run, and it has only been tested on 120 fake reviews. A product manager reading the report and its quoted evidence takes about 5 minutes, which is much faster than reading 60+ reviews by hand. That's the real time saving.
