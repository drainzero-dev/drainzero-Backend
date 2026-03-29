function generateInsights(profile, result) {
  const insights = [];

  const eightyC = Number(profile.section_80c || 0);
  const eightyD = Number(profile.section_80d || 0);
  const nps     = Number(profile.nps_personal || 0);
  const employerNps = Number(profile.employer_nps || 0);
  const gross   = Number(profile.gross_salary || 0);

  if (eightyC < 150000) {
    const missed = 150000 - eightyC;
    insights.push({
      title: 'Unutilised 80C capacity',
      detail: `You still have ₹${missed.toLocaleString('en-IN')} of Section 80C limit left.`
    });
  }

  if (eightyD < 25000) {
    insights.push({
      title: 'Health insurance deduction available',
      detail: 'Section 80D can reduce taxable income if you claim eligible medical insurance premium.'
    });
  }

  if (nps < 50000) {
    const missed = 50000 - nps;
    insights.push({
      title: 'Additional NPS deduction available',
      detail: `Section 80CCD(1B) can still allow up to ₹${missed.toLocaleString('en-IN')} more deduction.`
    });
  }

  if (gross > 0 && employerNps === 0) {
    insights.push({
      title: 'Employer NPS may improve savings',
      detail: 'If your employer offers NPS contribution under Section 80CCD(2), it can improve tax efficiency.'
    });
  }

  insights.push({
    title: 'Recommended regime',
    detail: result.recommendedRegime === 'old'
      ? 'Old regime currently gives the lower tax liability based on saved deductions.'
      : 'New regime currently gives the lower tax liability based on your saved profile.'
  });

  return insights.slice(0, 5);
}

module.exports = { generateInsights };
