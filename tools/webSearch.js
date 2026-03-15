// ─────────────────────────────────────────────
//  tools/webSearch.js
//  Real-time tax rule search via Serper.dev
//  Used by agent for latest Budget 2026 rules
// ─────────────────────────────────────────────

async function webSearch(query, numResults = 5) {
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method : 'POST',
      headers: {
        'X-API-KEY'   : process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q  : `${query} India income tax FY 2025-26`,
        num: numResults,
        gl : 'in',   // India results
        hl : 'en'
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract clean results
    const results = (data.organic || []).map(r => ({
      title  : r.title,
      snippet: r.snippet,
      link   : r.link
    }));

    return {
      results,
      count: results.length,
      query
    };
  } catch (err) {
    console.error('[webSearch] Error:', err.message);
    return { results: [], count: 0, query, error: err.message };
  }
}

module.exports = { webSearch };
