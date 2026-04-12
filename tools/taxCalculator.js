// ─────────────────────────────────────────────────────────────────────────────
//  tools/taxCalculator.js  —  FY 2025-26
//  Handles: salary income, capital gains (LTCG/STCG/F&O/Crypto),
//           rental income, property sale gains, 87A rebate (correct thresholds)
// ─────────────────────────────────────────────────────────────────────────────

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

const getCess = (tax) => tax * 0.04;

// ── 87A REBATE ──
// IMPORTANT: 87A rebate does NOT apply to:
//   • Crypto / VDA income (Sec 115BBH) — taxed at flat 30%, no rebate
//   • STCG under Sec 111A (equity) — rebate allowed but only on normal income portion
// New regime: ₹60,000 rebate if taxable NORMAL income ≤ ₹12L
// Old regime: ₹12,500 rebate if taxable NORMAL income ≤ ₹5L
function getNewRegimeRebate(normalTaxable, tax) {
  return normalTaxable <= 1200000 ? Math.min(tax, 60000) : 0;
}
function getOldRegimeRebate(normalTaxable, tax) {
  return normalTaxable <= 500000 ? Math.min(tax, 12500) : 0;
}

// ── CAPITAL GAINS TAX — separate from slab tax ──
// Returns { tax, breakdown } — taxed at special rates, OUTSIDE slab computation
function calcCapitalGainsTax(profile) {
  const subcategory = (profile.subcategory || profile.asset_type || '').toLowerCase();
  const purchaseAmt = Number(profile.purchase_amount || profile.purchaseAmount || 0);
  const sellingAmt  = Number(profile.selling_amount  || profile.sellingAmount  || 0);
  const purchaseDate= profile.purchase_date || profile.purchaseDate;
  const sellingDate = profile.selling_date  || profile.sellingDate;
  const quantity    = Number(profile.quantity || 1);
  const brokerage   = Number(profile.brokerageCharges || profile.brokerage || 0);
  const dividend    = Number(profile.dividendReceived || profile.dividend_income || 0);

  let capitalGainsTax = 0;
  let capitalGainsBreakdown = {};

  // ── CRYPTO / VDA — Sec 115BBH ──
  // Flat 30% on gains. NO deductions except purchase cost. NO rebate. NO loss carry-forward.
  if (subcategory === 'crypto') {
    const purchaseCost = purchaseAmt;  // Only purchase cost allowed
    const saleProceeds = sellingAmt;
    const gain = Math.max(0, saleProceeds - purchaseCost);  // losses capped at 0 (no carry-forward)
    const cryptoTax = Math.round(gain * 0.30);
    capitalGainsBreakdown = {
      type: 'VDA / Crypto (Sec 115BBH)',
      purchaseCost, saleProceeds, gain,
      taxRate: '30% flat — no deductions, no 87A rebate, no loss carry-forward',
      tax: cryptoTax,
      note: 'Transaction fees NOT deductible (only purchase cost allowed)'
    };
    capitalGainsTax = cryptoTax;
  }

  // ── EQUITY SHARES / LTCG+STCG ──
  else if (subcategory === 'equity shares' || subcategory === 'equity') {
    const purchasePricePerShare = Number(profile.purchasePricePerShare || profile.purchasePrice || 0);
    const sellPricePerShare     = Number(profile.sellPricePerShare     || profile.sellingPrice  || 0);
    const qty                   = Number(profile.purchaseQuantity      || profile.quantity      || 1);

    const costBasis    = purchasePricePerShare * qty + brokerage;
    const saleProceeds = sellPricePerShare * qty - brokerage;
    const gain         = saleProceeds - costBasis;

    // Determine holding period
    let holdingDays = 365; // default to LTCG if no dates
    if (purchaseDate && sellingDate) {
      const pDate = new Date(purchaseDate);
      const sDate = new Date(sellingDate);
      holdingDays = Math.round((sDate - pDate) / (1000 * 60 * 60 * 24));
    }

    const isLTCG = holdingDays > 365;

    if (isLTCG && gain > 0) {
      // LTCG Sec 112A: first ₹1.25L exempt, above @ 12.5% (no indexation for equity)
      const ltcgExempt = 125000;
      const taxableGain = Math.max(0, gain - ltcgExempt);
      const ltcgTax = Math.round(taxableGain * 0.125);
      capitalGainsBreakdown = {
        type: 'LTCG on Equity (Sec 112A)', gain, ltcgExempt,
        taxableGain, taxRate: '12.5%', tax: ltcgTax, holdingDays,
        note: 'First ₹1.25L of LTCG is tax-free annually'
      };
      capitalGainsTax = ltcgTax;
    } else if (!isLTCG && gain > 0) {
      // STCG Sec 111A: 20% flat (Budget 2024 raised from 15%)
      const stcgTax = Math.round(gain * 0.20);
      capitalGainsBreakdown = {
        type: 'STCG on Equity (Sec 111A)', gain, taxRate: '20%',
        tax: stcgTax, holdingDays, note: 'Short-term: held < 1 year'
      };
      capitalGainsTax = stcgTax;
    }

    // Dividend taxed at slab rate (added to normal income)
    if (dividend > 0) {
      capitalGainsBreakdown.dividend = dividend;
      capitalGainsBreakdown.dividendNote = 'Dividend taxed at your income slab rate (added to total income)';
    }
  }

  // ── MUTUAL FUNDS ──
  else if (subcategory === 'mutual funds' || subcategory === 'mutual fund') {
    const investAmt    = Number(profile.investmentAmount  || purchaseAmt || 0);
    const redemptionAmt= Number(profile.redemptionAmount  || sellingAmt  || 0);
    const fundType     = (profile.fundType || 'Equity').toLowerCase();
    const gain         = redemptionAmt - investAmt;

    let holdingDays = 365;
    if (purchaseDate && sellingDate) {
      const pDate = new Date(purchaseDate);
      const sDate = new Date(sellingDate);
      holdingDays = Math.round((sDate - pDate) / (1000 * 60 * 60 * 24));
    }

    if (fundType.includes('equity') || fundType.includes('hybrid')) {
      // Equity MF: LTCG if held > 1yr (12.5% above ₹1.25L), STCG if ≤ 1yr (20%)
      const isLTCG = holdingDays > 365;
      if (isLTCG && gain > 0) {
        const taxableGain = Math.max(0, gain - 125000);
        const tax = Math.round(taxableGain * 0.125);
        capitalGainsBreakdown = { type: 'LTCG on Equity MF (Sec 112A)', gain, taxableGain, tax, holdingDays };
        capitalGainsTax = tax;
      } else if (!isLTCG && gain > 0) {
        const tax = Math.round(gain * 0.20);
        capitalGainsBreakdown = { type: 'STCG on Equity MF (Sec 111A)', gain, tax, holdingDays };
        capitalGainsTax = tax;
      }
    } else {
      // Debt MF: taxed at slab rate (added to normal income — no special rate after 2023 amendment)
      capitalGainsBreakdown = {
        type: 'Debt MF Gains', gain,
        note: 'Taxed at income slab rate (no LTCG/STCG distinction post April 2023)'
      };
      // Debt MF gains added to other_income for slab calculation — not a separate CG tax
    }
  }

  // ── F&O TRADING — Non-Speculative Business Income ──
  else if (subcategory === 'f&o trading' || subcategory === 'fno') {
    const buyValue      = Number(profile.totalBuyValue    || profile.buy_value    || 0);
    const sellValue     = Number(profile.totalSellValue   || profile.sell_value   || 0);
    const brokerageChg  = Number(profile.brokerageCharges || 0);
    const exchangeChg   = Number(profile.exchangeCharges  || 0);
    const netPL         = Number(profile.netProfitLoss    || profile.net_profit   || 0);

    // Validate: net P/L should match sell - buy - charges
    const computedPL = sellValue - buyValue - brokerageChg - exchangeChg;
    const plDiscrepancy = Math.abs(netPL - computedPL) > 1000 && buyValue > 0;

    capitalGainsBreakdown = {
      type: 'F&O — Non-Speculative Business Income (Sec 43(5))',
      buyValue, sellValue, brokerageChg, exchangeChg,
      computedPL: Math.round(computedPL),
      declaredPL: netPL,
      plDiscrepancy,
      note: 'F&O profit/loss added to total income and taxed at slab rate. No 87A rebate on business income.',
      warning: plDiscrepancy ? `Declared P/L ₹${netPL.toLocaleString()} differs from computed ₹${Math.round(computedPL).toLocaleString()} — please verify` : null,
    };
    // F&O income is added to normal income in calculateTax, not as separate CG tax
    capitalGainsTax = 0;
  }

  return { capitalGainsTax, capitalGainsBreakdown };
}

