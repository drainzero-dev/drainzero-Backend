// ─────────────────────────────────────────────
//  routes/analyse.js
//  POST /api/analyse
//  Calculates tax, health score, leakage gaps
// ─────────────────────────────────────────────

const express          = require('express');
const router           = express.Router();
const supabase         = require('../utils/supabase');
const { calculateTax } = require('../tools/taxCalculator');

router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // ── Fetch user profile ──
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();                        // maybeSingle — won't throw if row missing

    let finalUser = user;

    if (userErr || !user) {
      // First-time user — create a minimal row so analysis can continue
      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert({ id: userId })
        .select()
        .single();

      if (insertErr) {
        console.error('[analyse] Cannot create user row:', insertErr.message);
        return res.status(500).json({ error: 'User not found and could not be created.' });
      }
      finalUser = newUser;
    }

    // ── Fetch income profile ──
    const { data: income, error: incErr } = await supabase
      .from('income_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let finalIncome = income;

    if (incErr || !income) {
      // No income profile yet — create a default one with zeros
      const { data: newIncome, error: incInsertErr } = await supabase
        .from('income_profile')
        .insert({ user_id: userId, gross_salary: 0 })
        .select()
        .single();

      if (incInsertErr) {
        console.error('[analyse] Cannot create income_profile:', incInsertErr.message);
        return res.status(404).json({
          error: 'Income profile not found. Please complete onboarding and add your income details.',
        });
      }
      finalIncome = newIncome;
    }

    // ── BUG FIX: was using stale `user` and `income`, now uses `finalUser`/`finalIncome` ──
    const profile = { ...finalUser, ...finalIncome };

    // ── Run tax calculation ──
    const result = calculateTax(profile);

    // ── Save result to Supabase ──
    const { error: saveErr } = await supabase.from('tax_results').upsert({
      user_id           : userId,
      old_tax           : result.oldRegime.totalTax,
      new_tax           : result.newRegime.totalTax,
      recommended_regime: result.recommendedRegime,
      total_leakage     : result.totalLeakage,
      health_score      : result.healthScore,
      leakage_gaps      : result.leakageGaps,
      computed_at       : new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (saveErr) {
      console.warn('[analyse] Could not save tax_results:', saveErr.message);
      // Non-fatal — still return the result
    }

    res.json({ success: true, ...result });

  } catch (err) {
    console.error('[/api/analyse]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
