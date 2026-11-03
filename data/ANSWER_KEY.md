# QuickBite Answer Key

What a correct analysis should find. Do NOT show this file to the agent.

## Themes (count last month -> this month)

| Theme | Sep (batch 1) | Oct (batch 2) | Trend |
|---|---|---|---|
| Rating & tip screen bug (after app update 5.2) | 0 | 13 | new |
| Checkout & payment failures | 12 | 10 | stable |
| Late or cold deliveries | 8 | 8 | stable |
| Missing or wrong items | 6 | 6 | stable |
| Inaccurate order tracking / ETA | 14 | 5 | improved |
| Promo codes not applying | 10 | 4 | improved |
| Food allergy / special instructions not reaching restaurant | 0 | 1 | new |
| Praise (no problem) | 8 | 8 | stable |
| Other (feature requests, account questions, junk) | 2 | 5 | worse |

## Top 3 issues THIS month (batch 2)

1. **Rating & tip screen bug**: NEW since update 5.2 (Oct 8). Blocks ordering and adds unwanted tips.
2. **Checkout & payment failures**: still big, and costs customers money (double charges).
3. **Late or cold deliveries**: unchanged month over month.

Passing grade: the agent's top 3 contains these three themes (order 1 and 2 may swap).

## Last month's top 3 (batch 1)

1. Order tracking  2. Checkout & payment  3. Promo codes

## Trends the agent should notice

- **New:** rating & tip screen bug (0 -> 13)
- **Improved:** order tracking (14 -> 5), promo codes (10 -> 4)
- **Stable:** late/cold (8 -> 8), missing/wrong items (6 -> 6)

## URGENT flag: B2-042

> I wrote 'severe peanut allergy - no peanuts please' in the order notes for my Thai order. The restaurant told me afterward they never saw any notes. My daughter had an allergic reaction and we had to use her EpiPen. Your special instructions are not reaching restaurants. This could kill someone.

Safety risk: allergy notes in special instructions never reach the restaurant. One report, but must be escalated immediately regardless of volume.
Weak supporting signals (special instructions ignored): B1-018, B2-041.

## Tricky cases

| ID | Trick | Stars | True theme | Text |
|---|---|---|---|---|
| B1-003 | mixed | 3 | checkout_payment | Food was great as always, but checkout froze twice before it went through. |
| B1-018 | special_instructions_signal | 2 | missing_wrong | Asked for no onions in the instructions, got extra onions. |
| B1-019 | sarcasm | 3 | order_tracking | Oh great, the live map is 'live' the way a painting is live. Love it. |
| B1-034 | sarcasm_high_stars | 4 | late_cold | Thanks QuickBite for teaching me patience. 75 minutes for a burrito 👏 |
| B1-037 | sarcasm_high_stars | 5 | order_tracking | 5 stars for the order tracking, it's a great work of fiction 🙃 |
| B1-038 | mixed | 3 | checkout_payment | Love the restaurant selection. Paying is the annoying part, PayPal never works. |
| B1-039 | sarcasm | 2 | promo_codes | Wow, another promo code that 'expired' 5 minutes after you emailed it to me. Thanks so much. |
| B1-041 | mixed | 3 | promo_codes | Great food, fast delivery, but the BOGO deal didn't actually take anything off. |
| B1-049 | mixed | 3 | late_cold | Delivery took forever but the driver was super nice and apologized. |
| B2-008 | mixed | 3 | promo_codes | The 20% off code applied this time, but only to the subtotal, not delivery. Fine I guess. |
| B2-009 | sarcasm | 2 | late_cold | Nothing says 'fresh' like room temperature sushi after an hour 😂 |
| B2-014 | junk | 1 | other | asdfgh |
| B2-016 | mixed | 3 | checkout_payment | Food from Taco Loco was amazing but paying took 3 attempts. |
| B2-019 | praise_of_fix | 5 | praise | Order tracking is SO much better now, I can actually see the driver move! |
| B2-021 | mixed | 3 | rating_screen_bug | The food is still great, but the rating popup makes me not want to open the app. |
| B2-028 | mixed | 3 | late_cold | Late again, but at least the tracking told me it would be late this time. |
| B2-041 | special_instructions_signal | 3 | missing_wrong | Usually correct, but special instructions get ignored a lot. |
| B2-042 | rare_urgent |  | food_allergy | I wrote 'severe peanut allergy - no peanuts please' in the order notes for my Thai order. The restaurant told me afterward they never saw any notes. My daughter had an allergic reaction and we had to use her EpiPen. Your special instructions are not reaching restaurants. This could kill someone. |
| B2-043 | praise_of_fix | 4 | praise | Promo worked! First time in months. Saved $8. |
| B2-052 | sarcasm_high_stars | 5 | rating_screen_bug | Love being asked to rate the same pad thai from 2 weeks ago every single time I open the app. Truly, 5 stars. |
| B2-056 | overlaps_payment |  | rating_screen_bug | I was charged a $5 tip I never selected. It happened on the rating screen after my order. Please refund. |
