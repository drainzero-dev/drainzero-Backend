// ─────────────────────────────────────────────
//  tools/taxCalculator.js  —  FY 2025-26
//  FIXED:
//  - Deduction limits enforced with Math.min()
//  - Correct Budget 2025 new-regime slabs
//  - Correct 87A rebates (old ≤5L, new ≤12L)
//  - Standard deduction ₹75,000 new / ₹50,000 old
//  - Guard: throws if gross_salary = 0
// ─────────────────────────────────────────────

// ── NEW REGIME SLABS — Budget 2025 (FY 2025-26 / AY 2026-27) ──
function newRegimeTax(income) {
  if (income <= 400000)  return 0;
  if (income <= 800000)  return (income - 400000) * 0.05;
  if (income <= 1200000) return 20000  + (income - 800000)  * 0.10;
  if (income <= 1600000) return 60000  + (income - 1200000) * 0.15;
  if (income <= 2000000) return 120000 + (income - 1600000) * 0.20;
  if (income <= 2400000) return 200000 + (income - 2000000) * 0.25;
  return                        300000 + (income - 2400000) * 0.30;
}

// ── OLD REGIME SLABS ──
function oldRegimeTax(income) {
  if (income <= 250000)  return 0;
  if (income <= 500000)  return (income - 250000)  * 0.05;
  if (income <= 1000000) return 12500  + (income - 500000)  * 0.20;
  return                        112500 + (income - 1000000) * 0.30;
}

// ── SURCHARGE ──
function getSurcharge(tax, income) {
  if (income > 50000000) return tax * 0.37;
  if (income > 20000000) return tax * 0.25;
  if (income > 10000000) return tax * 0.15;
  if (income > 5000000)  return tax * 0.10;
  return 0;
}

// ── CESS — 4% Health + Education ──
const getCess = (tax) => tax * 0.04;

// ── 87A REBATE ──
// New regime: ₹60,000 rebate if taxable income ≤ ₹12L (effectively zero tax)
// Old regime: ₹12,500 rebate if taxable income ≤ ₹5L
function getNewRegimeRebate(income, tax) {
  return income <= 1200000 ? Math.min(tax, 60000) : 0;
}
function getOldRegimeRebate(income, tax) {
  return income <= 500000 ? Math.min(tax, 12500) : 0;
}

// ── HRA EXEMPTION — least of three ──
function calcHRA(profile) {
  if (!profile.hra_received || !profile.rent_paid || !profile.basic_da) return 0;
  const hra     = profile.hra_received;
  const basic   = profile.basic_da;
  const rent    = profile.rent_paid;        // stored as annual
  const isMetro = profile.is_metro || false;
  const a = hra;
  const b = isMetro ? basic * 0.50 : basic * 0.40;
  const c = Math.max(0, rent - basic * 0.10);
  return Math.min(a, b, c);
}

// ── OLD REGIME DEDUCTIONS — all caps enforced ──
function calcOldRegimeDeductions(profile) {
  const age = Number(profile.age || 0);

  const d = {
    standardDeduction : 50000,
    // FIX: Math.min() on every deduction
    section80C        : Math.min(Number(profile.section_80c        || 0), 150000),
    section80D        : Math.min(Number(profile.section_80d        || 0), age >= 60 ? 50000 : 25000),
    section80D_parents: Math.min(Number(profile.section_80d_parents || 0), 50000),
    section80CCD1B    : Math.min(Number(profile.nps_personal       || 0), 50000),
    section80E        : Number(profile.education_loan_interest     || 0),    // no cap
    hra               : calcHRA(profile),
    homeLoanInterest  : Math.min(Number(profile.home_loan_interest || 0), 200000),
    professionalTax   : Math.min(Number(profile.professional_tax   || 0), 2500),
  };

  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return { breakdown: d, total };
}

// ── ADVANCE TAX INSTALMENTS ──
function calcAdvanceTax(annualTax) {
  const t = Math.round(annualTax);
  return {
    Q1_Jun15 : Math.round(t * 0.15),
    Q2_Sep15 : Math.round(t * 0.45) - Math.round(t * 0.15),
    Q3_Dec15 : Math.round(t * 0.75) - Math.round(t * 0.45),
    Q4_Mar15 : t - Math.round(t * 0.75),
    total    : t,
  };
}

