// ─────────────────────────────────────────────
//  routes/profile.js
//  All profile reads/writes use service role key
//  so RLS never blocks backend operations
// ─────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const supabase = require('../utils/supabase');

// POST /api/profile/save — onboarding + profile page writes
router.post('/save', async (req, res) => {
  try {
    const { userId, email, profilePayload, incomePayload } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { error: userErr } = await supabase
      .from('users')
      .upsert({ id: userId, email: email || null, ...profilePayload }, { onConflict: 'id' });

    if (userErr) {
      console.error('[profile/save] users error:', userErr.message);
      return res.status(500).json({ error: userErr.message });
    }

    if (incomePayload) {
      const { error: incErr } = await supabase
        .from('income_profile')
        .upsert({ user_id: userId, ...incomePayload }, { onConflict: 'user_id' });
      if (incErr) console.warn('[profile/save] income_profile error:', incErr.message);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[profile/save] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/save-income — income only (profile page)
router.post('/save-income', async (req, res) => {
  try {
    const { userId, incomePayload } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { error } = await supabase
      .from('income_profile')
      .upsert({ user_id: userId, ...incomePayload }, { onConflict: 'user_id' });

    if (error) {
      console.error('[profile/save-income] error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[profile/save-income] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/ensure-user — called by AuthContext on login
router.post('/ensure-user', async (req, res) => {
  try {
    const { userId, email, name } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id, name, full_name, onboarding_done, onboarding_complete, age, gender, marital_status, employment_type, sector, profession, state, city, is_metro')
      .eq('id', userId)
      .maybeSingle();

    if (existing) return res.json({ user: existing });

    // Insert new user
    const { data: inserted, error: insErr } = await supabase
      .from('users')
      .insert({ id: userId, email, name, full_name: name, onboarding_done: false, onboarding_complete: false, updated_at: new Date().toISOString() })
      .select('id, name, full_name, onboarding_done, onboarding_complete')
      .maybeSingle();

    if (insErr && insErr.code !== '23505') {
      console.error('[profile/ensure-user] insert error:', insErr.message);
    }

    // If insert failed due to race condition, read again
    if (!inserted) {
      const { data: retry } = await supabase
        .from('users')
        .select('id, name, full_name, onboarding_done, onboarding_complete')
        .eq('id', userId)
        .maybeSingle();
      return res.json({ user: retry || null });
    }

    return res.json({ user: inserted });
  } catch (err) {
    console.error('[profile/ensure-user] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/load/:userId
router.get('/load/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data: user }   = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    const { data: income } = await supabase.from('income_profile').select('*').eq('user_id', userId).maybeSingle();

    return res.json({ user: user || null, income: income || null });
  } catch (err) {
    console.error('[profile/load] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
