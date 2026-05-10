// ─────────────────────────────────────────────
//  routes/profile.js  —  POST /api/profile/save
//  Saves onboarding data using service role key
//  bypassing RLS entirely — reliable write
// ─────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const supabase = require('../utils/supabase');

router.post('/save', async (req, res) => {
  try {
    const { userId, email, profilePayload, incomePayload } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Save to users table (service role bypasses RLS)
    const { error: userErr } = await supabase
      .from('users')
      .upsert(
        { id: userId, email: email || null, ...profilePayload },
        { onConflict: 'id' }
      );

    if (userErr) {
      console.error('[profile/save] users upsert error:', userErr.message);
      return res.status(500).json({ error: userErr.message });
    }

    // Save to income_profile table
    if (incomePayload) {
      const { error: incErr } = await supabase
        .from('income_profile')
        .upsert(
          { user_id: userId, ...incomePayload },
          { onConflict: 'user_id' }
        );

      if (incErr) {
        console.warn('[profile/save] income_profile error:', incErr.message);
        // Non-fatal — users table saved successfully
      }
    }

    return res.json({ success: true });

  } catch (err) {
    console.error('[profile/save] Unexpected error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/load/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userErr) return res.status(500).json({ error: userErr.message });

    const { data: income, error: incErr } = await supabase
      .from('income_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (incErr) console.warn('[profile/load] income_profile error:', incErr.message);

    return res.json({ user: user || null, income: income || null });

  } catch (err) {
    console.error('[profile/load] Unexpected error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
