// ─────────────────────────────────────────────
//  utils/supabase.js
//  Single Supabase client used across all files
// ─────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const key = process.env.SUPABASE_SERVICE_KEY;
console.log('[Supabase] URL:', process.env.SUPABASE_URL);
console.log('[Supabase] KEY prefix:', key ? key.substring(0, 30) + '...' : 'MISSING');
console.log('[Supabase] KEY length:', key ? key.length : 0);

const supabase = createClient(
  process.env.SUPABASE_URL,
  key   // service key — full DB access, backend only
);

module.exports = supabase;