// ── HEALTH SCORE — 0-100 based on real utilisation ──
function calcHealthScore(profile, oldResult, newResult) {
  let score = 100;
  const d = oldResult.deductions.breakdown;

  if (Number(profile.section_80c  || 0) < 150000 * 0.8) score -= 15;
  if (Number(profile.section_80d  || 0) < 5000)          score -= 10;
  if (Number(profile.nps_personal || 0) < 1000)           score -= 10;

  // Penalty for wrong regime
  const diff = Math.abs(oldResult.totalTax - newResult.totalTax);
  if (diff > 20000) score -= 5;

  // Penalty for unclaimed HRA
  if (profile.rent_paid > 0 && profile.hra_received > 0 && d.hra === 0) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ── MAIN EXPORT ──
function calculateTax(profile) {
  const gross = Number(profile.gross_salary || 0);

  // Guard: should never reach here with 0 (analyse.js catches it), but belt-and-suspenders
  if (gross <= 0) {
    throw new Error('Cannot calculate tax: gross salary is zero. Please add income details.');
  }

  // ── OLD REGIME ──
  const oldDed      = calcOldRegimeDeductions(profile);
  const oldTaxable  = Math.max(0, gross - oldDed.total);
  let   oldTax      = oldRegimeTax(oldTaxable);
  oldTax            = Math.max(0, oldTax - getOldRegimeRebate(oldTaxable, oldTax));
  const oldSurch    = getSurcharge(oldTax, oldTaxable);
  const oldCess     = getCess(oldTax + oldSurch);
  const oldTotal    = Math.round(oldTax + oldSurch + oldCess);

  // ── NEW REGIME — standard deduction ₹75,000 (Budget 2024) ──
  const newStd      = 75000;
  const newTaxable  = Math.max(0, gross - newStd);
  let   newTax      = newRegimeTax(newTaxable);
  newTax            = Math.max(0, newTax - getNewRegimeRebate(newTaxable, newTax));
  const newSurch    = getSurcharge(newTax, newTaxable);
  const newCess     = getCess(newTax + newSurch);
  const newTotal    = Math.round(newTax + newSurch + newCess);

  const recommendedRegime = oldTotal <= newTotal ? 'old' : 'new';
  const saving            = Math.abs(oldTotal - newTotal);

  // Compute rebate amounts for display in frontend
  const oldRebateApplied = getOldRegimeRebate(oldTaxable, oldRegimeTax(oldTaxable));
  const newRebateApplied = getNewRegimeRebate(newTaxable, newRegimeTax(newTaxable));

  const oldResult = {
    regime          : 'old',
    taxableIncome   : oldTaxable,
    slabTax         : Math.round(oldRegimeTax(oldTaxable)),  // pre-rebate slab tax
    rebate87A       : Math.round(oldRebateApplied),
    baseTax         : Math.round(oldTax),
    surcharge       : Math.round(oldSurch),
    cess            : Math.round(oldCess),
    totalTax        : oldTotal,
    deductions      : oldDed,
    rebateApplied   : oldRebateApplied > 0,
    recommendedRegime,
  };

  const newResult = {
    regime          : 'new',
    taxableIncome   : newTaxable,
    slabTax         : Math.round(newRegimeTax(newTaxable)),  // pre-rebate slab tax
    rebate87A       : Math.round(newRebateApplied),
    baseTax         : Math.round(newTax),
    surcharge       : Math.round(newSurch),
    cess            : Math.round(newCess),
    totalTax        : newTotal,
    deductions      : { breakdown: { standardDeduction: newStd }, total: newStd },
    rebateApplied   : newRebateApplied > 0,
    recommendedRegime,
  };

  // ── LEAKAGE GAPS — what the user is leaving on the table ──
  const gaps = [];

  if (Number(profile.section_80c || 0) < 150000) {
    const missed = 150000 - Number(profile.section_80c || 0);
    gaps.push({ section: '80C',       missed, taxSaved: Math.round(missed * 0.30), action: 'Invest in PPF, ELSS, LIC or NSC to max ₹1.5L limit' });
  }

  if (Number(profile.nps_personal || 0) < 50000) {
    const missed = 50000 - Number(profile.nps_personal || 0);
    gaps.push({ section: '80CCD(1B)', missed, taxSaved: Math.round(missed * 0.30), action: 'Open NPS Tier-1 — ₹50K extra deduction beyond 80C' });
  }

  if (Number(profile.section_80d || 0) < 25000) {
    const missed = 25000 - Number(profile.section_80d || 0);
    gaps.push({ section: '80D',       missed, taxSaved: Math.round(missed * 0.30), action: 'Buy health insurance — deduct premium up to ₹25K' });
  }

  const healthScore = calcHealthScore(profile, oldResult, newResult);
  const advanceTax  = calcAdvanceTax(recommendedRegime === 'old' ? oldTotal : newTotal);

  return {
    oldRegime       : oldResult,
    newRegime       : newResult,
    recommendedRegime,
    saving,
    healthScore,
    leakageGaps     : gaps,
    totalLeakage    : gaps.reduce((a, g) => a + g.taxSaved, 0),
    advanceTax,
  };
}

module.exports = { calculateTax, calcHRA, calcAdvanceTax, calcHealthScore };
