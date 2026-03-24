// ─────────────────────────────────────────────
//  routes/analyse.js
//  POST /api/analyse
//  Calculates tax, health score, leakage gaps
// ─────────────────────────────────────────────

const express        = require('express');
const router         = express.Router();
const supabase       = require('../utils/supabase');
const { calculateTax } = require('../tools/taxCalculator');

router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // ── Fetch user profile from Supabase ──
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    let finalUser = user;
if (userErr || !user) {
  const { data: newUser, error: insertErr } = await supabase
    .from('users')
    .insert({ id: userId, email: req.body.email || null })
    .select()
    .single();
  if (insertErr) return res.status(500).json({ error: 'User creation failed' });
  finalUser = newUser;
}

    const { data: income, error: incErr } = await supabase
      .from('income_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    let finalIncome = income;
if (incErr || !income) {
  const { data: newIncome, error: insertErr } = await supabase
    .from('income_profile')
    .insert({ user_id: userId })
    .select()
    .single();
  if (insertErr) return res.status(500).json({ error: 'Income profile creation failed' });
  finalIncome = newIncome;
}

    // ── Merge user + income profile ──
    const profile = { ...user, ...income };

    // ── Run tax calculation ──
    const result = calculateTax(profile);

    // ── Save result to Supabase ──
    await supabase.from('tax_results').upsert({
      user_id           : userId,
      old_tax           : result.oldRegime.totalTax,
      new_tax           : result.newRegime.totalTax,
      recommended_regime: result.recommendedRegime,
      total_leakage     : result.totalLeakage,
      health_score      : result.healthScore,
      leakage_gaps      : result.leakageGaps,
      computed_at       : new Date().toISOString()
    }, { onConflict: 'user_id' });

    res.json({
      success: true,
      ...result
    });

  } catch (err) {
    console.error('[/api/analyse]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
