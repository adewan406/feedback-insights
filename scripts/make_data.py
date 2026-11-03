"""
Generates the fake QuickBite feedback data + the answer key.

Each review is written by hand and tagged with its TRUE theme. The CSVs are
written WITHOUT the tags (so the agent can't peek); the answer key is built
FROM the tags, so its counts always match the data exactly.

Run:  python3 scripts/make_data.py
"""
import csv
import json
import random
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

random.seed(42)  # same output every run
OUT = Path(__file__).resolve().parent.parent / "data"

THEMES = {
    "rating_screen_bug": "Rating & tip screen bug (after app update 5.2)",
    "checkout_payment": "Checkout & payment failures",
    "late_cold": "Late or cold deliveries",
    "missing_wrong": "Missing or wrong items",
    "order_tracking": "Inaccurate order tracking / ETA",
    "promo_codes": "Promo codes not applying",
    "food_allergy": "Food allergy / special instructions not reaching restaurant",
    "praise": "Praise (no problem)",
    "other": "Other (feature requests, account questions, junk)",
}

# (source, stars or None, theme, text, tricky-tag or None)
# sources: app_store, google_play, survey, support  (support tickets have no stars)
BATCH1 = [
    # --- order tracking (14) : the #1 problem last month ---
    ("app_store", 2, "order_tracking", "The map said my driver was 2 minutes away for 25 minutes. Driver icon just sat frozen on the same street.", None),
    ("google_play", 2, "order_tracking", "ETA keeps jumping from 10 min to 40 min to 15 min. Just tell me the truth.", None),
    ("app_store", 1, "order_tracking", "Tracking screen showed 'Delivered' while I was still standing at my door waiting. Food arrived 20 min later.", None),
    ("google_play", 2, "order_tracking", "Order tracking is useless. The dot doesn't move and then suddenly the food is here.", None),
    ("support", None, "order_tracking", "Hi, my order #48213 says delivered but I never got it. Tracking showed the driver at a completely different address. Please help.", None),
    ("app_store", 3, "order_tracking", "Oh great, the live map is 'live' the way a painting is live. Love it.", "sarcasm"),
    ("survey", 3, "order_tracking", "Mostly fine but I don't trust the arrival time anymore. It's always off by 15+ minutes.", None),
    ("google_play", 3, "order_tracking", "The driver's location on the map is always a few minutes behind, so I go downstairs too early every time.", None),
    ("app_store", 2, "order_tracking", "Tracking page crashes when I open it from the notification.", None),
    ("support", None, "order_tracking", "Tracking has been stuck on 'Restaurant is preparing your order' for an hour. Restaurant says it was picked up 40 min ago. Where is my food?", None),
    ("survey", 2, "order_tracking", "Please fix the order status updates. I got 'Out for delivery' after it was already delivered.", None),
    ("app_store", 2, "order_tracking", "ETA said 6:15, food came 7:05. No update in between.", None),
    ("google_play", 2, "order_tracking", "Can't see where my driver is at all, the map is just a gray box on my Pixel.", None),
    ("app_store", 5, "order_tracking", "5 stars for the order tracking, it's a great work of fiction 🙃", "sarcasm_high_stars"),
    # --- checkout / payment (12) ---
    ("app_store", 1, "checkout_payment", "App crashes every time I tap Place Order. Tried 4 times, gave up and used a different app.", None),
    ("google_play", 1, "checkout_payment", "Got charged twice for one order. Took a week to get the refund.", None),
    ("support", None, "checkout_payment", "My card was declined at checkout but my bank says there was no attempt. Card works everywhere else. Order total was $34.50.", None),
    ("app_store", 2, "checkout_payment", "Apple Pay button just spins forever.", None),
    ("google_play", 3, "checkout_payment", "Checkout makes me re-enter my address every single time even though it's saved.", None),
    ("survey", 2, "checkout_payment", "Checkout takes too many screens. Why do I confirm the tip, then the address, then the payment, then confirm again?", None),
    ("app_store", 2, "checkout_payment", "Service fee only shows up on the very last screen. Feels sneaky.", None),
    ("google_play", 2, "checkout_payment", "Payment failed, but the order still went through and then got cancelled 10 min later. Confusing.", None),
    ("support", None, "checkout_payment", "I was charged $41.20 for an order that says 'Payment failed' in the app. Please refund.", None),
    ("app_store", 1, "checkout_payment", "Can't add a new card, the form keeps saying 'invalid zip code' for my real zip code.", None),
    ("google_play", 3, "checkout_payment", "Food was great as always, but checkout froze twice before it went through.", "mixed"),
    ("survey", 3, "checkout_payment", "Love the restaurant selection. Paying is the annoying part, PayPal never works.", "mixed"),
    # --- promo codes (10) ---
    ("app_store", 1, "promo_codes", "Promo code WELCOME20 says 'not valid' even though it's my first order.", None),
    ("google_play", 2, "promo_codes", "Applied a promo code, it showed the discount, then at checkout the discount disappeared.", None),
    ("support", None, "promo_codes", "The 'Free delivery Friday' promo didn't apply to my order. I was charged $4.99 delivery. Can I get that back?", None),
    ("google_play", 1, "promo_codes", "Promo codes never work for me. 3 tries this month.", None),
    ("app_store", 2, "promo_codes", "Wow, another promo code that 'expired' 5 minutes after you emailed it to me. Thanks so much.", "sarcasm"),
    ("survey", 2, "promo_codes", "The promos look great in the emails but when I try to use them there's always some hidden rule.", None),
    ("app_store", 3, "promo_codes", "Can't find where to enter a promo code on the checkout screen.", None),
    ("google_play", 2, "promo_codes", "Got a promo from a friend referral, app says I'm not eligible. Why?", None),
    ("app_store", 3, "promo_codes", "Great food, fast delivery, but the BOGO deal didn't actually take anything off.", "mixed"),
    ("support", None, "promo_codes", "Promo code SAVE10 was accepted but my receipt shows full price.", None),
    # --- late / cold (8) ---
    ("app_store", 1, "late_cold", "Food arrived 50 minutes late and completely cold.", None),
    ("google_play", 2, "late_cold", "Fries were soggy and cold. Driver clearly made two other stops first.", None),
    ("survey", 2, "late_cold", "Deliveries during dinner rush are always late.", None),
    ("app_store", 1, "late_cold", "Ordered at 12:10 for my lunch break, got it at 1:15. Lunch break was over.", None),
    ("google_play", 2, "late_cold", "Pizza showed up lukewarm. Not the restaurant's fault, it sat somewhere for a while.", None),
    ("support", None, "late_cold", "My order was over an hour late and the ice cream was melted. I'd like a refund.", None),
    ("app_store", 3, "late_cold", "Delivery took forever but the driver was super nice and apologized.", "mixed"),
    ("google_play", 4, "late_cold", "Thanks QuickBite for teaching me patience. 75 minutes for a burrito 👏", "sarcasm_high_stars"),
    # --- missing / wrong items (6) ---
    ("app_store", 2, "missing_wrong", "Missing my drink AND the side of guac I paid extra for.", None),
    ("google_play", 1, "missing_wrong", "Got someone else's order entirely. Different name on the bag.", None),
    ("support", None, "missing_wrong", "Order #51107 was missing the kids meal. Please refund $8.99.", None),
    ("app_store", 2, "missing_wrong", "Asked for no onions in the instructions, got extra onions.", "special_instructions_signal"),
    ("survey", 3, "missing_wrong", "Items are missing maybe 1 in 5 orders. Usually small stuff like sauces.", None),
    ("google_play", 2, "missing_wrong", "Wrong sushi roll, and the report-a-problem screen wouldn't let me upload a photo.", None),
    # --- praise (8) ---
    ("app_store", 5, "praise", "Fast, easy, and the food was hot. Best delivery app in town.", None),
    ("google_play", 5, "praise", "Love the reorder button, saves me so much time.", None),
    ("survey", 5, "praise", "Great selection of local restaurants I can't find on other apps.", None),
    ("app_store", 5, "praise", "Drivers are always polite. Never had a bad experience.", None),
    ("google_play", 4, "praise", "Clean design and easy to use.", None),
    ("survey", 4, "praise", "Pretty good overall. Prices are a bit high but convenient.", None),
    ("app_store", 5, "praise", "Got my food in 18 minutes. Impressive.", None),
    ("google_play", 5, "praise", "The group order feature made our office lunch so easy.", None),
    # --- other (2) ---
    ("app_store", 4, "other", "Can you add more vegan options in my area?", None),
    ("support", None, "other", "How do I change the email on my account?", None),
]