// ── RENTAL INCOME TAX — Sec 22 (Income from House Property) ──
function calcRentalIncomeTax(profile) {
  const monthlyRent   = Number(profile.monthlyRent    || profile.monthly_rent   || 0);
  const monthsRented  = Number(profile.monthsRented   || profile.months_rented  || 12);
  const municipalTax  = Number(profile.municipalTaxes || profile.municipal_tax  || 0);
  const loanInterest  = Number(profile.loanInterestPaid || profile.home_loan_interest || 0);
  const isCommercial  = (profile.subcategory || '').toLowerCase().includes('commercial');

  const annualRent    = monthlyRent * monthsRented;
  const netAnnualValue = Math.max(0, annualRent - municipalTax);
  const stdDeduction  = Math.round(netAnnualValue * 0.30);  // 30% standard deduction on NAV
  const interestDeduction = Math.min(loanInterest, isCommercial ? loanInterest : 200000); // ₹2L cap for self-occ
  const taxableHouseIncome = Math.max(0, netAnnualValue - stdDeduction - interestDeduction);

  return { annualRent, netAnnualValue, stdDeduction, interestDeduction, taxableHouseIncome };
}

// ── HRA EXEMPTION ──
function calcHRA(profile) {
  if (!profile.hra_received || !profile.rent_paid || !profile.basic_da) return 0;
  const hra     = profile.hra_received;
  const basic   = profile.basic_da;
  const rent    = profile.rent_paid;
  const isMetro = profile.is_metro || false;
  const a = hra;
  const b = isMetro ? basic * 0.50 : basic * 0.40;
  const c = Math.max(0, rent - basic * 0.10);
  return Math.min(a, b, c);
}

