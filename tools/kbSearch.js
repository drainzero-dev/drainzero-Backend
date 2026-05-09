// ─────────────────────────────────────────────
//  tools/kbSearch.js
//  Full-text search using PostgreSQL match_knowledge_base function
// ─────────────────────────────────────────────

const supabase = require('../utils/supabase');

async function searchKB(query, limit = 5) {
  try {
    // Use PostgreSQL full-text search via the match_knowledge_base function
    const { data, error } = await supabase.rpc('match_knowledge_base', {
      query_text : query,
      match_count: limit
    });

    if (error) throw error;

    // If full-text search returns nothing, fallback to ILIKE
    if (!data || data.length === 0) {
      const { data: fallback } = await supabase
        .from('knowledge_base')
        .select('id, title, category, content, section, tags, updated_fy')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,section.ilike.%${query}%`)
        .limit(limit);
      return { results: fallback || [], count: (fallback || []).length, query };
    }

    return { results: data || [], count: (data || []).length, query };
  } catch (err) {
    console.error('[kbSearch] Search failed, using ILIKE fallback:', err.message);
    const { data } = await supabase
      .from('knowledge_base')
      .select('id, title, category, content, section, tags, updated_fy')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,section.ilike.%${query}%`)
      .limit(limit);
    return { results: data || [], count: (data || []).length, query };
  }
}

async function searchKBByCategory(category, limit = 20) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, title, category, content, section, tags, updated_fy')
    .eq('category', category)
    .limit(limit);

  if (error) throw error;
  return { results: data || [], count: (data || []).length };
}

async function searchKBBySection(section) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .ilike('section', `%${section}%`)
    .limit(3);

  if (error) throw error;
  return { results: data || [], count: (data || []).length };
}

module.exports = { searchKB, searchKBByCategory, searchKBBySection };