BATCH2 = [
    # --- NEW problem: rating & tip screen bug after update 5.2 (13) ---
    ("app_store", 2, "rating_screen_bug", "Since the last update the 'Rate your order' popup shows up every time I open the app, even for orders I already rated.", None),
    ("google_play", 1, "rating_screen_bug", "Rating screen won't close. I tap X and it comes right back.", None),
    ("app_store", 1, "rating_screen_bug", "Can't place a new order because the rate-your-driver screen is stuck on top of everything.", None),
    ("support", None, "rating_screen_bug", "The rating popup is blocking my whole screen and I can't get to my cart. I've rated the order 3 times. Please fix.", None),
    ("google_play", 2, "rating_screen_bug", "I rated my driver 5 stars and the app saved it as 1 star?? Poor guy.", None),
    ("app_store", 2, "rating_screen_bug", "Update 5.2 broke the ratings page. Submit button does nothing.", None),
    ("app_store", 5, "rating_screen_bug", "Love being asked to rate the same pad thai from 2 weeks ago every single time I open the app. Truly, 5 stars.", "sarcasm_high_stars"),
    ("survey", 2, "rating_screen_bug", "The new rating prompt is really annoying. It pops up constantly.", None),
    ("google_play", 1, "rating_screen_bug", "The tip screen after rating keeps adding a tip I didn't choose.", None),
    ("app_store", 1, "rating_screen_bug", "App freezes on the 'How was your order?' screen. Have to force quit.", None),
    ("support", None, "rating_screen_bug", "I was charged a $5 tip I never selected. It happened on the rating screen after my order. Please refund.", "overlaps_payment"),
    ("app_store", 2, "rating_screen_bug", "Rating stars don't respond to taps on my iPhone 15.", None),
    ("google_play", 3, "rating_screen_bug", "The food is still great, but the rating popup makes me not want to open the app.", "mixed"),
    # --- checkout / payment (10) : slightly better ---
    ("app_store", 3, "checkout_payment", "Place Order button still crashes sometimes, not as bad as before though.", None),
    ("google_play", 1, "checkout_payment", "Charged twice again for a single order.", None),
    ("support", None, "checkout_payment", "Payment says failed but money left my account. Order #60331, $27.80.", None),
    ("google_play", 2, "checkout_payment", "Apple Pay works now apparently, but Google Pay just shows an error.", None),
    ("app_store", 2, "checkout_payment", "Service fee still hidden until the last screen.", None),
    ("survey", 3, "checkout_payment", "Checkout is a little faster now but still asks for my address every time.", None),
    ("google_play", 3, "checkout_payment", "Card got declined for no reason, worked fine on the second try.", None),
    ("app_store", 2, "checkout_payment", "Checkout timed out while I was picking a tip and I lost my whole cart.", None),
    ("support", None, "checkout_payment", "Hi, I was billed for an order I cancelled within 1 minute. Please refund $19.40.", None),
    ("google_play", 3, "checkout_payment", "Food from Taco Loco was amazing but paying took 3 attempts.", "mixed"),
    # --- late / cold (8) : unchanged ---
    ("app_store", 1, "late_cold", "45 min late, cold noodles.", None),
    ("google_play", 2, "late_cold", "Friday dinner deliveries are always slow.", None),
    ("survey", 2, "late_cold", "Food often arrives lukewarm.", None),
    ("support", None, "late_cold", "My order arrived 1 hour 10 minutes after the estimated time. Food was cold. Requesting a refund.", None),
    ("google_play", 1, "late_cold", "Burger was cold and the bun was soggy. Took 70 minutes.", None),
    ("app_store", 3, "late_cold", "Late again, but at least the tracking told me it would be late this time.", "mixed"),
    ("app_store", 2, "late_cold", "Driver went to the wrong building first, food was cold by the time I got it.", None),
    ("google_play", 2, "late_cold", "Nothing says 'fresh' like room temperature sushi after an hour 😂", "sarcasm"),
    # --- missing / wrong (6) : unchanged ---
    ("app_store", 2, "missing_wrong", "Missing one of my two entrees.", None),
    ("google_play", 2, "missing_wrong", "No utensils, no napkins, no sauce. Again.", None),
    ("support", None, "missing_wrong", "Order #61842 was missing a large fries and a drink. Please refund.", None),
    ("app_store", 1, "missing_wrong", "Received the wrong order completely.", None),
    ("survey", 3, "missing_wrong", "Usually correct, but special instructions get ignored a lot.", "special_instructions_signal"),
    ("google_play", 3, "missing_wrong", "Wrong drink. Ordered Diet Coke, got Sprite.", None),
    # --- order tracking (5) : IMPROVED (was 14) ---
    ("google_play", 3, "order_tracking", "ETA was off by about 15 minutes, but better than it used to be.", None),
    ("app_store", 3, "order_tracking", "Map froze once near the end of the delivery.", None),
    ("support", None, "order_tracking", "Tracking showed delivered but the driver was still 5 minutes away.", None),
    ("google_play", 4, "order_tracking", "Driver icon jumped around the map, but food came on time.", None),
    ("survey", 3, "order_tracking", "Tracking is mostly accurate now, occasionally stuck.", None),
    # --- promo codes (4) : IMPROVED (was 10) ---
    ("app_store", 2, "promo_codes", "Promo code didn't work at checkout.", None),
    ("google_play", 3, "promo_codes", "The 20% off code applied this time, but only to the subtotal, not delivery. Fine I guess.", "mixed"),
    ("support", None, "promo_codes", "My referral credit never showed up in my account.", None),
    ("google_play", 2, "promo_codes", "Loyalty points promo expired before I could use it.", None),
    # --- RARE BUT SERIOUS: food allergy (1) ---
    ("support", None, "food_allergy", "I wrote 'severe peanut allergy - no peanuts please' in the order notes for my Thai order. The restaurant told me afterward they never saw any notes. My daughter had an allergic reaction and we had to use her EpiPen. Your special instructions are not reaching restaurants. This could kill someone.", "rare_urgent"),
    # --- praise (8) ---
    ("app_store", 5, "praise", "Order tracking is SO much better now, I can actually see the driver move!", "praise_of_fix"),
    ("app_store", 4, "praise", "Promo worked! First time in months. Saved $8.", "praise_of_fix"),
    ("google_play", 5, "praise", "Super fast delivery tonight, 20 minutes!", None),
    ("survey", 5, "praise", "Great app, I use it 3 times a week.", None),
    ("app_store", 5, "praise", "Driver went above and beyond, walked it up 4 flights of stairs.", None),
    ("google_play", 5, "praise", "Reorder button is the best feature.", None),
    ("survey", 4, "praise", "Good selection, fair prices on the weekday deals.", None),
    ("app_store", 4, "praise", "Easy to use and reliable.", None),
    # --- other (5) ---
    ("google_play", 4, "other", "Please add a dark mode!", None),
    ("support", None, "other", "How do I delete my account?", None),
    ("app_store", 4, "other", "Would love to be able to schedule orders a week ahead.", None),
    ("google_play", 1, "other", "asdfgh", "junk"),
    ("survey", 4, "other", "Is there a student discount?", None),
]


