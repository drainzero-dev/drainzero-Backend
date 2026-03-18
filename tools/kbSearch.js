// ─────────────────────────────────────────────
//  tools/kbSearch.js
//  Semantic search using pgvector + Gemini embeddings
// ─────────────────────────────────────────────

const { GoogleGenAI } = require('@google/genai');
const supabase        = require('../utils/supabase');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getEmbedding(text) {
  const result = await ai.models.embedContent({
    model   : 'gemini-embedding-2-preview',
    contents : text,
    config  : { outputDimensionality: 768 }
  });
  return result.embeddings[0].values;
}

async function searchKB(query, limit = 5) {
  try {
    const embedding = await getEmbedding(query);

    const { data, error } = await supabase.rpc('match_knowledge_base', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count    : limit
    });

    if (error) throw error;

    return {
      results: data || [],
      count  : (data || []).length,
      query
    };
  } catch (err) {
    console.error('[kbSearch] Semantic failed, falling back to text:', err.message);

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