// ── OLD REGIME DEDUCTIONS ──
function calcOldRegimeDeductions(profile) {
  const age = Number(profile.age || 0);
  const d = {
    standardDeduction : 50000,
    section80C        : Math.min(Number(profile.section_80c        || 0), 150000),
    section80D        : Math.min(Number(profile.section_80d        || 0), age >= 60 ? 50000 : 25000),
    section80D_parents: Math.min(Number(profile.section_80d_parents || 0), 50000),
    section80CCD1B    : Math.min(Number(profile.nps_personal       || 0), 50000),
    section80E        : Number(profile.education_loan_interest     || 0),
    hra               : calcHRA(profile),
    homeLoanInterest  : Math.min(Number(profile.home_loan_interest || 0), 200000),
    professionalTax   : Math.min(Number(profile.professional_tax   || 0), 2500),
  };
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return { breakdown: d, total };
}

// ── HEALTH SCORE — realistic, not always 100 ──
function calcHealthScore(profile, oldResult, newResult, capitalGainsBreakdown) {
  let score = 100;

  // Deduction utilisation penalties
  if (Number(profile.section_80c  || 0) < 150000 * 0.8) score -= 15;
  if (Number(profile.section_80d  || 0) < 5000)          score -= 10;
  if (Number(profile.nps_personal || 0) < 1000)          score -= 10;

  // Wrong regime selected
  const diff = Math.abs(oldResult.totalTax - newResult.totalTax);
  if (diff > 20000) score -= 5;

  // Unclaimed HRA
  const d = oldResult.deductions.breakdown;
  if (profile.rent_paid > 0 && profile.hra_received > 0 && d.hra === 0) score -= 10;

  // Crypto / VDA penalty — high-risk, no loss carry-forward
  if (capitalGainsBreakdown?.type?.includes('Crypto')) score -= 15;

  // F&O trading — complex tax, discrepancy warning
  if (capitalGainsBreakdown?.plDiscrepancy) score -= 10;

  // Property loan interest not fully claimed
  const loanInterest = Number(profile.home_loan_interest || 0);
  if (loanInterest > 0 && loanInterest < 50000) score -= 5;

  // Future-date deductions (H3 / A2 / P2)
  const currentYear = new Date().getFullYear();
  const purchaseYear = profile.purchaseDate ? new Date(profile.purchaseDate).getFullYear() : currentYear;
  if (purchaseYear > currentYear) score -= 20;

  return Math.max(20, Math.min(100, score));
}

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