def pick_date(batch, theme):
    if batch == 1:
        return date(2026, 9, 1) + timedelta(days=random.randint(0, 29))
    if theme == "rating_screen_bug":   # bug starts with update 5.2 on Oct 8
        return date(2026, 10, 8) + timedelta(days=random.randint(0, 19))
    if theme == "order_tracking":      # leftover tracking complaints, early in the month
        return date(2026, 10, 1) + timedelta(days=random.randint(0, 11))
    if theme == "food_allergy":
        return date(2026, 10, 21)
    return date(2026, 10, 1) + timedelta(days=random.randint(0, 26))


def build(batch_num, rows):
    out = []
    for source, stars, theme, text, tricky in rows:
        out.append({"date": pick_date(batch_num, theme), "source": source, "stars": stars,
                    "theme": theme, "text": text, "tricky": tricky})
    out.sort(key=lambda r: r["date"])
    for i, r in enumerate(out, 1):
        r["id"] = f"B{batch_num}-{i:03d}"
    return out


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "date", "source", "text", "star_rating"])
        for r in rows:
            w.writerow([r["id"], r["date"].isoformat(), r["source"], r["text"],
                        "" if r["stars"] is None else r["stars"]])


def main():
    assert len(BATCH1) == 60 and len(BATCH2) == 60, (len(BATCH1), len(BATCH2))
    b1, b2 = build(1, BATCH1), build(2, BATCH2)
    OUT.mkdir(exist_ok=True)
    write_csv(OUT / "quickbite_batch1_sep2026.csv", b1)
    write_csv(OUT / "quickbite_batch2_oct2026.csv", b2)

    c1, c2 = Counter(r["theme"] for r in b1), Counter(r["theme"] for r in b2)

    def trend(t):
        a, b = c1[t], c2[t]
        if a == 0 and b > 0:
            return "new"
        if b <= a * 0.6:
            return "improved"
        if b >= a * 1.4:
            return "worse"
        return "stable"

    allergy = next(r for r in b2 if r["theme"] == "food_allergy")
    key = {
        "themes": [
            {"theme": t, "label": THEMES[t], "batch1_count": c1[t], "batch2_count": c2[t], "trend": trend(t)}
            for t in THEMES
        ],
        "top3_this_month": ["rating_screen_bug", "checkout_payment", "late_cold"],
        "top3_last_month": ["order_tracking", "checkout_payment", "promo_codes"],
        "new_problem": "rating_screen_bug",
        "improved": ["order_tracking", "promo_codes"],
        "urgent_flag": {"theme": "food_allergy", "id": allergy["id"],
                        "why": "Safety risk: allergy notes in special instructions never reach the restaurant. One report, but must be escalated immediately regardless of volume."},
        "tricky_cases": [
            {"id": r["id"], "tag": r["tricky"], "true_theme": r["theme"], "stars": r["stars"], "text": r["text"]}
            for r in b1 + b2 if r["tricky"]
        ],
        "labels": {r["id"]: r["theme"] for r in b1 + b2},
    }
    (OUT / "answer_key.json").write_text(json.dumps(key, indent=2, ensure_ascii=False), encoding="utf-8")

    # Human-readable version
    lines = ["# QuickBite Answer Key", "",
             "What a correct analysis should find. Do NOT show this file to the agent.", "",
             "## Themes (count last month -> this month)", "",
             "| Theme | Sep (batch 1) | Oct (batch 2) | Trend |", "|---|---|---|---|"]
    for t in key["themes"]:
        lines.append(f"| {t['label']} | {t['batch1_count']} | {t['batch2_count']} | {t['trend']} |")
    lines += ["", "## Top 3 issues THIS month (batch 2)", "",
              "1. **Rating & tip screen bug**: NEW since update 5.2 (Oct 8). Blocks ordering and adds unwanted tips.",
              "2. **Checkout & payment failures**: still big, and costs customers money (double charges).",
              "3. **Late or cold deliveries**: unchanged month over month.", "",
              "Passing grade: the agent's top 3 contains these three themes (order 1 and 2 may swap).", "",
              "## Last month's top 3 (batch 1)", "",
              "1. Order tracking  2. Checkout & payment  3. Promo codes", "",
              "## Trends the agent should notice", "",
              "- **New:** rating & tip screen bug (0 -> 13)",
              "- **Improved:** order tracking (14 -> 5), promo codes (10 -> 4)",
              "- **Stable:** late/cold (8 -> 8), missing/wrong items (6 -> 6)", "",
              f"## URGENT flag: {allergy['id']}", "",
              f"> {allergy['text']}", "",
              key["urgent_flag"]["why"],
              "Weak supporting signals (special instructions ignored): " +
              ", ".join(r["id"] for r in b1 + b2 if r["tricky"] == "special_instructions_signal") + ".", "",
              "## Tricky cases", "", "| ID | Trick | Stars | True theme | Text |", "|---|---|---|---|---|"]
    for t in key["tricky_cases"]:
        stars = "" if t["stars"] is None else t["stars"]
        lines.append(f"| {t['id']} | {t['tag']} | {stars} | {t['true_theme']} | {t['text']} |")
    (OUT / "ANSWER_KEY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("Batch 1:", dict(c1))
    print("Batch 2:", dict(c2))
    print("Urgent:", allergy["id"])


if __name__ == "__main__":
    main()
