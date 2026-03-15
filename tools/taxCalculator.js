// ─────────────────────────────────────────────
//  tools/taxCalculator.js
//  Old vs New regime calculation — FY 2025-26
//  Pure JS — no API calls, runs instantly
// ─────────────────────────────────────────────

// ── NEW REGIME SLABS (FY 2025-26 / AY 2026-27) ──
// Budget 2025 updated slabs — ₹12L effectively zero tax with rebate
function newRegimeTax(income) {
  if (income <= 400000)  return 0;
  if (income <= 800000)  return (income - 400000) * 0.05;
  if (income <= 1200000) return 20000 + (income - 800000)  * 0.10;
  if (income <= 1600000) return 60000 + (income - 1200000) * 0.15;
  if (income <= 2000000) return 120000 + (income - 1600000) * 0.20;
  if (income <= 2400000) return 200000 + (income - 2000000) * 0.25;
  return                        300000 + (income - 2400000) * 0.30;
}

// ── OLD REGIME SLABS ──
function oldRegimeTax(income) {
  if (income <= 250000)  return 0;
  if (income <= 500000)  return (income - 250000) * 0.05;
  if (income <= 1000000) return 12500  + (income - 500000)  * 0.20;
  return                        112500 + (income - 1000000) * 0.30;
}

// ── SURCHARGE ──
function getSurcharge(tax, income) {
  if (income > 50000000) return tax * 0.37;   // >₹5Cr
  if (income > 20000000) return tax * 0.25;   // >₹2Cr
  if (income > 10000000) return tax * 0.15;   // >₹1Cr
  if (income > 5000000)  return tax * 0.10;   // >₹50L
  return 0;
}

// ── CESS — 4% Health + Education ──
function getCess(tax) {
  return tax * 0.04;
}

// ── SECTION 87A REBATE ──
// New regime: ₹60,000 rebate if income ≤ ₹12L (effectively zero tax)
// Old regime: ₹12,500 rebate if income ≤ ₹5L
function getNewRegimeRebate(income, tax) {
  if (income <= 1200000) return Math.min(tax, 60000);
  return 0;
}
function getOldRegimeRebate(income, tax) {
  if (income <= 500000) return Math.min(tax, 12500);
  return 0;
}

// ── CALCULATE OLD REGIME DEDUCTIONS ──
function calcOldRegimeDeductions(profile) {
  const d = {
    standardDeduction : 50000,                                          // flat for salaried
    section80C        : Math.min(profile.section_80c || 0, 150000),    // max ₹1.5L
    section80D        : Math.min(profile.section_80d || 0, 25000),     // self + family
    section80D_parents: Math.min(profile.section_80d_parents || 0, 50000), // senior parents
    section80CCD1B    : Math.min(profile.nps_personal || 0, 50000),    // NPS extra
    section80E        : profile.education_loan_interest || 0,          // no limit
    section80G        : Math.min(profile.donations_80g || 0, 0),       // complex, skip calc
    hra               : calcHRA(profile),
    homeLoanInterest  : Math.min(profile.home_loan_interest || 0, 200000), // max ₹2L
  };

  // Senior citizen extra 80D
  if (profile.age >= 60) {
    d.section80D = Math.min(profile.section_80d || 0, 50000);
  }

  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return { breakdown: d, total };
}

// ── HRA CALCULATION ──
// Least of: (a) actual HRA, (b) 50%/40% of basic, (c) rent - 10% of basic
function calcHRA(profile) {
  if (!profile.hra_received || !profile.rent_paid || !profile.basic_da) return 0;

  const hra       = profile.hra_received;
  const basic     = profile.basic_da;
  const rent      = profile.rent_paid * 12;   // monthly → annual
  const isMetro   = profile.is_metro || false;

  const a = hra;
  const b = isMetro ? basic * 0.50 : basic * 0.40;
  const c = Math.max(0, rent - basic * 0.10);

  return Math.min(a, b, c);
}

// ── ADVANCE TAX QUARTERS ──
// Returns exact amount due each quarter based on annual tax
function calcAdvanceTax(annualTax) {
  return {
    Q1_Jun15 : Math.round(annualTax * 0.15),   // 15% by Jun 15
    Q2_Sep15 : Math.round(annualTax * 0.45) - Math.round(annualTax * 0.15),  // 45% cumulative
    Q3_Dec15 : Math.round(annualTax * 0.75) - Math.round(annualTax * 0.45),  // 75% cumulative
    Q4_Mar15 : Math.round(annualTax * 1.00) - Math.round(annualTax * 0.75),  // 100% cumulative
    total    : Math.round(annualTax)
  };
}

