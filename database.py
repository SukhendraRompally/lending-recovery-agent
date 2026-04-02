"""Mock database — 10 customers across 7 timezones for 24/7 demo coverage."""

# UTC offsets chosen so at ANY time of day, 3-5 customers are always in the
# legal contact window (08:00–21:00 local time):
#
#  UTC+10  Sydney   →  legal window = 22:00–11:00 UTC
#  UTC+9   Tokyo    →  legal window = 23:00–12:00 UTC
#  UTC+5.5 India    →  legal window = 02:30–15:30 UTC
#  UTC+4   Dubai    →  legal window = 04:00–17:00 UTC
#  UTC+2   Europe   →  legal window = 06:00–19:00 UTC
#  UTC-4   US East  →  legal window = 12:00–01:00 UTC
#  UTC-7   US West  →  legal window = 15:00–04:00 UTC

CUSTOMERS = {
    # ── Supportive Partner ────────────────────────────────────────────────────
    # (high loyalty, 1st delinquency)
    "CUST_001": {
        "id": "CUST_001",
        "name": "Margaret Thompson",
        "age": 52,
        "loan_id": "LN-8842",
        "debt_amount": 500.00,
        "currency": "USD",
        "delinquency_count": 1,
        "delinquency_label": "1st delinquency",
        "tenure_years": 10,
        "loyalty": "high",
        "ltv_segment": "high_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "US",
        "timezone": "US/Eastern (UTC-4)",
        "utc_offset": -4,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "10-year loyal customer, first ever missed payment. Recently widowed — income disruption likely temporary.",
    },
    "CUST_004": {
        "id": "CUST_004",
        "name": "Oliver Bennett",
        "age": 44,
        "loan_id": "LN-2219",
        "debt_amount": 750.00,
        "currency": "GBP",
        "delinquency_count": 1,
        "delinquency_label": "1st delinquency",
        "tenure_years": 7,
        "loyalty": "high",
        "ltv_segment": "high_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "UK",
        "timezone": "Europe/London (UTC+1)",
        "utc_offset": 1,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "Long-standing UK customer, first missed payment in 7 years. Recently switched jobs — short-term cash flow issue.",
    },
    "CUST_007": {
        "id": "CUST_007",
        "name": "Carlos Reyes",
        "age": 38,
        "loan_id": "LN-5503",
        "debt_amount": 320.00,
        "currency": "USD",
        "delinquency_count": 1,
        "delinquency_label": "1st delinquency",
        "tenure_years": 12,
        "loyalty": "high",
        "ltv_segment": "high_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "US",
        "timezone": "US/Pacific (UTC-7)",
        "utc_offset": -7,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "Longest-tenured customer (12 yrs), small balance, first delinquency. Said to travel frequently for work.",
    },
    "CUST_010": {
        "id": "CUST_010",
        "name": "Sophie Chen",
        "age": 35,
        "loan_id": "LN-9981",
        "debt_amount": 450.00,
        "currency": "AUD",
        "delinquency_count": 1,
        "delinquency_label": "1st delinquency",
        "tenure_years": 8,
        "loyalty": "high",
        "ltv_segment": "high_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "AU",
        "timezone": "Australia/Sydney (UTC+10)",
        "utc_offset": 10,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "Premium customer with excellent repayment history until this month. Mentioned parental leave starting soon.",
    },

    # ── Formal Officer ────────────────────────────────────────────────────────
    # (low loyalty OR 3rd+ delinquency)
    "CUST_002": {
        "id": "CUST_002",
        "name": "Jordan Rivera",
        "age": 28,
        "loan_id": "LN-3391",
        "debt_amount": 2000.00,
        "currency": "USD",
        "delinquency_count": 3,
        "delinquency_label": "3rd delinquency",
        "tenure_years": 0.5,
        "loyalty": "low",
        "ltv_segment": "low_ltv",
        "contact_attempts_today": 1,
        "jurisdiction": "US",
        "timezone": "US/Central (UTC-5)",
        "utc_offset": -5,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "New customer (6 months), three consecutive missed payments, no response to prior calls or emails.",
    },
    "CUST_005": {
        "id": "CUST_005",
        "name": "Aisha Al-Rashidi",
        "age": 31,
        "loan_id": "LN-7714",
        "debt_amount": 4500.00,
        "currency": "USD",
        "delinquency_count": 3,
        "delinquency_label": "3rd delinquency",
        "tenure_years": 1.0,
        "loyalty": "low",
        "ltv_segment": "low_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "UAE",
        "timezone": "Asia/Dubai (UTC+4)",
        "utc_offset": 4,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "Dubai-based client, high balance, three missed payments. Previous agent noted tone was dismissive. Escalation risk.",
    },
    "CUST_008": {
        "id": "CUST_008",
        "name": "Hiroshi Tanaka",
        "age": 42,
        "loan_id": "LN-4420",
        "debt_amount": 7500.00,
        "currency": "USD",
        "delinquency_count": 4,
        "delinquency_label": "4th delinquency",
        "tenure_years": 0.75,
        "loyalty": "low",
        "ltv_segment": "low_ltv",
        "contact_attempts_today": 2,
        "jurisdiction": "JP",
        "timezone": "Asia/Tokyo (UTC+9)",
        "utc_offset": 9,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "Highest risk account. Four missed payments on a large balance. Only 9 months as customer. Near escalation threshold.",
    },

    # ── Balanced Advisor ──────────────────────────────────────────────────────
    # (medium loyalty, 2nd delinquency)
    "CUST_003": {
        "id": "CUST_003",
        "name": "Priya Nair",
        "age": 39,
        "loan_id": "LN-6675",
        "debt_amount": 1200.00,
        "currency": "USD",
        "delinquency_count": 2,
        "delinquency_label": "2nd delinquency",
        "tenure_years": 3,
        "loyalty": "medium",
        "ltv_segment": "mid_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "IN",
        "timezone": "Asia/Kolkata (UTC+5.5)",
        "utc_offset": 5.5,
        "preferred_language": "en",
        "hardship_flag": True,
        "notes": "Mid-tenure customer. Second delinquency. Self-reported financial hardship last quarter due to medical expenses.",
    },
    "CUST_006": {
        "id": "CUST_006",
        "name": "Lena Müller",
        "age": 47,
        "loan_id": "LN-1138",
        "debt_amount": 2800.00,
        "currency": "EUR",
        "delinquency_count": 2,
        "delinquency_label": "2nd delinquency",
        "tenure_years": 4,
        "loyalty": "medium",
        "ltv_segment": "mid_ltv",
        "contact_attempts_today": 0,
        "jurisdiction": "DE",
        "timezone": "Europe/Berlin (UTC+2)",
        "utc_offset": 2,
        "preferred_language": "en",
        "hardship_flag": True,
        "notes": "Germany-based. Second missed payment. Hardship flag raised — sole carer for elderly parent, reduced working hours.",
    },
    "CUST_009": {
        "id": "CUST_009",
        "name": "Zanele Dlamini",
        "age": 33,
        "loan_id": "LN-8867",
        "debt_amount": 1600.00,
        "currency": "USD",
        "delinquency_count": 2,
        "delinquency_label": "2nd delinquency",
        "tenure_years": 2,
        "loyalty": "medium",
        "ltv_segment": "mid_ltv",
        "contact_attempts_today": 1,
        "jurisdiction": "ZA",
        "timezone": "Africa/Johannesburg (UTC+2)",
        "utc_offset": 2,
        "preferred_language": "en",
        "hardship_flag": False,
        "notes": "South Africa-based. Second delinquency. Prior agent call was polite but inconclusive — customer said she'd call back but didn't.",
    },
}

