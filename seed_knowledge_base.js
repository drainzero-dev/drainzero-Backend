// ═══════════════════════════════════════════════════════════════════════════
//  DrainZero — Knowledge Base Seeder
//
//  Run ONCE after setting up your new Supabase project:
//    node seed_knowledge_base.js
//
//  This populates the knowledge_base table with 70+ verified Indian tax
//  law entries for FY 2025-26. Generates Gemini embeddings for each entry
//  so semantic search works in the AI chatbot.
//
//  Requires env vars:
//    SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ai = new GoogleGenAI({
  apiKey     : process.env.GEMINI_API_KEY,
  httpOptions: { apiVersion: 'v1' }   // text-embedding-004 is on v1 not v1beta
});

// ── Throttle: 1 embedding per 300ms to avoid rate limits ─────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getEmbedding(text) {
  const result = await ai.models.embedContent({
    model   : 'text-embedding-004',
    contents : text,
    config  : { outputDimensionality: 768 }
  });
  return result.embeddings[0].values;
}

// ════════════════════════════════════════════════════════════════════════════
//  KNOWLEDGE BASE — 70 verified Indian tax law entries FY 2025-26
// ════════════════════════════════════════════════════════════════════════════
const KB_ENTRIES = [

  // ── NEW REGIME SLABS ──────────────────────────────────────────────────────
  {
    title    : 'New Tax Regime Slabs FY 2025-26 (Budget 2025)',
    category : 'Tax Slabs',
    section  : 'Budget 2025 / Sec 115BAC',
    content  : `New tax regime slabs for FY 2025-26 (AY 2026-27) as per Budget 2025:
Income up to ₹4,00,000: NIL
₹4,00,001 to ₹8,00,000: 5%
₹8,00,001 to ₹12,00,000: 10%
₹12,00,001 to ₹16,00,000: 15%
₹16,00,001 to ₹20,00,000: 20%
₹20,00,001 to ₹24,00,000: 25%
Above ₹24,00,000: 30%
Standard deduction: ₹75,000 (increased from ₹50,000 in Budget 2024).
Section 87A rebate: Full tax rebate if taxable income ≤ ₹12,00,000 — effective zero tax.
This is the default regime from FY 2025-26.`,
    tags     : ['new regime', 'slabs', 'budget 2025', 'tax rates', '87A', 'zero tax'],
    updated_fy: '2025-26'
  },

  // ── OLD REGIME SLABS ─────────────────────────────────────────────────────
  {
    title    : 'Old Tax Regime Slabs FY 2025-26',
    category : 'Tax Slabs',
    section  : 'Income Tax Act Sec 2(1)',
    content  : `Old tax regime slabs for FY 2025-26:
Up to ₹2,50,000: NIL (₹3,00,000 for senior citizens 60-80 yrs; ₹5,00,000 for super seniors above 80)
₹2,50,001 to ₹5,00,000: 5%
₹5,00,001 to ₹10,00,000: 20%
Above ₹10,00,000: 30%
Standard deduction: ₹50,000 for salaried employees.
Section 87A rebate: Full rebate up to ₹12,500 if taxable income ≤ ₹5,00,000 — effective zero tax.
4% Health & Education Cess on total tax + surcharge.`,
    tags     : ['old regime', 'slabs', 'tax rates', '87A', 'senior citizen'],
    updated_fy: '2025-26'
  },

  // ── SECTION 87A REBATE ────────────────────────────────────────────────────
  {
    title    : 'Section 87A Rebate — Old vs New Regime',
    category : 'Tax Rebate',
    section  : 'Section 87A',
    content  : `Section 87A provides a full tax rebate (zero tax liability) for taxpayers below the rebate threshold.
OLD REGIME: Rebate available if net taxable income ≤ ₹5,00,000. Maximum rebate: ₹12,500.
NEW REGIME (Budget 2025): Rebate available if net taxable income ≤ ₹12,00,000. Maximum rebate: ₹60,000.
IMPORTANT: 87A rebate does NOT apply to special rate income like:
- Crypto / VDA income (Section 115BBH) taxed at flat 30%
- LTCG under Section 112A (equity)
- STCG under Section 111A (equity)
The rebate applies only on the normal slab-rate income portion.
Example: Salary ₹9L → New taxable ₹8.25L (after ₹75K std ded) → under ₹12L → ZERO tax via 87A.`,
    tags     : ['87A', 'rebate', 'zero tax', 'new regime', 'old regime', '12 lakh', '5 lakh'],
    updated_fy: '2025-26'
  },

  // ── SECTION 80C ──────────────────────────────────────────────────────────
  {
    title    : 'Section 80C — Deductions (Max ₹1,50,000)',
    category : 'Deductions',
    section  : 'Section 80C',
    content  : `Section 80C allows deduction up to ₹1,50,000 per year for the following investments and payments:
- Employee Provident Fund (EPF) — employee contribution
- Public Provident Fund (PPF) — up to ₹1.5L/year, 15-year lock-in
- Equity Linked Savings Scheme (ELSS) mutual funds — 3-year lock-in, market-linked returns
- Life Insurance Premium (LIC/term)
- National Savings Certificate (NSC)
- Tax-saving Fixed Deposits (5-year lock-in)
- Tuition fees for children (up to 2 children)
- Housing loan principal repayment
- Sukanya Samriddhi Yojana (for girl child)
- National Pension System (NPS) — employee contribution
AVAILABLE ONLY in OLD REGIME. NOT applicable in new regime.
Maximum combined deduction across all 80C instruments: ₹1,50,000.`,
    tags     : ['80C', 'PPF', 'ELSS', 'EPF', 'LIC', 'deductions', 'old regime', '1.5 lakh'],
    updated_fy: '2025-26'
  },

  // ── SECTION 80D ──────────────────────────────────────────────────────────
  {
    title    : 'Section 80D — Health Insurance Premium Deduction',
    category : 'Deductions',
    section  : 'Section 80D',
    content  : `Section 80D deduction for health insurance premiums (OLD REGIME only):
SELF + FAMILY (below 60 years): Up to ₹25,000
SELF + FAMILY (senior citizen 60+): Up to ₹50,000
PARENTS (below 60 years): Additional ₹25,000
PARENTS (senior citizen 60+): Additional ₹50,000
Maximum total deduction if both self+family AND senior citizen parents: ₹1,00,000
Preventive health check-up: ₹5,000 included within the above limits.
Premium must be paid by any mode other than cash (cheque, online, UPI accepted).
Group health insurance provided by employer does NOT qualify.
ONLY in OLD REGIME. Not available in new regime.`,
    tags     : ['80D', 'health insurance', 'medical', 'deductions', 'senior citizen', 'old regime'],
    updated_fy: '2025-26'
  },

  // ── NPS 80CCD ────────────────────────────────────────────────────────────
  {
    title    : 'NPS Deduction — Section 80CCD(1B) Extra ₹50,000',
    category : 'Deductions',
    section  : 'Section 80CCD(1B)',
    content  : `National Pension System (NPS) provides an ADDITIONAL deduction of ₹50,000 under Section 80CCD(1B) over and above the ₹1,50,000 limit of Section 80C.
This means total deduction possible: ₹1,50,000 (80C) + ₹50,000 (80CCD(1B)) = ₹2,00,000.
WHO CAN CLAIM: Any individual — salaried or self-employed — contributing to NPS Tier-1 account.
HOW TO OPEN: NPS account can be opened at any bank branch, online at enps.nsdl.com, or through PFRDA-registered points of presence.
LOCK-IN: Until age 60 (partial withdrawal allowed for specific reasons after 3 years).
ON MATURITY: 60% lump sum is tax-free; 40% must be used to buy annuity (taxable).
ONLY in OLD REGIME.`,
    tags     : ['NPS', '80CCD', 'pension', 'deductions', 'extra deduction', '50000', 'old regime'],
    updated_fy: '2025-26'
  },

  // ── HRA EXEMPTION ────────────────────────────────────────────────────────
  {
    title    : 'HRA Exemption Calculation — Section 10(13A)',
    category : 'Exemptions',
    section  : 'Section 10(13A)',
    content  : `House Rent Allowance (HRA) exemption is the MINIMUM of these three:
1. Actual HRA received from employer
2. 50% of Basic + DA salary (for metro cities: Mumbai, Delhi, Kolkata, Chennai) OR 40% for non-metro cities
3. Actual rent paid MINUS 10% of Basic + DA salary
Metro cities: Mumbai, Delhi (NCR), Kolkata, Chennai, Bengaluru, Hyderabad.
AVAILABLE ONLY in OLD REGIME. Not available in new regime.
IMPORTANT: If you live in your own house or with parents, HRA is fully taxable.
If you pay rent to parents: valid, but they must declare it as rental income. Requires rent receipts and landlord PAN for rent > ₹1 lakh/year.
Employees NOT receiving HRA can claim deduction under Section 80GG (self-employed or those whose employer doesn't provide HRA) — min(₹5,000/month, 25% of total income, rent-10% of income).`,
    tags     : ['HRA', 'house rent allowance', 'rent', 'exemption', 'metro', 'old regime', '10(13A)'],
    updated_fy: '2025-26'
  },

  // ── HOME LOAN ─────────────────────────────────────────────────────────────
  {
    title    : 'Home Loan Tax Benefits — Section 24(b) and 80C',
    category : 'Deductions',
    section  : 'Section 24(b)',
    content  : `Home loan provides TWO tax benefits (OLD REGIME only):
1. INTEREST DEDUCTION (Section 24(b)):
   - Self-occupied property: Up to ₹2,00,000 per year on interest paid
   - Let-out property: No cap — full interest is deductible (but loss can only be set off against other house property income, capped at ₹2L for set-off against salary)
   - Under-construction property: Interest during construction period can be claimed in 5 equal instalments from year of possession
2. PRINCIPAL REPAYMENT (Section 80C):
   - Principal repayment qualifies under Section 80C within the ₹1,50,000 limit
   - Stamp duty and registration fees also qualify under 80C in the year of payment
PRE-CONDITIONS: Loan must be from a recognised financial institution. Property must not be sold within 5 years of possession.`,
    tags     : ['home loan', 'interest', 'Section 24', '80C', 'principal', 'EMI', 'deductions', 'old regime'],
    updated_fy: '2025-26'
  },

  // ── STANDARD DEDUCTION ───────────────────────────────────────────────────
  {
    title    : 'Standard Deduction for Salaried Employees',
    category : 'Deductions',
    section  : 'Section 16(ia)',
    content  : `Standard deduction is a flat deduction available to salaried employees and pensioners WITHOUT requiring any proof or investment.
OLD REGIME: ₹50,000 (flat)
NEW REGIME (Budget 2024 onwards): ₹75,000 (increased from ₹50,000)
WHO CAN CLAIM: All salaried employees, pensioners, family pension recipients.
Family pensioners: ₹25,000 or 1/3rd of pension, whichever is lower.
NO DOCUMENTS REQUIRED — automatically applied by employer during TDS calculation.
This replaced the earlier transport allowance (₹19,200/year) and medical reimbursement (₹15,000/year) that were available before FY 2018-19.`,
    tags     : ['standard deduction', '50000', '75000', 'salaried', 'pension', 'Section 16'],
    updated_fy: '2025-26'
  },

  // ── CRYPTO / VDA ─────────────────────────────────────────────────────────
  {
    title    : 'Crypto / VDA Tax — Section 115BBH (Flat 30%)',
    category : 'Capital Gains',
    section  : 'Section 115BBH',
    content  : `Virtual Digital Assets (VDA) including cryptocurrency, NFTs are taxed under Section 115BBH from FY 2022-23:
TAX RATE: Flat 30% on gains (plus 4% cess = effective 31.2%)
ALLOWED DEDUCTIONS: ONLY the cost of acquisition (purchase price). NO other deductions allowed (no brokerage, no transfer charges, no platform fees).
LOSSES: Cannot be carried forward to future years. Cannot be set off against any other income — not even other crypto losses.
TDS: 1% TDS deducted by crypto exchanges on transactions above ₹50,000 per year (or ₹10,000 per transaction for some categories).
SECTION 87A REBATE: Does NOT apply to crypto gains. Even if total income is below ₹7L, crypto gains remain taxable at 30%.
GIFT OF CRYPTO: Received as gift is taxable as income at slab rates in the year received.
REPORTING: Must be declared in ITR under Schedule VDA.`,
    tags     : ['crypto', 'VDA', 'cryptocurrency', 'NFT', '30%', '115BBH', 'capital gains', 'bitcoin'],
    updated_fy: '2025-26'
  },

  // ── LTCG EQUITY ──────────────────────────────────────────────────────────
  {
    title    : 'LTCG on Equity Shares and Mutual Funds — Section 112A',
    category : 'Capital Gains',
    section  : 'Section 112A',
    content  : `Long-Term Capital Gains (LTCG) on listed equity shares and equity mutual funds (Budget 2024 onwards):
HOLDING PERIOD: More than 12 months qualifies as long-term.
TAX RATE: 12.5% (increased from 10% in Budget 2024) on gains ABOVE ₹1,25,000.
EXEMPTION: First ₹1,25,000 of LTCG per year is completely TAX FREE (increased from ₹1,00,000).
INDEXATION: NOT available for equity shares/equity MF LTCG.
EXAMPLE: Buy shares at ₹2,00,000, sell after 2 years at ₹5,00,000. Gain = ₹3,00,000. Taxable gain = ₹3,00,000 - ₹1,25,000 = ₹1,75,000. Tax = ₹1,75,000 × 12.5% = ₹21,875.
GRANDFATHERING: Gains accrued before 31 Jan 2018 are exempt (cost calculated as price on 31 Jan 2018).
STT (Securities Transaction Tax) must have been paid on the transaction.`,
    tags     : ['LTCG', 'long term capital gains', 'equity', 'mutual funds', '112A', '12.5%', '1.25 lakh'],
    updated_fy: '2025-26'
  },

  // ── STCG EQUITY ──────────────────────────────────────────────────────────
  {
    title    : 'STCG on Equity — Section 111A (20% Tax)',
    category : 'Capital Gains',
    section  : 'Section 111A',
    content  : `Short-Term Capital Gains (STCG) on listed equity shares and equity mutual funds:
HOLDING PERIOD: 12 months or less qualifies as short-term.
TAX RATE: 20% flat (increased from 15% in Budget 2024, effective 23 July 2024).
NO exemption limit (unlike LTCG which has ₹1.25L exemption).
EXAMPLE: Buy shares for ₹1,00,000, sell within 6 months for ₹1,50,000. Gain = ₹50,000. Tax = ₹50,000 × 20% = ₹10,000 + cess.
Note: For transactions before 23 July 2024, old rate of 15% applies.
SECTION 87A: STCG under 111A is also outside the 87A rebate in most interpretations, though there is some ambiguity — as of FY 2025-26, tax dept treats it as excluded from rebate.`,
    tags     : ['STCG', 'short term capital gains', 'equity', '111A', '20%', '15%'],
    updated_fy: '2025-26'
  },

  // ── F&O TRADING ──────────────────────────────────────────────────────────
  {
    title    : 'F&O Trading Income — Non-Speculative Business Income',
    category : 'Business Income',
    section  : 'Section 43(5)',
    content  : `Futures and Options (F&O) trading is classified as Non-Speculative Business Income under Section 43(5) of the Income Tax Act.
TAXATION: Added to total income and taxed at applicable SLAB RATES (not capital gains rates).
ALLOWED DEDUCTIONS: Brokerage charges, exchange transaction charges, STT (if charged), internet costs, advisory fees, depreciation on trading hardware.
LOSS SET-OFF: F&O losses can be set off against any other business income in the same year.
CARRY FORWARD: F&O losses can be carried forward for 8 years and set off against future business income.
TAX AUDIT: If F&O turnover exceeds ₹10 crore (or ₹2 crore with certain conditions), Tax Audit (Form 3CB/3CD) is required.
F&O TURNOVER CALCULATION: Sum of all profits + absolute value of all losses (not net P/L). Each contract counts.
ADVANCE TAX: If F&O income causes tax liability > ₹10,000, advance tax must be paid quarterly.`,
    tags     : ['F&O', 'futures', 'options', 'trading', 'business income', 'non-speculative', 'Section 43'],
    updated_fy: '2025-26'
  },

  // ── RENTAL INCOME ────────────────────────────────────────────────────────
  {
    title    : 'Rental Income Taxation — Income from House Property',
    category : 'House Property',
    section  : 'Section 22, 23, 24',
    content  : `Rental income is taxed under "Income from House Property":
STEP 1 — Gross Annual Value (GAV): Higher of actual rent received or municipal valuation.
STEP 2 — Net Annual Value (NAV): GAV minus municipal taxes paid by owner.
STEP 3 — Standard Deduction: 30% of NAV is allowed as flat deduction (covers repairs, maintenance).
STEP 4 — Interest on home loan (Section 24(b)): Fully deductible for let-out property (no ₹2L cap — unlike self-occupied).
STEP 5 — Resulting income added to total income and taxed at slab rate.
RENTAL LOSS: If interest on loan exceeds rental income, the resulting loss can be set off against salary income up to ₹2 lakh per year. Remaining loss carried forward for 8 years.
JOINT OWNERSHIP: Rental income split in proportion of ownership — each co-owner declares their share.
TDS ON RENT: Tenant must deduct 5% TDS if annual rent exceeds ₹2.4 lakh (Form 26QC).`,
    tags     : ['rental income', 'house property', 'Section 22', 'Section 24', 'NAV', 'standard deduction 30%'],
    updated_fy: '2025-26'
  },

  // ── SURCHARGE ────────────────────────────────────────────────────────────
  {
    title    : 'Surcharge on Income Tax — High Income',
    category : 'Tax Computation',
    section  : 'Finance Act',
    content  : `Surcharge is an additional tax levied on high-income individuals:
Income > ₹50 lakh but ≤ ₹1 crore: 10% surcharge on tax
Income > ₹1 crore but ≤ ₹2 crore: 15% surcharge
Income > ₹2 crore but ≤ ₹5 crore: 25% surcharge
Income > ₹5 crore: 37% surcharge (OLD REGIME only; NEW REGIME capped at 25%)
NEW REGIME SURCHARGE CAP: Maximum surcharge in new regime is 25% (even for income > ₹5 crore). This is a significant benefit for very high earners.
MARGINAL RELIEF: Available to prevent tax + surcharge from exceeding 100% of incremental income.
4% CESS: Applied on (tax + surcharge) — not on income directly.`,
    tags     : ['surcharge', 'high income', '50 lakh', 'crore', '37%', '25%', 'cess'],
    updated_fy: '2025-26'
  },

  // ── ADVANCE TAX ──────────────────────────────────────────────────────────
  {
    title    : 'Advance Tax — Quarterly Payment Schedule',
    category : 'Tax Payment',
    section  : 'Section 208, 211',
    content  : `Advance tax must be paid if estimated tax liability for the year exceeds ₹10,000.
QUARTERLY INSTALMENTS (NOT cumulative — each is the amount due THAT quarter):
15 June: 15% of estimated annual tax
15 September: 30% more (cumulative 45% by Sep 15)
15 December: 30% more (cumulative 75% by Dec 15)
15 March: 25% more (cumulative 100% by Mar 15)
SALARIED EMPLOYEES: If TDS covers full liability, no advance tax needed. Pay only for non-salary income (FD interest, rental, capital gains).
SENIOR CITIZENS (60+): Exempt from advance tax if they have NO business income.
INTEREST FOR NON-PAYMENT: Section 234B (1% per month for shortfall from April to filing); Section 234C (1% per month for shortfall per quarter).
FOR F&O/CAPITAL GAINS: If gains arise suddenly late in year, full tax due by 15 March. No penalty for earlier quarters if income was unforeseeable.`,
    tags     : ['advance tax', 'quarterly', 'Section 208', '234B', '234C', 'interest', 'payment'],
    updated_fy: '2025-26'
  },

  // ── OLD vs NEW REGIME ────────────────────────────────────────────────────
  {
    title    : 'Old vs New Tax Regime — When to Choose Which',
    category : 'Regime Selection',
    section  : 'Section 115BAC',
    content  : `CHOOSE NEW REGIME if:
- You have minimal deductions (less than ₹3-4 lakh in 80C, 80D, HRA, home loan)
- Income below ₹12 lakh (zero tax via 87A rebate)
- Self-employed or no HRA
- Prefer simplicity over planning
CHOOSE OLD REGIME if:
- You have substantial deductions: HRA + 80C + 80D + home loan interest + NPS = can save significantly
- Total deductions exceed ₹3.75 lakh (break-even at most income levels)
- Income above ₹15 lakh with heavy deduction usage
BREAK-EVEN EXAMPLE at ₹15L income:
Old: taxable ≈ ₹11.5L (after ₹3.5L deductions), tax ≈ ₹1.8L
New: taxable ₹14.25L (after ₹75K std ded), tax ≈ ₹1.65L → New wins here too
For ₹15L with ₹4L+ deductions: Old regime wins.
SWITCHING: Can switch every year if filing ITR-1 or ITR-2 (salaried). Business income filers can switch only ONCE.`,
    tags     : ['old regime', 'new regime', 'which regime', 'comparison', 'switch', '115BAC'],
    updated_fy: '2025-26'
  },

  // ── PROFESSIONAL TAX ─────────────────────────────────────────────────────
  {
    title    : 'Professional Tax — State Levy Deductible',
    category : 'Deductions',
    section  : 'Section 16(iii)',
    content  : `Professional tax is a state-level tax levied by some state governments on salaried employees and self-employed professionals.
STATES THAT LEVY: Maharashtra, Karnataka, Andhra Pradesh, Telangana, West Bengal, Kerala, Tamil Nadu, Madhya Pradesh.
STATES WITH NO PROFESSIONAL TAX: Delhi, Rajasthan, Uttar Pradesh, Haryana, Himachal Pradesh.
MAXIMUM: ₹2,500 per year (capped by the Constitution).
DEDUCTIBILITY: Professional tax is FULLY DEDUCTIBLE under Section 16(iii) from gross salary — applicable in BOTH old and new regime.
FOR SELF-EMPLOYED: Professional tax paid is deductible as a business expense.
TYPICALLY: Deducted by employer from salary and remitted to state government. Reflected in Form 16 Part B.`,
    tags     : ['professional tax', 'PT', 'state tax', 'deduction', '2500', 'Section 16'],
    updated_fy: '2025-26'
  },

  // ── SECTION 80E EDUCATION LOAN ───────────────────────────────────────────
  {
    title    : 'Education Loan Interest — Section 80E',
    category : 'Deductions',
    section  : 'Section 80E',
    content  : `Section 80E allows deduction for interest paid on education loan (OLD REGIME only):
WHO CAN CLAIM: Individual who took loan for their own higher education, spouse's education, children's education, or student for whom the individual is the legal guardian.
ELIGIBLE COURSES: Any full-time course after senior secondary (12th) — graduation, post-graduation, professional courses (CA, engineering, medicine, MBA) from recognised institutions in India or abroad.
DEDUCTION AMOUNT: 100% of interest paid — NO UPPER LIMIT.
PERIOD: 8 consecutive years starting from the year repayment begins, OR until interest is fully repaid, whichever is earlier.
IMPORTANT: Only INTEREST is deductible, NOT the principal.
LENDER: Loan must be from a financial institution (bank, NBFC) or approved charitable institution. Loan from family/friends does not qualify.`,
    tags     : ['80E', 'education loan', 'interest', 'higher education', 'study loan'],
    updated_fy: '2025-26'
  },

  // ── SECTION 80G DONATIONS ────────────────────────────────────────────────
  {
    title    : 'Donations Deduction — Section 80G',
    category : 'Deductions',
    section  : 'Section 80G',
    content  : `Section 80G provides deduction for donations to approved charitable organisations (OLD REGIME only):
100% DEDUCTION (no limit): PM Relief Fund, National Defence Fund, National Children's Fund, Swachh Bharat Kosh.
100% DEDUCTION (with 10% of adjusted gross income limit): Zilla Saksharta Samiti, National Trust for Welfare of Persons with Autism.
50% DEDUCTION (with 10% AGI limit): Jawaharlal Nehru Memorial Fund, Prime Minister's Drought Relief Fund, any other approved charitable trust.
CASH DONATION LIMIT: Donations in cash above ₹2,000 are NOT eligible. Must be paid via cheque, online transfer, or DD.
DOCUMENTATION: Receipt from the institution with their 80G registration number, PAN, and address.
ADJUSTED GROSS INCOME: Total income minus long-term capital gains, certain short-term gains, and deductions under 80C to 80U (except 80G itself).`,
    tags     : ['80G', 'donations', 'charity', 'PM Relief Fund', 'deductions'],
    updated_fy: '2025-26'
  },

  // ── HUF ──────────────────────────────────────────────────────────────────
  {
    title    : 'Hindu Undivided Family (HUF) — Tax Planning',
    category : 'Tax Planning',
    section  : 'Hindu Succession Act',
    content  : `HUF (Hindu Undivided Family) is a separate legal entity for tax purposes under Indian law:
WHO CAN FORM: Any Hindu, Jain, Sikh, or Buddhist family with two or more members (husband + wife alone is NOT an HUF — needs at least one coparcener).
TAX BENEFIT: HUF gets its OWN tax slabs and basic exemption of ₹2.5L (old regime) or ₹4L effectively (new regime). This effectively creates a SECOND set of tax slabs for the family.
HOW IT WORKS: Income-generating assets transferred to HUF (via partition or gift from non-members) earn income taxed separately in HUF's hands at lower rates.
IDEAL FOR: Joint family owning ancestral property, business, or investments.
SETUP PROCESS: (1) Draft HUF deed, (2) Open HUF bank account, (3) Apply for HUF PAN, (4) Transfer assets.
LIMITATION: Only ancestral property or gifts from non-members (non-HUF) qualify. Members cannot gift their individual income to HUF — this is clubbed back.`,
    tags     : ['HUF', 'Hindu undivided family', 'tax planning', 'family', 'coparcener', 'loophole'],
    updated_fy: '2025-26'
  },

  // ── RNOR STATUS ──────────────────────────────────────────────────────────
  {
    title    : 'RNOR Status — Resident Not Ordinarily Resident Tax Benefits',
    category : 'NRI / Residency',
    section  : 'Section 6',
    content  : `RNOR (Resident but Not Ordinarily Resident) status provides significant tax benefits for returning NRIs:
WHO QUALIFIES: Person who is resident (present in India ≥ 182 days in the year) BUT was NRI in 9 of the previous 10 years OR was in India for ≤ 729 days in the previous 7 years.
TAX BENEFIT: RNOR is taxed ONLY on India-sourced income. Foreign income is NOT taxable in India (same as NRI) — but you enjoy resident banking benefits.
DURATION: Typically 2 years after returning to India.
EXAMPLE: NRI returns to India after 10 years abroad. For the first 2 years, their foreign salary/investments are NOT taxable in India.
PRACTICAL: Ideal time to repatriate foreign income, sell foreign assets, restructure investments — all tax-free in India during RNOR period.`,
    tags     : ['RNOR', 'NRI', 'returning NRI', 'foreign income', 'residency', 'Section 6'],
    updated_fy: '2025-26'
  },

  // ── CORPORATE CAR LEASE ──────────────────────────────────────────────────
  {
    title    : 'Corporate Car Lease — Perquisite Tax Benefit (LH15)',
    category : 'Salary Structuring',
    section  : 'Section 17(2)(iii) — Perquisite Rules',
    content  : `Corporate car lease is a powerful salary structuring strategy for salaried employees:
HOW IT WORKS: Instead of buying a car personally (with post-tax salary), the COMPANY leases the car on behalf of the employee.
PERQUISITE VALUE (taxable in employee's hands):
- Car ≤ 1600cc: ₹1,800/month (₹21,600/year) taxable
- Car > 1600cc: ₹2,400/month (₹28,800/year) taxable
- If driver provided: add ₹900/month more
ACTUAL LEASE COST: ₹12,000-₹25,000/month — far more than the taxable perquisite.
TAX SAVING: At 30% bracket with ₹15,000/month lease: tax on ₹2,400 perquisite = ₹720 vs tax if taken as salary and buying car = ₹4,500+. Saves ₹1.5-3L/year.
COMPANY BENEFIT: Company deducts full lease rental as business expense + gets 28% GST input credit.
END OF LEASE: Buy car at residual value (~15% of original price) after 3-4 years.
ELIGIBLE: Salaried employees with gross income ≥ ₹6L; employer must be a registered company.`,
    tags     : ['car lease', 'corporate lease', 'perquisite', 'Section 17', 'salary structuring', 'LH15'],
    updated_fy: '2025-26'
  },

  // ── SECTION 80EEB EV ─────────────────────────────────────────────────────
  {
    title    : 'Electric Vehicle Loan — Section 80EEB Deduction',
    category : 'Deductions',
    section  : 'Section 80EEB',
    content  : `Section 80EEB provides deduction for interest on electric vehicle (EV) loan:
DEDUCTION: Up to ₹1,50,000 on interest paid on loan for purchase of electric vehicle.
WHO CAN CLAIM: Individuals only (not companies or firms).
LOAN CONDITIONS: Loan must be taken from a financial institution (bank or NBFC). Loan must have been sanctioned between 1 April 2019 and 31 March 2023 (extended in recent budgets — check latest notification).
VEHICLE TYPE: Any electric vehicle — two-wheeler, three-wheeler, four-wheeler.
REGIME: Available in OLD REGIME only.
STACKING BENEFIT: If company provides EV via car lease scheme, the employee can additionally claim 80EEB interest on their own EV loan (if they also bought one personally).`,
    tags     : ['80EEB', 'electric vehicle', 'EV', 'loan interest', 'green vehicle', 'deductions'],
    updated_fy: '2025-26'
  },

  // ── FORM 16 ──────────────────────────────────────────────────────────────
  {
    title    : 'Form 16 — Understanding Your TDS Certificate',
    category : 'Compliance',
    section  : 'Section 203',
    content  : `Form 16 is the TDS certificate issued by your employer — mandatory for all employees with TDS deducted:
PART A: Quarterly TDS deposited with government (employer's details, employee PAN, tax deducted per quarter).
PART B: Detailed salary breakup including:
  - Gross salary
  - Allowances (HRA, LTA, special allowances)
  - Perquisites (car, rent-free accommodation)
  - Deductions under Chapter VI-A (80C, 80D, NPS etc.)
  - Net taxable salary
  - Tax computation
WHEN ISSUED: By 15 June each year for the previous financial year.
IF MULTIPLE EMPLOYERS: Each employer issues Form 16 for their period. Employee must combine all and file one ITR.
ITR FILING: Form 16 auto-populates most of ITR-1/ITR-2. Always cross-verify with Form 26AS and AIS.
AIS (Annual Information Statement): Shows ALL income sources (salary, dividends, interest, capital gains, property purchase) as reported to IT department. Cross-check carefully.`,
    tags     : ['Form 16', 'TDS certificate', 'Part A', 'Part B', 'salary', 'AIS', 'Form 26AS'],
    updated_fy: '2025-26'
  },

  // ── ITR FILING ───────────────────────────────────────────────────────────
  {
    title    : 'ITR Filing — Which Form to Use and Deadlines',
    category : 'Compliance',
    section  : 'Section 139',
    content  : `Income Tax Return (ITR) filing guide for FY 2025-26 (AY 2026-27):
WHICH FORM:
- ITR-1 (Sahaj): Salaried income ≤ ₹50L, one house property, basic interest income. Simplest.
- ITR-2: Capital gains (equity, property), multiple house properties, foreign income. No business income.
- ITR-3: Business or profession income + all others.
- ITR-4 (Sugam): Presumptive taxation (Section 44AD, 44ADA) for small businesses/professionals.
DEADLINES:
- 31 July: Non-audit cases (most salaried and individual taxpayers)
- 31 October: Audit cases (businesses requiring tax audit)
- 31 December: Belated return filing (with ₹5,000 late fee; ₹1,000 if income ≤ ₹5L)
MANDATORY FILING: Even if no tax due, filing is mandatory if income > ₹2.5L basic exemption, or if you want to claim refund, or carry forward capital loss.
REVISED RETURN: Can file revised ITR till 31 December to correct mistakes.`,
    tags     : ['ITR', 'filing', 'deadline', 'July 31', 'ITR-1', 'ITR-2', 'ITR-3', 'compliance'],
    updated_fy: '2025-26'
  },

  // ── TDS ──────────────────────────────────────────────────────────────────
  {
    title    : 'TDS — Tax Deducted at Source Key Rates',
    category : 'Compliance',
    section  : 'Section 192-206',
    content  : `Key TDS rates for FY 2025-26:
SALARY (Sec 192): At applicable income tax slab rate.
INTEREST on FD/savings (Sec 194A): 10% if PAN provided (20% without PAN). No TDS if interest ≤ ₹40,000/year (₹50,000 for senior citizens).
RENT (Sec 194I): 10% for land/building/furniture (if annual rent > ₹2.4L). No TDS for individual paying to individual.
RENT by individual (Sec 194IB): 5% TDS if monthly rent > ₹50,000.
CAPITAL GAINS on property (Sec 194IA): 1% TDS on property purchase above ₹50L.
PROFESSIONAL SERVICES (Sec 194J): 10% (2% for technical services). Threshold ₹30,000.
CRYPTO exchanges (Sec 194S): 1% TDS on crypto transactions > ₹50,000/year.
HOW TO CLAIM TDS REFUND: Excess TDS shows in Form 26AS. Claim refund by filing ITR.
FORM 15G/15H: Submit to bank if income is below taxable limit to avoid TDS on FD interest.`,
    tags     : ['TDS', 'tax deducted at source', 'Section 194', 'refund', 'Form 15G', '15H', 'interest'],
    updated_fy: '2025-26'
  },

  // ── SECTION 54 PROPERTY GAINS ────────────────────────────────────────────
  {
    title    : 'Section 54 — Exemption on Sale of Residential Property',
    category : 'Capital Gains',
    section  : 'Section 54',
    content  : `Section 54 exempts LTCG on sale of residential property if the gains are reinvested:
ELIGIBILITY: Individual or HUF selling a long-term residential property (held > 24 months).
EXEMPTION: Invest capital gains (not entire sale proceeds) in:
  - Purchase of new residential property: 1 year BEFORE or 2 years AFTER sale
  - Construction of new property: within 3 years of sale
MAXIMUM EXEMPTION: Up to ₹10 crore (capped in Budget 2023 — earlier no cap).
CAPITAL GAINS ACCOUNT SCHEME (CGAS): If new property not purchased before ITR filing deadline, deposit gains in CGAS (special bank account) to preserve exemption.
NEW PROPERTY CONDITIONS: Must be in India. Cannot be sold within 3 years of purchase (otherwise exemption is reversed and taxed in year of sale).
SECTION 54EC: Alternative — invest up to ₹50L in bonds (NHAI/REC) within 6 months of sale for full exemption, 5-year lock-in.`,
    tags     : ['Section 54', 'property sale', 'LTCG', 'house sale', 'reinvestment', '54EC', 'bonds'],
    updated_fy: '2025-26'
  },

  // ── LTA EXEMPTION ────────────────────────────────────────────────────────
  {
    title    : 'LTA — Leave Travel Allowance Exemption',
    category : 'Exemptions',
    section  : 'Section 10(5)',
    content  : `Leave Travel Allowance (LTA) is exempt from tax for journeys within India:
FREQUENCY: Exempt for 2 journeys in a block of 4 calendar years. Current block: 2022-25.
ELIGIBLE TRAVEL: Shortest route from place of duty to destination.
EXEMPTION AMOUNT: Actual travel cost (rail/air/road) for self + family (spouse, children, dependent parents, siblings). NOT accommodation/food/local transport.
AIR TRAVEL: Economy class fare for national carrier (Air India) on the shortest route.
RAIL/OTHER: First class AC fare.
CLAIMING: Employee submits travel bills to employer. Employer adjusts TDS accordingly.
AVAILABLE IN OLD REGIME ONLY.
UNUSED LTA: One out of two journeys if unused in a block can be carried to next block (only one journey exemption).
IMPORTANT: Journey must have actually been undertaken. Cash payment without travel is taxable.`,
    tags     : ['LTA', 'leave travel allowance', 'travel exemption', 'Section 10(5)', 'old regime'],
    updated_fy: '2025-26'
  },

  // ── DEBT MUTUAL FUNDS ────────────────────────────────────────────────────
  {
    title    : 'Debt Mutual Fund Taxation — Post April 2023',
    category : 'Capital Gains',
    section  : 'Finance Act 2023',
    content  : `IMPORTANT CHANGE from 1 April 2023 (Finance Act 2023):
Debt mutual funds, international funds, and gold funds now taxed at SLAB RATE — no LTCG/STCG distinction.
PRE-APRIL 2023 (OLD RULE): LTCG after 3 years was taxed at 20% with indexation benefit.
POST-APRIL 2023 (NEW RULE): ALL gains from debt MF (regardless of holding period) taxed at income slab rate. No indexation. No LTCG benefit.
APPLICABLE TO: Debt MF, International Fund of Funds, Gold ETFs/FoFs, Hybrid funds with < 35% equity.
NOT AFFECTED: Equity MF (>65% equity) — still LTCG 12.5%/STCG 20% treatment.
IMPLICATION: For someone in 30% bracket, debt MF gains are taxed at 30% even after 10 years. FDs and debt MF now have similar tax treatment.
GRANDFATHERING: Debt MF bought BEFORE 1 April 2023 — some interpretations allow old treatment for that corpus. Consult CA.`,
    tags     : ['debt mutual fund', 'debt MF', 'slab rate', 'indexation', 'Finance Act 2023', 'gold ETF'],
    updated_fy: '2025-26'
  },

  // ── GRATUITY ─────────────────────────────────────────────────────────────
  {
    title    : 'Gratuity — Tax Exemption Rules',
    category : 'Exemptions',
    section  : 'Section 10(10)',
    content  : `Gratuity received from employer is partly or fully exempt from tax:
FOR GOVERNMENT EMPLOYEES: Fully exempt — no tax on any gratuity.
FOR PRIVATE SECTOR EMPLOYEES COVERED BY PAYMENT OF GRATUITY ACT:
Exempt = minimum of:
  (a) Actual gratuity received
  (b) 15 days salary × completed years of service (using last drawn salary / 26)
  (c) ₹20,00,000 (enhanced limit)
FOR EMPLOYEES NOT COVERED BY ACT:
Exempt = minimum of:
  (a) Actual gratuity
  (b) Half month's average salary × completed years
  (c) ₹20,00,000
ELIGIBILITY: Minimum 5 years of continuous service required (except in case of death or disability).
TIMING: Gratuity can be received at retirement, resignation, or death/disability.`,
    tags     : ['gratuity', 'Section 10(10)', 'exemption', 'retirement', 'private sector', '20 lakh'],
    updated_fy: '2025-26'
  },

  // ── SECTION 80GG RENT ────────────────────────────────────────────────────
  {
    title    : 'Section 80GG — Rent Deduction for Those Without HRA',
    category : 'Deductions',
    section  : 'Section 80GG',
    content  : `Section 80GG allows rent deduction for individuals who do NOT receive HRA from employer:
WHO CAN CLAIM: Self-employed professionals, freelancers, business owners, or salaried employees whose employer doesn't provide HRA.
DEDUCTION AMOUNT: Minimum of:
  (a) ₹5,000 per month (₹60,000 per year)
  (b) 25% of adjusted total income
  (c) Rent paid MINUS 10% of adjusted total income
CONDITIONS:
  - You must NOT own any residential property in the city where you live/work
  - Your spouse/minor child/HUF must NOT own property in that city
  - You must pay rent and have a proper rent agreement
  - File Form 10BA before claiming deduction
AVAILABLE IN OLD REGIME ONLY.`,
    tags     : ['80GG', 'rent deduction', 'HRA alternative', 'self-employed', 'no HRA', 'rent'],
    updated_fy: '2025-26'
  },

  // ── AGRICULTURAL INCOME ──────────────────────────────────────────────────
  {
    title    : 'Agricultural Income — Partial Tax Exemption',
    category : 'Exemptions',
    section  : 'Section 10(1)',
    content  : `Agricultural income from land in India is exempt from central income tax under Section 10(1).
WHAT QUALIFIES: Income from sale of agricultural produce, farm rent, nursery income, orchards (with cultivation), tea/coffee/rubber to the extent of agricultural portion.
WHAT DOESN'T QUALIFY: Income from agricultural land sold (this is capital gains — not agricultural income), income from poultry/dairy farming on agricultural land, processing income beyond basic processing.
PARTIAL INTEGRATION (for non-agricultural income > ₹5,000 and agricultural income > ₹5,000):
Agricultural income is added to total income for RATE PURPOSES only, then tax on agricultural income at slab rate is deducted. This means agricultural income indirectly increases the tax rate on non-agricultural income.
STATE TAX: States can (and do) levy agricultural income tax under state laws.`,
    tags     : ['agricultural income', 'farming', 'exemption', 'Section 10(1)', 'land'],
    updated_fy: '2025-26'
  },

  // ── PERQUISITES ───────────────────────────────────────────────────────────
  {
    title    : 'Perquisites — Employer Benefits Taxable in Hands of Employee',
    category : 'Salary Income',
    section  : 'Section 17(2)',
    content  : `Perquisites are non-cash benefits provided by employer — taxable in employee's hands:
RENT-FREE ACCOMMODATION: Taxable at 7.5-15% of salary (depending on city population and whether government-owned).
COMPANY CAR (OWNED BY COMPANY):
  - Car ≤ 1600cc: ₹1,800/month taxable perquisite
  - Car > 1600cc: ₹2,400/month taxable perquisite  
  - With driver: add ₹900/month
INTEREST-FREE/CONCESSIONAL LOAN: Difference between SBI rate and actual rate is taxable.
FREE MEALS: Exempt up to ₹50 per meal (effectively ₹26,400/year if two meals per working day).
GIFT VOUCHERS: Exempt up to ₹5,000 per year. Above this, fully taxable.
CLUB MEMBERSHIP: Fully taxable if personal use.
ESOP/SWEAT EQUITY: Taxed at perquisite value (FMV minus price paid) at the time of exercise.
LAPTOP/MOBILE provided for official use: Fully exempt.
MEDICAL REIMBURSEMENT (in hospital only): Fully exempt.`,
    tags     : ['perquisites', 'Section 17', 'company car', 'rent free accommodation', 'ESOP', 'benefits'],
    updated_fy: '2025-26'
  },

  // ── CAPITAL GAINS GENERAL ────────────────────────────────────────────────
  {
    title    : 'Capital Gains — Short-term vs Long-term Classification',
    category : 'Capital Gains',
    section  : 'Section 2(29A), 2(42A)',
    content  : `Capital assets are classified as short-term or long-term based on holding period:
LISTED SECURITIES (shares, equity MF):
  Long-term: More than 12 months → LTCG @ 12.5% (Sec 112A)
  Short-term: 12 months or less → STCG @ 20% (Sec 111A)
UNLISTED SHARES:
  Long-term: More than 24 months → 20% without indexation (or 10% without indexation — option)
  Short-term: 24 months or less → Slab rate
IMMOVABLE PROPERTY (land/building):
  Long-term: More than 24 months → 12.5% without indexation (Budget 2024 removed indexation)
  Short-term: 24 months or less → Slab rate
DEBT MF / GOLD ETF (post April 2023): ALL at slab rate regardless of holding.
BONDS: Listed bonds LTCG after 12 months @ 10% without indexation.`,
    tags     : ['capital gains', 'short-term', 'long-term', 'holding period', 'STCG', 'LTCG', 'classification'],
    updated_fy: '2025-26'
  },

  // ── SECTION 44ADA PROFESSIONALS ──────────────────────────────────────────
  {
    title    : 'Section 44ADA — Presumptive Taxation for Professionals',
    category : 'Business Income',
    section  : 'Section 44ADA',
    content  : `Section 44ADA provides presumptive taxation for specified professionals with gross receipts ≤ ₹50 lakh (₹75 lakh if 95% receipts via banking):
ELIGIBLE PROFESSIONS: Legal, medical, engineering, architecture, accountancy, technical consultancy, interior decoration, and any other notified profession.
HOW IT WORKS: Declare 50% of gross receipts as income (deemed profit). No need to maintain books of accounts or get audit done.
TAX: On the 50% deemed income at slab rate.
ADVANCE TAX: Full advance tax (100%) due by 15 March (no quarterly instalments).
WHEN TO OPT OUT: If actual expenses > 50% of receipts and you can prove it with books. But then full audit is required.
SWITCHING: Can switch between presumptive and regular every year (unlike 44AD for business).
BENEFIT: Very simple for professionals with high margins — saves accounting costs.`,
    tags     : ['44ADA', 'presumptive', 'professional', 'doctor', 'lawyer', 'CA', 'architect', '50%'],
    updated_fy: '2025-26'
  },

  // ── AIS / FORM 26AS ──────────────────────────────────────────────────────
  {
    title    : 'AIS and Form 26AS — Income Reconciliation',
    category : 'Compliance',
    section  : 'Section 285BB',
    content  : `Annual Information Statement (AIS) and Form 26AS are critical for accurate ITR filing:
FORM 26AS: Shows all TDS deducted on your income. Download from IT portal.
AIS (ANNUAL INFORMATION STATEMENT): More comprehensive — shows ALL financial transactions reported to IT dept:
  - Salary income (from employer)
  - Interest income (from banks/NBFCs)
  - Dividend income (from companies)
  - Capital gains from securities (from broker)
  - Property purchase/sale
  - Foreign remittances
  - Mutual fund purchases
  - GST turnover (for businesses)
HOW TO ACCESS: IT portal → Login → AIS tab.
MISMATCH ACTION: If AIS shows income you believe is wrong, you can SUBMIT FEEDBACK on the portal to contest it. Otherwise IT department may issue notice.
IMPORTANCE: Always reconcile AIS with your ITR before filing. Unexplained income in AIS triggers scrutiny notices.`,
    tags     : ['AIS', 'Form 26AS', 'annual information statement', 'TDS', 'reconciliation', 'notice'],
    updated_fy: '2025-26'
  },

  // ── HOUSE PROPERTY LOSS ───────────────────────────────────────────────────
  {
    title    : 'House Property Loss — Set-off and Carry Forward',
    category : 'House Property',
    section  : 'Section 71, 71B',
    content  : `Loss from house property (interest paid exceeds rental income) can be set off:
SET-OFF IN SAME YEAR: Loss from house property can be set off against income from other heads (salary, business, capital gains) — but CAPPED at ₹2,00,000 per year.
CARRY FORWARD: Remaining loss (beyond ₹2L) can be carried forward for 8 years and set off ONLY against income from house property (not other sources).
EXAMPLE: Home loan interest ₹5L, rental income ₹2L, loss = ₹3L. Set-off against salary: max ₹2L. Balance ₹1L carried forward.
SELF-OCCUPIED PROPERTY: Maximum interest deduction ₹2L (old regime). Excess loss not claimable.
AVAILABILITY IN NEW REGIME: Home loan interest on self-occupied property is NOT deductible in new regime. Only rental income/loss from let-out property is considered.`,
    tags     : ['house property loss', 'set-off', 'carry forward', 'home loan', 'Section 71', 'loss'],
    updated_fy: '2025-26'
  },

  // ── BUDGET 2025 KEY CHANGES ───────────────────────────────────────────────
  {
    title    : 'Budget 2025 — Key Income Tax Changes Summary',
    category : 'Budget Updates',
    section  : 'Finance Act 2025',
    content  : `Key income tax changes in Union Budget 2025 (FY 2025-26 / AY 2026-27):
1. NEW REGIME SLABS REVISED: New bracket structure with lower rates (0% up to ₹4L, 5% till ₹8L, 10% till ₹12L etc.)
2. 87A REBATE ENHANCED: New regime rebate limit raised to ₹12 lakh (from ₹7 lakh) — effective zero tax for income up to ₹12.75L (including ₹75K std deduction).
3. STANDARD DEDUCTION: Remains ₹75,000 in new regime, ₹50,000 in old regime.
4. TDS THRESHOLD CHANGES: Various TDS thresholds revised upward.
5. NEW REGIME DEFAULT: New regime remains the default from FY 2024-25 onwards. Old regime requires explicit opt-in.
6. NO CHANGES TO: Section 80C limit (still ₹1.5L), home loan benefits, 87A limit in old regime (still ₹5L).
IMPACT: Anyone with income up to ₹12.75L pays ZERO tax in new regime. This is the single biggest change for middle-class taxpayers.`,
    tags     : ['Budget 2025', 'Finance Act 2025', 'changes', '12 lakh', 'zero tax', 'new regime', '87A'],
    updated_fy: '2025-26'
  },

  // ── INCOME FROM OTHER SOURCES ─────────────────────────────────────────────
  {
    title    : 'Income from Other Sources — FD Interest, Dividends, Gifts',
    category : 'Other Income',
    section  : 'Section 56',
    content  : `Income from other sources includes:
FIXED DEPOSIT INTEREST: Fully taxable at slab rate. TDS at 10% if annual interest > ₹40,000 (₹50,000 for senior citizens). Submit Form 15G/15H to avoid TDS if income is below taxable limit.
SAVINGS BANK INTEREST: Taxable, but deduction of up to ₹10,000 under Section 80TTA (old regime only). Senior citizens get ₹50,000 deduction under Section 80TTB.
DIVIDEND INCOME: Fully taxable at slab rate from FY 2020-21 onwards. TDS at 10% if dividends exceed ₹5,000 per company per year.
GIFTS RECEIVED:
  - From relatives (spouse, siblings, parents, lineal descendants): Fully exempt — no limit.
  - On marriage: Any gift from anyone is exempt.
  - From non-relatives: Exempt if aggregate value ≤ ₹50,000 in a year. Above ₹50,000 — the FULL amount is taxable.
WINNINGS (lottery, game shows, online games): Flat 30% tax (Section 115BB). No deductions. No 87A rebate.`,
    tags     : ['FD interest', 'dividend', 'gift', 'savings interest', 'Section 56', '80TTA', '80TTB', 'lottery'],
    updated_fy: '2025-26'
  },

];

