const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { calculateTax } = require('../tools/taxCalculator');
const { generateInsights } = require('../tools/insightEngine');

router.post('/', async (req, res) => {
  try {
    const { userId, email = null } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    let { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) throw userErr;

    if (!user) {
      const inserted = await supabase
        .from('users')
        .upsert({
          id: userId,
          email,
          onboarding_done: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select('*')
        .single();

      if (inserted.error) throw inserted.error;
      user = inserted.data;
    }

    let { data: income, error: incErr } = await supabase
      .from('income_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (incErr) throw incErr;

    if (!income) {
      const insertedIncome = await supabase
        .from('income_profile')
        .upsert({
          user_id: userId,
          gross_salary: 0,
          basic_da: 0,
          hra_received: 0,
          preferred_regime: 'new'
        }, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (insertedIncome.error) throw insertedIncome.error;
      income = insertedIncome.data;
    }

    const profile = { ...user, ...income };
    const result = calculateTax(profile);
    const insights = generateInsights(profile, result);
    const regimeExplanation = result.recommendedRegime === 'old'
      ? 'Old regime is better because your current deduction profile reduces taxable income more effectively.'
      : 'New regime is better because the lower slab structure plus standard deduction currently gives you a better outcome.';

    const savePayload = {
      user_id: userId,
      old_tax: result.oldRegime.totalTax,
      new_tax: result.newRegime.totalTax,
      recommended_regime: result.recommendedRegime,
      total_leakage: result.totalLeakage,
      health_score: result.healthScore,
      leakage_gaps: result.leakageGaps,
      loopholes_matched: insights,
      computed_at: new Date().toISOString()
    };

    const { error: saveErr } = await supabase
      .from('tax_results')
      .upsert(savePayload, { onConflict: 'user_id' });

    if (saveErr) throw saveErr;

    res.json({
      success: true,
      ...result,
      insights,
      regimeExplanation
    });
  } catch (err) {
    console.error('[/api/analyse]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
