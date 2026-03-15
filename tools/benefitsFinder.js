// ─────────────────────────────────────────────
//  tools/benefitsFinder.js
//  Matches profession + state + family to benefits
// ─────────────────────────────────────────────

const BENEFITS = [

  // ── PROFESSION — DEFENCE ──
  {
    id        : 'BN01',
    title     : 'Army CSD Canteen — Subsidised Goods',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['defence', 'army', 'navy', 'airforce', 'military'],
    description: 'Canteen Stores Department provides subsidised groceries, electronics, liquor, and vehicles to serving and retired defence personnel. Savings of 15-40% vs market.',
    link      : 'https://csdindia.gov.in',
    check     : (p) => ['army', 'navy', 'airforce', 'defence', 'military'].includes(
                  (p.profession_subtype || p.profession_type || '').toLowerCase()
                )
  },
  {
    id        : 'BN02',
    title     : 'AGIF — Army Group Insurance Fund',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['army', 'defence'],
    description: 'Subsidised life insurance for army personnel. Premium much lower than market. Family covered. Death/disability benefits.',
    check     : (p) => (p.profession_subtype || '').toLowerCase().includes('army')
  },
  {
    id        : 'BN03',
    title     : 'AWHO Housing — Army Welfare Housing Organisation',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['army', 'defence'],
    description: 'Below-market housing in prime locations for army personnel. Apply after 8 years of service. Major cities covered.',
    link      : 'https://awho.org',
    check     : (p) => (p.profession_subtype || '').toLowerCase().includes('army')
  },
  {
    id        : 'BN04',
    title     : 'Siachen / Field Area Allowance — Fully Tax-Free',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['army', 'navy', 'airforce', 'defence'],
    description: 'Siachen allowance, field area allowance, counter-insurgency allowance — all 100% exempt from income tax under Section 10(14). Gallantry award money also tax-free.',
    check     : (p) => ['army', 'navy', 'airforce', 'defence'].includes(
                  (p.profession_subtype || p.profession_type || '').toLowerCase()
                )
  },
  {
    id        : 'BN05',
    title     : 'Railway LTC — Leave Travel Concession',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['railway', 'railways'],
    description: 'Railway employees get free/subsidised train passes for self and family. LTC concession for hometown + once every 4 years to any place in India. Tax exempt under Section 10(5).',
    check     : (p) => (p.profession_subtype || p.profession_type || '').toLowerCase().includes('railway')
  },
  {
    id        : 'BN06',
    title     : '44ADA — 50% Presumptive for IT Freelancers',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['freelancer', 'it', 'software', 'consultant'],
    description: 'IT freelancers can declare 50% of gross receipts as income. No books, no audit up to ₹75L. Export income (Upwork, Fiverr) also attracts 0% GST.',
    check     : (p) => {
      const t = (p.profession_type || '').toLowerCase();
      return t.includes('freelancer') || t.includes('self-employed');
    }
  },
  {
    id        : 'BN07',
    title     : 'Police Welfare Fund — State Schemes',
    category  : 'Profession',
    tab       : 'Profession',
    tags      : ['police'],
    description: 'Most states have police welfare funds offering interest-free loans, housing, scholarships for children, and medical benefits for serving officers.',
    check     : (p) => (p.profession_subtype || p.profession_type || '').toLowerCase().includes('police')
  },

  // ── STATE BENEFITS ──
  {
    id        : 'BN08',
    title     : 'Telangana — Women Stamp Duty Concession (Property)',
    category  : 'State',
    tab       : 'State',
    tags      : ['telangana', 'property', 'women'],
    description: 'Women buyers in Telangana get stamp duty concession on property registration. Check current rate with your sub-registrar office — rates updated periodically.',
    check     : (p) => p.state && p.state.toLowerCase().includes('telangana')
  },
  {
    id        : 'BN09',
    title     : 'Telangana EV Subsidy — Electric Vehicles',
    category  : 'State',
    tab       : 'State',
    tags      : ['telangana', 'ev', 'electric vehicle'],
    description: 'Telangana EV policy offers road tax exemption + registration fee waiver on electric two-wheelers and four-wheelers. Check Telangana EV portal for current subsidy amounts.',
    link      : 'https://ev.telangana.gov.in',
    check     : (p) => p.state && p.state.toLowerCase().includes('telangana')
  },
  {
    id        : 'BN10',
    title     : 'Delhi — EV Cash Subsidy up to ₹1.5L',
    category  : 'State',
    tab       : 'State',
    tags      : ['delhi', 'ev', 'electric vehicle'],
    description: 'Delhi EV Policy 2020 offers ₹1.5L cash subsidy on electric cars + zero road tax + zero registration fee. Best EV deal in India currently.',
    link      : 'https://ev.delhi.gov.in',
    check     : (p) => p.state && p.state.toLowerCase().includes('delhi')
  },
  {
    id        : 'BN11',
    title     : 'Karnataka — 0% Road Tax on EVs',
    category  : 'State',
    tab       : 'State',
    tags      : ['karnataka', 'bangalore', 'ev'],
    description: 'Karnataka waives road tax entirely on electric vehicles. Combined with central PM E-Drive subsidy, significant savings on EV purchase in Bangalore.',
    check     : (p) => p.state && (p.state.toLowerCase().includes('karnataka') || p.state.toLowerCase().includes('bangalore'))
  },
  {
    id        : 'BN12',
    title     : 'Women Car Loan Concession — Lower Rate + Higher LTV',
    category  : 'State',
    tab       : 'State',
    tags      : ['women', 'car loan', 'vehicle', 'married'],
    description: 'PSU banks (Canara, SBI, PNB, UCO, Union) offer women primary applicants: 0.05–0.50% lower interest rate + 90-100% on-road price funding (minimal/zero down payment). Vehicle must be registered in wife\'s name. For married couples: wife as primary applicant, husband as co-applicant = best deal.',
    savingEstimate: 'On ₹10L loan over 5 years: saves ₹15K–₹30K in interest',
    check     : (p) => p.marital_status === 'married' || p.gender === 'female'
  },

  // ── SENIOR / DISABILITY ──
  {
    id        : 'BN13',
    title     : '80TTB — ₹50K Interest Deduction for Seniors',
    category  : 'Senior',
    tab       : 'Senior',
    tags      : ['senior', 'elderly', 'retired'],
    description: 'Senior citizens (60+) can deduct up to ₹50K of interest income (FD, savings, RD) under 80TTB. Non-seniors only get ₹10K under 80TTA.',
    check     : (p) => (p.age || 0) >= 60
  },
  {
    id        : 'BN14',
    title     : 'SCSS — 8.2% Senior Citizen Savings Scheme',
    category  : 'Senior',
    tab       : 'Senior',
    tags      : ['senior', 'investment'],
    description: 'SCSS offers 8.2% interest (Q1 FY26) — highest guaranteed return from government. Max deposit ₹30L. 5-year tenure. Interest paid quarterly. Best FD alternative for seniors.',
    check     : (p) => (p.age || 0) >= 60
  },
  {
    id        : 'BN15',
    title     : 'No Advance Tax for Senior Citizens (Pension only)',
    category  : 'Senior',
    tab       : 'Senior',
    tags      : ['senior', 'advance tax'],
    description: 'Seniors aged 60+ with NO business income are fully exempt from paying advance tax. Pay all tax in one shot at ITR filing time — no quarterly instalments.',
    check     : (p) => (p.age || 0) >= 60 && p.profession_type === 'retired'
  },
  {
    id        : 'BN16',
    title     : '80DD — Disability Dependent Deduction ₹75K–₹1.25L',
    category  : 'Disability',
    tab       : 'Senior',
    tags      : ['disability', 'dependent'],
    description: 'Deduct ₹75K (normal disability) or ₹1.25L (severe disability, 80%+) for expenses on disabled dependent. No actual expenditure proof needed — flat deduction.',
    check     : (p) => p.family && p.family.disabled_dependent === true
  },

  // ── GOVERNMENT SCHEMES ──
  {
    id        : 'BN17',
    title     : 'PM E-Drive — Central EV Subsidy',
    category  : 'Schemes',
    tab       : 'Schemes',
    tags      : ['ev', 'electric vehicle', 'subsidy'],
    description: 'PM E-Drive scheme (2024-26) offers direct subsidies on electric two-wheelers and buses. E2W: up to ₹10K subsidy. Check FAME portal for latest dealer-level offers.',
    link      : 'https://fame2.heavyindustries.gov.in',
    check     : (p) => true
  },
  {
    id        : 'BN18',
    title     : 'Sukanya Samriddhi Yojana — 8.2% EEE for Girl Child',
    category  : 'Schemes',
    tab       : 'Schemes',
    tags      : ['girl child', 'investment', 'ssy'],
    description: 'SSY: 8.2% interest, Exempt-Exempt-Exempt (investment, growth, maturity all tax-free). Better than PPF (7.1%). Open for girl children under 10. Matures at 21 years.',
    check     : (p) => {
      const children = p.family && p.family.children;
      return children && children.some(c => c.gender === 'female' && c.age < 10);
    }
  },
  {
    id        : 'BN19',
    title     : 'NSP Scholarships — National Scholarship Portal',
    category  : 'Scholarships',
    tab       : 'Scholarships',
    tags      : ['scholarship', 'student', 'education'],
    description: 'NSP aggregates all central + state scholarships. Pre-matric, post-matric, merit-cum-means. Deadline usually September-October each year. Apply at scholarships.gov.in.',
    link      : 'https://scholarships.gov.in',
    check     : (p) => {
      const children = p.family && p.family.children;
      return (children && children.some(c => c.studying === true)) || p.profession_type === 'student';
    }
  },
  {
    id        : 'BN20',
    title     : 'PM Kisan — ₹6,000 / Year for Farmers',
    category  : 'Schemes',
    tab       : 'Schemes',
    tags      : ['farmer', 'agriculture', 'pm kisan'],
    description: 'PM Kisan Samman Nidhi gives ₹6,000/year (₹2K each installment) directly to farmer bank accounts. If you own agricultural land, register on PM Kisan portal.',
    link      : 'https://pmkisan.gov.in',
    check     : (p) => p.assets && p.assets.agricultural_land === true
  }
];

// ── MAIN EXPORT ──
function findBenefits(profile) {
  const matched = [];
  const byTab = {};

  for (const b of BENEFITS) {
    let applicable = false;
    try {
      applicable = b.check(profile);
    } catch (e) {
      applicable = false;
    }

    if (applicable) {
      const item = {
        id         : b.id,
        title      : b.title,
        category   : b.category,
        tab        : b.tab,
        tags       : b.tags,
        description: b.description,
        link       : b.link || null,
        savingEstimate: b.savingEstimate || null
      };
      matched.push(item);

      if (!byTab[b.tab]) byTab[b.tab] = [];
      byTab[b.tab].push(item);
    }
  }

  return {
    matched,
    matchedCount: matched.length,
    byTab
  };
}

module.exports = { findBenefits, BENEFITS };
