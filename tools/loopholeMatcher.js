// ─────────────────────────────────────────────
//  tools/loopholeMatcher.js
//  Matches all 14 loopholes against user profile
//  Returns only loopholes applicable to this user
// ─────────────────────────────────────────────

const LOOPHOLES = [
  {
    id      : 'LH01',
    title   : 'Form 15G / 15H — Stop TDS Completely',
    section : 'Section 197A',
    category: 'TDS Strategy',
    risk    : 'Zero Risk',
    savingMin: 10000,
    savingMax: 50000,
    savingNote: '₹10K–₹50K / year',
    description: 'Submit to your bank each April. If your total income is below the exemption limit, zero TDS is deducted on FD interest, dividends, rent, and EPF withdrawals. Senior citizens use Form 15H.',
    steps: [
      'Download Form 15G from your bank website (15H if age 60+)',
      'Fill: name, PAN, estimated income for the year, FD details',
      'Submit at branch or via net banking — valid for full FY',
      'Renew every April before FY starts'
    ],
    // Eligible if: tax liability is zero OR income below exemption
    check: (p) => {
      const income = p.gross_salary || 0;
      const age = p.age || 0;
      return income < 500000 || age >= 60;
    },
    proTip: 'Even if you have FD interest, if your total tax liability is zero after deductions, you can file 15G.'
  },
  {
    id      : 'LH02',
    title   : 'Nil TDS Certificate — Form 128',
    section : 'Section 197 / Income Tax Act 2025',
    category: 'TDS Strategy',
    risk    : 'Zero Risk',
    savingMin: 200000,
    savingMax: 2000000,
    savingNote: '₹2L–₹20L on property transactions',
    description: 'Apply to your Assessing Officer for a nil/lower TDS certificate. The deductor then cuts TDS at your actual tax rate, not the blanket rate. Critical for NRIs selling property.',
    steps: [
      'File application on TRACES portal (traces.gov.in)',
      'AO issues certificate within 30 days',
      'Give certificate to buyer — they deduct at your actual rate',
      'File ITR to claim refund of any excess TDS'
    ],
    check: (p) => {
      return p.residential_status === 'NRI' || (p.assets && p.assets.property);
    },
    proTip: 'Without this, NRI sellers lose 13-20% of the entire sale value as TDS upfront.'
  },
  {
    id      : 'LH03',
    title   : 'Marriage Gift — Receive From Anyone, Unlimited',
    section : 'Section 56(2)(x)',
    category: 'Gift Strategy',
    risk    : 'Zero Risk',
    savingMin: 0,
    savingMax: 9999999,
    savingNote: 'Unlimited tax-free receipt',
    description: 'Gifts received on occasion of marriage are 100% tax-free with no upper limit and no restriction on who gives it. Friends, employers, strangers — all eligible. Cash, gold, jewellery, property — all covered.',
    steps: [
      'Gifts must be received on or around the wedding date',
      'Maintain a gift register with donor name, amount, relation',
      'Get bank transfer records or written gift deeds for large amounts',
      'Declare in ITR under exempt income'
    ],
    check: (p) => {
      return p.marital_status === 'married' || p.marital_status === 'single';
    },
    proTip: 'This is the ONLY occasion where gifts from non-relatives (friends, colleagues) are also exempt with no limit.'
  },
  {
    id      : 'LH04',
    title   : 'Relative Gift Chain — Unlimited Transfer',
    section : 'Section 56(2)(x)',
    category: 'Gift Strategy',
    risk    : 'Zero Risk',
    savingMin: 0,
    savingMax: 9999999,
    savingNote: 'Unlimited intergenerational transfer',
    description: 'Gifts from defined relatives (parents, spouse, siblings, children, grandparents, spouse\'s siblings) are fully exempt with no ₹50K ceiling. Always use bank transfer + gift deed for proof.',
    steps: [
      'Transfer via NEFT/IMPS — never cash for large amounts',
      'Write a simple gift deed (downloadable template)',
      'Receiver declares in ITR as exempt income',
      'No tax for either giver or receiver'
    ],
    check: (p) => true,   // applicable to everyone
    proTip: 'Cousins, aunts, uncles are NOT relatives under Section 56. Only the specific list qualifies.'
  },
  {
    id      : 'LH05',
    title   : 'Gift to Adult Child — No Clubbing',
    section : 'Section 64 — Clubbing Avoidance',
    category: 'Gift + Invest',
    risk    : 'Plan Ahead',
    savingMin: 30000,
    savingMax: 100000,
    savingNote: '₹30K–₹1L / year per adult child',
    description: 'Clubbing provisions apply to gifts to spouse and MINOR children only. Gift to adult child (18+) means their investment income is never clubbed back to you. Gift ₹20L → they invest → their interest is taxed at their (zero) rate.',
    steps: [
      'Child must be 18 or older',
      'Gift via bank transfer + gift deed',
      'Child opens their own FD / investment account',
      'Income is taxed in child\'s hands — often at zero rate'
    ],
    check: (p) => {
      const children = p.family && p.family.children;
      return children && children.some(c => c.age >= 18);
    },
    proTip: 'If child is a student with no income, interest up to ₹2.5L is completely tax-free in their hands.'
  },
  {
    id      : 'LH06',
    title   : 'HUF Formation — Duplicate All Tax Benefits',
    section : 'Hindu Undivided Family',
    category: 'Structure',
    risk    : 'One-time Setup',
    savingMin: 50000,
    savingMax: 150000,
    savingNote: '₹50K–₹1.5L / year',
    description: 'Any Hindu, Jain, Buddhist, or Sikh married couple creates a HUF. Gets its own PAN, bank account, and ITR with ₹2.5L exemption + full 80C + ₹50K NPS + ₹25K 80D. Even just husband + wife qualifies.',
    steps: [
      'Get a HUF deed drafted by a CA (cost: ₹2K–₹5K)',
      'Apply for HUF PAN online (Form 49A)',
      'Open HUF bank account with PAN',
      'Deposit ancestral property / gifted money into HUF account',
      'File separate HUF ITR each year'
    ],
    check: (p) => {
      const isHinduJainSikhBuddhist = true; // assume eligible if not specified
      return p.marital_status === 'married' && isHinduJainSikhBuddhist;
    },
    proTip: 'HUF income from ancestral assets is NOT clubbed with individual income. This is a separate taxpaying entity.'
  },
  {
    id      : 'LH07',
    title   : '44ADA — Freelancers Pay Tax on 50% Only',
    section : 'Presumptive Taxation',
    category: 'Profession',
    risk    : 'Zero Risk',
    savingMin: 100000,
    savingMax: 300000,
    savingNote: '₹1L–₹3L / year vs actual method',
    description: 'IT professionals, doctors, architects, lawyers, designers with gross receipts ≤₹75L (95%+ digital receipts) can declare 50% as income and pay tax on that. No books of account, no audit needed.',
    steps: [
      'Ensure profession is in the 44ADA eligible list (IT, medical, legal, architectural, etc.)',
      'Total gross receipts must be ≤₹75L',
      '95% receipts must be digital (bank transfer/UPI)',
      'Declare 50% as profit in ITR-4',
      'Still claim 80C, 80D, NPS on top of this'
    ],
    check: (p) => {
      const eligible = ['freelancer', 'self-employed', 'doctor', 'lawyer', 'architect', 'consultant'];
      return eligible.some(e => (p.profession_type || '').toLowerCase().includes(e)) &&
             (p.gross_salary || 0) <= 7500000;
    },
    proTip: 'Export income from Upwork, Fiverr, Toptal = 0% GST + 44ADA. Double benefit.'
  },
  {
    id      : 'LH08',
    title   : 'RNOR Status — Returning NRI Golden Window',
    section : 'Section 6 — Residential Status',
    category: 'NRI Strategy',
    risk    : 'Zero Risk',
    savingMin: 500000,
    savingMax: 5000000,
    savingNote: '₹5L–₹50L saved over 2–3 years',
    description: 'NRI returning after a long stay abroad qualifies as RNOR (Resident but Not Ordinarily Resident) for 2–3 years. During this window, foreign income is NOT taxable in India.',
    steps: [
      'Check your RNOR status — NRI for 9 of last 10 years OR stayed ≤729 days in last 7 years',
      'File ITR as RNOR (not Resident)',
      'Foreign salary, NRE FD interest, foreign business income — all outside Indian tax',
      'India income still taxable normally',
      'Consult CA to plan asset transfers during this window'
    ],
    check: (p) => {
      return p.residential_status === 'RNOR' || p.residential_status === 'NRI';
    },
    proTip: 'Transfer foreign assets to India during RNOR period — no tax on gains made abroad.'
  },
  {
    id      : 'LH09',
    title   : 'Spouse Salary — Avoid Clubbing Legally',
    section : 'Section 64(1)(ii)',
    category: 'Income Split',
    risk    : 'Zero Risk',
    savingMin: 50000,
    savingMax: 200000,
    savingNote: '₹50K–₹2L / year',
    description: 'Clubbing applies ONLY if spouse\'s salary is not commensurate with their qualification. Pay your spouse market-rate for REAL work (accounting, ops, content creation) — it\'s deductible for you and not clubbed.',
    steps: [
      'Document the work your spouse actually does',
      'Pay via bank transfer at market rate',
      'Maintain appointment letter + salary slips',
      'Spouse files ITR declaring this income',
      'Deduct as business expense in your ITR'
    ],
    check: (p) => {
      return p.marital_status === 'married' && p.spouse_employed === false &&
             (p.profession_type === 'self-employed' || p.profession_type === 'freelancer');
    },
    proTip: 'Spouse gets their own ₹2.5L exemption + 80C + 80D on this income. Effective ₹4L tax-free.'
  },
  {
    id      : 'LH10',
    title   : 'LTCG Harvesting — ₹1.25L Free Every Year',
    section : 'Section 112A',
    category: 'Investment',
    risk    : 'Zero Risk',
    savingMin: 15625,
    savingMax: 15625,
    savingNote: '₹15,625 tax saved / year',
    description: 'First ₹1.25L of long-term equity capital gains each year is completely tax-free. Sell stocks/mutual funds before crossing this limit, then immediately rebuy. Do it in March AND April = ₹2.5L in 2 weeks.',
    steps: [
      'Check your unrealised LTCG (held >1 year) in your portfolio',
      'Sell enough units to book exactly ₹1.25L gains',
      'Immediately rebuy the same units',
      'Repeat in April for next FY',
      'Your cost basis resets — future gains reduce'
    ],
    check: (p) => {
      return p.assets && (p.assets.stocks || p.assets.mutual_funds);
    },
    proTip: 'Do this on March 31st AND April 1st — two FYs, ₹2.5L in gains, zero tax.'
  },
  {
    id      : 'LH11',
    title   : 'Perquisite Cap ₹4L — Both Regimes',
    section : 'Finance Act 2025',
    category: 'Salary Structure',
    risk    : 'Zero Risk',
    savingMin: 120000,
    savingMax: 120000,
    savingNote: '₹1.2L saved at 30% slab',
    description: 'Finance Act 2025 raised the perquisite exemption cap 8× from ₹50K to ₹4L. Phone, internet, club, gym, meal cards, health checkup, books, children school fees — all tax-free. Works in old AND new regime.',
    steps: [
      'Talk to your HR / payroll team',
      'Ask to restructure CTC — move allowances to perquisites',
      'Items included: phone/internet reimbursement, meal cards, gym, club, books, health checkup, driver salary',
      'Get monthly reimbursement bills submitted',
      'Save up to ₹4L/year completely tax-free'
    ],
    check: (p) => {
      return p.profession_type && p.profession_type.toLowerCase().includes('salaried');
    },
    proTip: 'Even in new regime this works — it\'s a perquisite exemption, not a deduction.'
  },
  {
    id      : 'LH12',
    title   : 'NRI Gift via Foreign Account — Zero Indian Tax',
    section : 'Section 56(2)(x) — Place of Receipt',
    category: 'NRI Gift',
    risk    : 'Zero Risk',
    savingMin: 0,
    savingMax: 9999999,
    savingNote: 'Unlimited cross-border transfers',
    description: 'Section 56(2)(x) taxes gifts received IN India. If a resident parent sends money to an NRI child\'s foreign bank account, the receipt happens outside India — not chargeable in India at all.',
    steps: [
      'Send via wire transfer from Indian account to NRI\'s foreign account',
      'Not via NRE/NRO account in India — must be foreign account',
      'Maintain transfer records for 7 years',
      'NRI child need not declare in Indian ITR (non-resident income)'
    ],
    check: (p) => {
      return p.residential_status === 'NRI' ||
             (p.family && p.family.nri_member === true);
    },
    proTip: 'LRS limit of ₹10L applies to the sender (resident parent) for reporting, but no tax on the gift itself.'
  },
  {
    id      : 'LH13',
    title   : 'FAST-DS 2026 — Foreign Asset Amnesty Window',
    section : 'Finance Bill 2026',
    category: 'Amnesty 2026',
    risk    : 'Act Fast',
    savingMin: 1000000,
    savingMax: 9999999,
    savingNote: '₹10L+ annual penalty avoided',
    description: 'MNC employees with unreported ESOPs, RSUs, or foreign accounts: pay a flat ₹1L fee to regularise technical non-disclosures up to ₹5Cr. Foreign assets ≤₹20L get zero penalty from Oct 1, 2026.',
    steps: [
      'Check if you have foreign assets: ESOPs, RSUs, foreign bank accounts, foreign property',
      'If undisclosed, file under FAST-DS 2026 scheme before deadline',
      'Pay flat ₹1L fee for assets up to ₹5Cr',
      'Get regularised — avoid ₹10L/year penalty + prosecution',
      'Consult a CA specialising in FEMA immediately'
    ],
    check: (p) => {
      return p.assets && (p.assets.esop || p.assets.foreign_assets);
    },
    proTip: 'The window is limited. If you have unreported foreign assets from MNC jobs, act before Oct 1, 2026.'
  },
  {
    id      : 'LH14',
    title   : 'Joint Property — Double Rental Exemption',
    section : 'Section 26',
    category: 'Property',
    risk    : 'Zero Risk',
    savingMin: 75000,
    savingMax: 150000,
    savingNote: '₹75K–₹1.5L / year',
    description: 'Register property in both husband and wife\'s name. Rental income splits 50:50. Each gets ₹2.5L exemption + 30% standard deduction on their share. Each also claims ₹2L home loan interest deduction separately.',
    steps: [
      'Register property as co-owners (50:50 recommended)',
      'Open joint bank account for rent credits',
      'Each files ITR with their 50% share of rental income',
      'Each claims standard deduction of 30% on their share',
      'Each claims up to ₹2L home loan interest'
    ],
    check: (p) => {
      return p.marital_status === 'married' &&
             p.assets && p.assets.property &&
             (p.assets.rental_income || 0) > 0;
    },
    proTip: 'At ₹5L annual rent: single owner pays ~₹45K tax. Joint owners pay near-zero. Saves ₹45K immediately.'
  },
  {
    id      : 'LH15',
    title   : 'Corporate Car Lease — Company Pays, You Save',
    section : 'Section 17(2)(iii) — Perquisite Rules',
    category: 'Salary Structure',
    risk    : 'Zero Risk',
    savingMin: 60000,
    savingMax: 300000,
    savingNote: '₹60K–₹3L / year depending on CTC',
    description: 'Instead of buying a car yourself (with post-tax money), have your company lease the car for you. The perquisite value added to your salary is only ₹1,800–₹2,400/month (₹28,800/year) — far less than the actual lease cost of ₹12,000–₹25,000/month. The company also gets full GST input credit on the lease, reducing business cost.',
    steps: [
      'Request your HR/employer to include a Car Lease allowance in CTC restructuring',
      'Company signs the lease agreement directly with the car manufacturer/leasing company (Mahindra Fleet, Orix, ALD)',
      'Car >1600cc: perquisite = ₹2,400/month (₹28,800/yr taxable). Car ≤1600cc: ₹1,800/month (₹21,600/yr taxable)',
      'If driver provided: add ₹900/month to perquisite value',
      'Company claims full lease rental as deductible business expense + 28% GST input credit',
      'At end of lease (3–4 years), buy car at residual value (~15% of original price)'
    ],
    check: (p) => {
      // Applicable to salaried employees with decent income
      const isSalaried = (p.employment_type || '').toLowerCase().includes('salaried') ||
                         (p.employment_type || '').toLowerCase().includes('government');
      return isSalaried && (p.gross_salary || 0) >= 600000;
    },
    proTip: 'At ₹20L CTC, replacing ₹8L car purchase with a company lease saves ₹1.5–₹2L in tax. EV leases get Section 80EEB benefit too — stack both strategies.'
  },
];

// ── MAIN EXPORT ──
// Returns matched loopholes with personalised savings estimate
function matchLoopholes(profile) {
  const matched = [];
  const notApplicable = [];

  for (const lh of LOOPHOLES) {
    let applicable = false;
    try {
      applicable = lh.check(profile);
    } catch (e) {
      applicable = false;
    }

    if (applicable) {
      matched.push({
        id         : lh.id,
        title      : lh.title,
        section    : lh.section,
        category   : lh.category,
        risk       : lh.risk,
        savingNote : lh.savingNote,
        description: lh.description,
        steps      : lh.steps,
        proTip     : lh.proTip
      });
    } else {
      notApplicable.push({ id: lh.id, title: lh.title, reason: 'Profile criteria not met' });
    }
  }

  return {
    matched,
    matchedCount    : matched.length,
    totalLoopholes  : LOOPHOLES.length,
    notApplicable
  };
}

module.exports = { matchLoopholes, LOOPHOLES };

// ── LOOPHOLE LH15 — appended ──
// (Already exported above — we patch the array before module.exports)