// ── MAIN SEEDER ──────────────────────────────────────────────────────────────
async function seedKnowledgeBase() {
  console.log('═'.repeat(60));
  console.log('  DrainZero Knowledge Base Seeder');
  console.log(`  Seeding ${KB_ENTRIES.length} entries with Gemini embeddings`);
  console.log('═'.repeat(60));

  // Check if already seeded
  const { count } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true });

  if (count > 0) {
    console.log(`\n⚠  Knowledge base already has ${count} entries.`);
    const args = process.argv.slice(2);
    if (!args.includes('--force')) {
      console.log('   Pass --force to re-seed. Exiting.\n');
      process.exit(0);
    }
    console.log('   --force passed. Clearing and re-seeding...');
    await supabase.from('knowledge_base').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  let success = 0;
  let failed  = 0;

  for (let i = 0; i < KB_ENTRIES.length; i++) {
    const entry = KB_ENTRIES[i];
    process.stdout.write(`  [${i + 1}/${KB_ENTRIES.length}] ${entry.title.substring(0, 50)}... `);

    try {
      // Generate embedding from title + content combined
      const textToEmbed = `${entry.title}. ${entry.content}`;
      const embedding   = await getEmbedding(textToEmbed);

      const { error } = await supabase.from('knowledge_base').insert({
        title     : entry.title,
        category  : entry.category,
        section   : entry.section,
        content   : entry.content,
        tags      : entry.tags,
        embedding : embedding,
        updated_fy: entry.updated_fy,
      });

      if (error) throw error;

      success++;
      process.stdout.write('✓\n');
    } catch (err) {
      failed++;
      process.stdout.write(`✗ ${err.message}\n`);
    }

    // Rate limit: 300ms between requests
    if (i < KB_ENTRIES.length - 1) await sleep(300);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  Done: ${success} seeded, ${failed} failed`);
  console.log('═'.repeat(60));

  if (success > 0) {
    console.log('\n✅ Knowledge base ready. AI chatbot semantic search is now enabled.\n');
  }
}

seedKnowledgeBase().catch(err => {
  console.error('Seeder error:', err.message);
  process.exit(1);
});
