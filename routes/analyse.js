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

    if (userErr || !user) return res.status(404).json({ error: 'User not found' });

    const { data: income, error: incErr } = await supabase
      .from('income_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (incErr || !income) return res.status(404).json({ error: 'Income profile not found' });

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