// ── MAIN EXPORT ──
function calculateTax(profile) {
  const gross = Number(profile.gross_salary || 0);

  if (gross <= 0) {
    throw new Error('Cannot calculate tax: gross salary is zero. Please add income details.');
  }

  // ── Capital Gains (category-specific, separate from slab) ──
  const { capitalGainsTax, capitalGainsBreakdown } = calcCapitalGainsTax(profile);

  // ── F&O and Debt MF profit added to normal income ──
  const subcategory = (profile.subcategory || profile.asset_type || '').toLowerCase();
  const fnoProfit = (subcategory === 'f&o trading' || subcategory === 'fno')
    ? Math.max(0, Number(profile.netProfitLoss || 0))
    : 0;

  // ── Rental income ──
  const rentalData = calcRentalIncomeTax(profile);
  const rentalTaxableIncome = rentalData.taxableHouseIncome || 0;

  // ── Dividend income — taxed at slab rate ──
  const dividendIncome = Number(profile.dividend_income || profile.dividendReceived || 0);

  // ── Total gross for slab calculation ──
  const totalGross = gross + fnoProfit + rentalTaxableIncome + dividendIncome;

  // ── OLD REGIME ──
  const oldDed      = calcOldRegimeDeductions(profile);
  // Old regime: home loan interest on let-out property is NOT capped (unlike self-occupied)
  const oldTaxable  = Math.max(0, totalGross - oldDed.total);
  let   oldSlabTax  = oldRegimeTax(oldTaxable);
  const oldRebate   = getOldRegimeRebate(oldTaxable, oldSlabTax);
  oldSlabTax        = Math.max(0, oldSlabTax - oldRebate);
  // Crypto tax is SEPARATE — added after rebate
  const oldTaxTotal = oldSlabTax + capitalGainsTax;
  const oldSurch    = getSurcharge(oldTaxTotal, oldTaxable);
  const oldCess     = getCess(oldTaxTotal + oldSurch);
  const oldTotal    = Math.round(oldTaxTotal + oldSurch + oldCess);

  // ── NEW REGIME — standard deduction ₹75,000 ──
  const newStd      = 75000;
  const newTaxable  = Math.max(0, totalGross - newStd);
  let   newSlabTax  = newRegimeTax(newTaxable);
  const newRebate   = getNewRegimeRebate(newTaxable, newSlabTax);
  newSlabTax        = Math.max(0, newSlabTax - newRebate);
  // Crypto tax is SEPARATE — added after rebate (87A does NOT apply to crypto)
  const newTaxTotal = newSlabTax + capitalGainsTax;
  const newSurch    = getSurcharge(newTaxTotal, newTaxable);
  const newCess     = getCess(newTaxTotal + newSurch);
  const newTotal    = Math.round(newTaxTotal + newSurch + newCess);

  const recommendedRegime = oldTotal <= newTotal ? 'old' : 'new';
  const saving            = Math.abs(oldTotal - newTotal);

  const oldResult = {
    regime          : 'old',
    taxableIncome   : oldTaxable,
    slabTax         : Math.round(oldSlabTax + oldRebate),  // pre-rebate for display
    rebate87A       : Math.round(oldRebate),
    capitalGainsTax : Math.round(capitalGainsTax),
    baseTax         : Math.round(oldSlabTax),
    surcharge       : Math.round(oldSurch),
    cess            : Math.round(oldCess),
    totalTax        : oldTotal,
    deductions      : oldDed,
    rebateApplied   : oldRebate > 0,
    recommendedRegime,
  };

  const newResult = {
    regime          : 'new',
    taxableIncome   : newTaxable,
    slabTax         : Math.round(newSlabTax + newRebate),  // pre-rebate for display
    rebate87A       : Math.round(newRebate),
    capitalGainsTax : Math.round(capitalGainsTax),
    baseTax         : Math.round(newSlabTax),
    surcharge       : Math.round(newSurch),
    cess            : Math.round(newCess),
    totalTax        : newTotal,
    deductions      : { breakdown: { standardDeduction: newStd }, total: newStd },
    rebateApplied   : newRebate > 0,
    recommendedRegime,
  };

  // ── LEAKAGE GAPS ──
  const gaps = [];

  if (Number(profile.section_80c || 0) < 150000) {
    const missed = 150000 - Number(profile.section_80c || 0);
    gaps.push({ section: '80C', missed, taxSaved: Math.round(missed * 0.30), action: 'Invest in PPF, ELSS, LIC or NSC to max ₹1.5L limit' });
  }
  if (Number(profile.nps_personal || 0) < 50000) {
    const missed = 50000 - Number(profile.nps_personal || 0);
    gaps.push({ section: '80CCD(1B)', missed, taxSaved: Math.round(missed * 0.30), action: 'Open NPS Tier-1 — ₹50K extra deduction beyond 80C' });
  }
  if (Number(profile.section_80d || 0) < 25000) {
    const missed = 25000 - Number(profile.section_80d || 0);
    gaps.push({ section: '80D', missed, taxSaved: Math.round(missed * 0.30), action: 'Buy health insurance — deduct premium up to ₹25K' });
  }
  // Personal vehicle loan — flag as non-deductible
  if (profile.category === 'Vehicle' && profile.usageType === 'Personal' && Number(profile.loanInterestPaid || 0) > 0) {
    gaps.push({ section: 'Vehicle Loan', missed: 0, taxSaved: 0, action: 'Vehicle loan interest is NOT deductible for personal use. Only business-use vehicles qualify.' });
  }
  // Crypto flag
  if (subcategory === 'crypto' && capitalGainsTax > 0) {
    gaps.push({ section: 'Crypto / VDA', missed: 0, taxSaved: 0, action: 'Crypto taxed at flat 30%. No deductions, no loss carry-forward. Consider tax-loss harvesting before year end.' });
  }

  const healthScore = calcHealthScore(profile, oldResult, newResult, capitalGainsBreakdown);
  const advanceTax  = calcAdvanceTax(recommendedRegime === 'old' ? oldTotal : newTotal);

  return {
    oldRegime         : oldResult,
    newRegime         : newResult,
    recommendedRegime,
    saving,
    healthScore,
    leakageGaps       : gaps,
    totalLeakage      : gaps.reduce((a, g) => a + g.taxSaved, 0),
    advanceTax,
    capitalGains      : { tax: capitalGainsTax, breakdown: capitalGainsBreakdown },
    rentalIncome      : rentalData,
    fnoProfit,
  };
}

