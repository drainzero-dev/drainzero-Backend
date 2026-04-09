// ─────────────────────────────────────────────
//  routes/analyse.js  —  POST /api/analyse
//  FIXED:
//  - Rejects if income profile missing or salary=0
//  - No fake zero-income row creation
//  - Uses Math.min() caps in tax calc
//  - Returns clear error codes
// ─────────────────────────────────────────────

const express          = require('express');
const router           = express.Router();
const supabase         = require('../utils/supabase');
const { calculateTax, validateTaxResult } = require('../tools/taxCalculator');

router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // ── Fetch user row ──
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) {
      console.error('[analyse] users fetch error:', userErr.message);
      return res.status(500).json({ error: 'Failed to fetch user: ' + userErr.message });
    }

    // If no user row yet, create a minimal one (new Google login user)
    let finalUser = user;
    if (!user) {
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

    if (incErr) {
      console.error('[analyse] income_profile fetch error:', incErr.message);
      return res.status(500).json({ error: 'Failed to fetch income data: ' + incErr.message });
    }

    // CRITICAL FIX: Do NOT create a zero-salary row and proceed.
    // If income is missing or zero, return a clear error so the frontend
    // can show "Add Income Details" instead of showing ₹0 tax as real result.
    if (!income || !income.gross_salary || Number(income.gross_salary) <= 0) {
      return res.status(400).json({
        error: 'Income profile not found or salary is zero. Please add your income details before running analysis.',
        code : 'NO_INCOME_DATA',
      });
    }

    // ── Merge user + income — real data only ──
    const profile = { ...finalUser, ...income };

    // ── Run tax calculation ──
    const result = calculateTax(profile);

    // ── Validate result ──
    const validation = validateTaxResult(result);
    if (!validation.valid) {
      console.warn('[analyse] Tax validation warnings:', validation.errors);
    }

    // ── Persist result ──
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
      // Non-fatal — result still returned to user
      console.warn('[analyse] Could not save tax_results:', saveErr.message);
    }

    res.json({
      success: true,
      ...result,
      validation,   // includes errors[], newRegimeZeroReason, oldRegimeZeroReason
    });

  } catch (err) {
    console.error('[/api/analyse]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error during analysis' });
  }
});

module.exports = router;