# Hardcoded RAG knowledge base — Bank Hardship & Recovery Policy
BANK_HARDSHIP_POLICY = """
GREENLEAF BANK — CUSTOMER HARDSHIP & DEBT RECOVERY POLICY (v4.2)

1. PAYMENT DEFERRAL PROGRAM
   Eligible customers may apply for a 1-to-3-month payment deferral. Interest continues to accrue
   but no late fees are charged during the approved deferral window. Customers must complete a
   Hardship Declaration Form (HDF-7) within 5 business days of verbal/written agreement.

2. STRUCTURED REPAYMENT PLAN
   We offer repayment plans of 3, 6, or 12 months. A minimum payment of 10% of the outstanding
   balance is required to activate the plan. No additional origination fees are applied.

3. INTEREST RATE REDUCTION
   For accounts 30-60 days overdue, the bank may reduce the effective interest rate by up to 2%
   for the duration of the repayment plan upon request and credit committee approval.

4. DEBT SETTLEMENT OPTION
   For accounts over 90 days delinquent with low recovery probability, the bank may offer a
   one-time lump-sum settlement at 70-85% of the outstanding principal. This closes the account
   and is reported to credit bureaus as "Settled."

5. CREDIT COUNSELLING REFERRAL
   Customers in severe distress are referred at no cost to the National Foundation for Credit
   Counselling (NFCC) or equivalent certified non-profit agencies.

6. CONTACT & COMPLIANCE RULES
   - Contact hours: 8:00 AM to 9:00 PM customer's local time (FDCPA / Reg F compliant).
   - Maximum 3 contact attempts per day per customer.
   - Harassment, threats, or deceptive statements are strictly prohibited.
   - All calls must be recorded with prior disclosure; written follow-up sent within 24 hours.

7. ESCALATION PATH
   After 3 failed contact attempts over 5 business days → escalate to Senior Recovery Officer.
   After 30 days no resolution → refer to third-party collections agency with full Transfer Memo.
"""