// ── VALIDATION ──
function validateTaxResult(result) {
  const errors = [];
  const oldTaxable = result.oldRegime.taxableIncome;
  const newTaxable = result.newRegime.taxableIncome;
  const oldTotal   = result.oldRegime.totalTax;
  const newTotal   = result.newRegime.totalTax;

  if (oldTotal === 0 && oldTaxable > 500000) {
    errors.push('Incorrect rebate applied to Old Regime — taxable income exceeds ₹5L threshold');
  }
  if (newTotal === 0 && newTaxable > 1200000) {
    errors.push('Incorrect rebate applied to New Regime — taxable income exceeds ₹12L threshold');
  }
  if (result.capitalGains?.breakdown?.type?.includes('Crypto') && result.capitalGains.tax === 0 && result.capitalGains.breakdown.gain > 0) {
    errors.push('Crypto gains must be taxed at flat 30% — zero tax is incorrect');
  }

  return {
    valid : errors.length === 0,
    errors,
    newRegimeZeroReason : (newTotal === 0 && newTaxable <= 1200000)
      ? `Budget 2025 Section 87A rebate: taxable income ₹${newTaxable.toLocaleString()} is within ₹12L limit`
      : null,
    oldRegimeZeroReason : (oldTotal === 0 && oldTaxable <= 500000)
      ? `Section 87A rebate: taxable income ₹${oldTaxable.toLocaleString()} is within ₹5L limit`
      : null,
  };
}

module.exports = { calculateTax, calcHRA, calcAdvanceTax, calcHealthScore, validateTaxResult };