// ── HEALTH SCORE ALGORITHM ──
// 0-100 score based on tax optimisation level
function calcHealthScore(profile, oldResult, newResult) {
  let score = 100;
  const deductions = oldResult.deductions.breakdown;

  // Penalty for not using 80C fully (-15 if not maxed)
  const max80C = 150000;
  if ((profile.section_80c || 0) < max80C * 0.8) score -= 15;

  // Penalty for no health insurance (-10)
  if (!profile.section_80d || profile.section_80d < 5000) score -= 10;

  // Penalty for no NPS 80CCD(1B) (-10)
  if (!profile.nps_personal || profile.nps_personal < 1000) score -= 10;

  // Penalty for wrong regime chosen (-20 if losing money)
  const regimeDiff = Math.abs(oldResult.totalTax - newResult.totalTax);
  if (regimeDiff > 20000 && profile.preferred_regime !== oldResult.recommendedRegime) {
    score -= 20;
  }

  // Penalty for not claiming HRA when eligible (-10)
  if (profile.rent_paid > 0 && profile.hra_received > 0 && deductions.hra === 0) {
    score -= 10;
  }

  // Penalty for missing form 15G/15H opportunity (-5)
  if ((profile.fd_interest || 0) > 40000 && oldResult.totalTax === 0) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ── MAIN EXPORT — full analysis ──
function calculateTax(profile) {
  const grossIncome = profile.gross_salary || 0;

  // ── OLD REGIME ──
  const oldDeductions = calcOldRegimeDeductions(profile);
  const oldTaxableIncome = Math.max(0, grossIncome - oldDeductions.total);
  let oldTax = oldRegimeTax(oldTaxableIncome);
  oldTax -= getOldRegimeRebate(oldTaxableIncome, oldTax);
  oldTax = Math.max(0, oldTax);
  const oldSurcharge = getSurcharge(oldTax, oldTaxableIncome);
  const oldCess = getCess(oldTax + oldSurcharge);
  const oldTotal = Math.round(oldTax + oldSurcharge + oldCess);

  // ── NEW REGIME ──
  // Only standard deduction ₹75,000 (raised in Budget 2024)
  const newStandardDeduction = 75000;
  const newTaxableIncome = Math.max(0, grossIncome - newStandardDeduction);
  let newTax = newRegimeTax(newTaxableIncome);
  newTax -= getNewRegimeRebate(newTaxableIncome, newTax);
  newTax = Math.max(0, newTax);
  const newSurcharge = getSurcharge(newTax, newTaxableIncome);
  const newCess = getCess(newTax + newSurcharge);
  const newTotal = Math.round(newTax + newSurcharge + newCess);

  // ── RECOMMENDED REGIME ──
  const recommendedRegime = oldTotal <= newTotal ? 'old' : 'new';
  const saving = Math.abs(oldTotal - newTotal);

  // ── LEAKAGE GAPS ──
  // What they're missing that they could claim
  const gaps = [];

  if ((profile.section_80c || 0) < 150000) {
    const missed = 150000 - (profile.section_80c || 0);
    gaps.push({
      section : '80C',
      missed  : missed,
      taxSaved: Math.round(missed * 0.30),
      action  : 'Invest in PPF, ELSS, or LIC to max ₹1.5L limit'
    });
  }

  if (!profile.nps_personal || profile.nps_personal < 50000) {
    const missed = 50000 - (profile.nps_personal || 0);
    gaps.push({
      section : '80CCD(1B)',
      missed  : missed,
      taxSaved: Math.round(missed * 0.30),
      action  : 'Open NPS account — additional ₹50K deduction on top of 80C'
    });
  }

  if (!profile.section_80d || profile.section_80d < 25000) {
    gaps.push({
      section : '80D',
      missed  : 25000 - (profile.section_80d || 0),
      taxSaved: Math.round((25000 - (profile.section_80d || 0)) * 0.30),
      action  : 'Buy health insurance — deduct premium up to ₹25K'
    });
  }

  // ── BUILD RESULT ──
  const oldResult = {
    regime        : 'old',
    taxableIncome : oldTaxableIncome,
    baseTax       : Math.round(oldTax),
    surcharge     : Math.round(oldSurcharge),
    cess          : Math.round(oldCess),
    totalTax      : oldTotal,
    deductions    : oldDeductions,
    recommendedRegime
  };

  const newResult = {
    regime        : 'new',
    taxableIncome : newTaxableIncome,
    baseTax       : Math.round(newTax),
    surcharge     : Math.round(newSurcharge),
    cess          : Math.round(newCess),
    totalTax      : newTotal,
    deductions    : { breakdown: { standardDeduction: newStandardDeduction }, total: newStandardDeduction },
    recommendedRegime
  };

  const healthScore = calcHealthScore(profile, oldResult, newResult);
  const advanceTax  = calcAdvanceTax(
    recommendedRegime === 'old' ? oldTotal : newTotal
  );

  return {
    oldRegime       : oldResult,
    newRegime       : newResult,
    recommendedRegime,
    saving,
    healthScore,
    leakageGaps     : gaps,
    totalLeakage    : gaps.reduce((a, g) => a + g.taxSaved, 0),
    advanceTax
  };
}

module.exports = { calculateTax, calcHRA, calcAdvanceTax, calcHealthScore };
