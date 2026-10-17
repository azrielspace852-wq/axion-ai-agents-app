/* AXION Search integration. The official AXION Search SDK is the sole search provider.
 * Page-content fallback is independent of the search service and attempts Jina Reader,
 * direct fetch, then configured/public CORS routes for pages whose results contain URLs only.
 */
window.AXION = window.AXION || {};
AXION.search = (() => {
  const S = () => AXION.settings || {};
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
  let sdk;
  const getSdk = () => {
    const base = (S().searchBase || 'https://axion-search.axn.cc.cd').replace(/\/+$/, '');
    if (!sdk || sdk.base !== base) {
      if (typeof window.AxionSDK !== 'function') throw new Error('Official AXION Search SDK is not loaded.');
      sdk = new AxionSDK({ base, timeout: Number(S().searchTimeout) || 30000 });
    }
    return sdk;
  };
  const unwrapData = d => {
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return { text: d, results: [], ok:false, error:'Search response was not JSON.' }; } }
    if (!d || typeof d !== 'object') return { raw:d, results:[], summary:'', ok:false, error:'Search response was not a JSON object.' };
    if (d.ok === false || d.success === false || d.error) return { raw:d, results:[], summary:'', ok:false, error:clean(d.error || d.message || 'Search service reported an error.') };
    const arrays = [d && d.results, d && d.web && d.web.results, d && d.data && d.data.results, d && d.items, d && d.hits, d && d.documents, d && d.data];
    let arr = arrays.find(Array.isArray) || [];
    if (!arr.length && d && typeof d === 'object' && d.result && Array.isArray(d.result)) arr = d.result;
    const results = arr.map((r, i) => ({
      title: clean(r.title || r.name || r.heading || r.url || r.link || `Result ${i + 1}`),
      url: String(r.url || r.link || r.href || r.source_url || ''),
      snippet: clean(r.content || r.snippet || r.description || r.summary || r.text || r.body || ''),
      content: clean(r.full_content || r.page_content || r.content_text || r.body_text || (r.content && typeof r.content === 'object' ? JSON.stringify(r.content) : '')),
    })).filter(r => /^https?:\/\//i.test(r.url));
    const summary = clean(d && (d.summary || d.answer || d.text || d.message || d.output) || '');
    return { raw: d, results, summary, ok: d && d.ok !== false && d.success !== false };
  };
  const fetchText = async (url, timeoutMs = 12000) => {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeoutMs);
    try { const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.7' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
    finally { clearTimeout(timer); }
  };
  const readable = (html, url) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,iframe,svg,nav,footer,header,form,aside,template,button').forEach(e => e.remove());
    const title = clean(doc.querySelector('title')?.textContent) || url;
    const root = doc.querySelector('article, main, [role="main"]') || doc.body;
    const parts = [...(root?.querySelectorAll('h1,h2,h3,h4,p,li,pre,blockquote,td,th') || [])].map(e => clean(e.textContent)).filter(x => x.length > 2);
    let body = parts.join('\n\n'); if (body.length < 160) body = clean(root?.textContent || '');
    return { title, body: body.slice(0, 12000) };
  };
  const fetchPage = async (url, maxChars = 12000) => {
    url = String(url || '').trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const attempts = [];
    // 1. Jina Reader is a separate content extractor, not a search provider.
    try { const t = await fetchText('https://r.jina.ai/' + url, 18000); if (t.length > 120 && !/captcha|access denied|robot check/i.test(t.slice(0, 1200))) return `URL: ${url}\nFetched via: Jina Reader fallback\n\n${t.slice(0, maxChars)}`; throw new Error('empty or blocked response'); }
    catch (e) { attempts.push('Jina: ' + e.message); }
    // 2. Independent direct retrieval. Browser CORS may block it; report that accurately.
    try { const h = await fetchText(url, 10000); const r = readable(h, url); if (r.body.length > 100) return `URL: ${url}\nFetched via: direct page fallback\nTitle: ${r.title}\n\n${r.body.slice(0, maxChars)}`; throw new Error('no readable page body'); }
    catch (e) { attempts.push('direct: ' + e.message); }
    // 3. Independent fallback routes for common public CORS-enabled readers.
    for (const px of [u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u), u => 'https://corsproxy.io/?url=' + encodeURIComponent(u)]) {
      try { const h = await fetchText(px(url), 10000); const r = readable(h, url); if (r.body.length > 100) return `URL: ${url}\nFetched via: independent proxy fallback\nTitle: ${r.title}\n\n${r.body.slice(0, maxChars)}`; }
      catch (e) { attempts.push('proxy: ' + e.message); }
    }
    return `Fetch failed for ${url}. Content could not be retrieved by independent fallbacks. Attempts: ${attempts.join(' | ')}. Use only the search-result snippet and clearly state that page content was unavailable.`;
  };
  const searchRaw = async query => {
    const q = clean(query); if (!q) throw new Error('Search query is empty.');
    const result = unwrapData(await getSdk().search(q, { type: 'web', safe: true, lang: S().lang || 'en' }));
    if (!result.ok) throw new Error(result.error || 'AXION Search request failed.');
    if (!result.results.length && !result.summary) throw new Error('AXION Search returned a valid but empty JSON response.');
    return result;
  };
  const search = async query => {
    const q = clean(query);
    try {
      const d = await searchRaw(q);
      const enriched = await Promise.all(d.results.slice(0, 5).map(async r => {
        if (r.content.length > 240 || r.snippet.length > 900) return r;
        const fetched = await fetchPage(r.url, 4500);
        if (fetched.startsWith('Fetch failed')) return r;
        const body = fetched.split('\n\n').slice(1).join('\n\n');
        return { ...r, content: body, snippet: body.slice(0, 900) || r.snippet };
      }));
      const results = d.results.map((r, i) => enriched[i] || r);
      return [`AXION Search for "${q}" — ${new Date().toLocaleString()}`, d.summary ? `\nAXION Search summary: ${d.summary}` : '', ...results.map((r,i) => `\n${i+1}. ${r.title}\nURL: ${r.url}\n${r.content || r.snippet || '(No page content returned; use the URL to verify independently.)'}`)].join('\n').slice(0, 36000);
    } catch (e) { return `AXION Search failed for "${q}": ${e.message}. Do not fabricate results. Check the AXION Search service/domain and browser network or CORS configuration.`; }
  };
  const deepSearch = async (query, topN = 3) => {
    const q = clean(query);
    try {
      const d = await searchRaw(q); const top = d.results.slice(0, Math.max(1, Math.min(6, topN)));
      const pages = await Promise.all(top.map(async r => ({ ...r, fetched: r.content.length > 300 ? `URL: ${r.url}\n\n${r.content}` : await fetchPage(r.url, 6500) })));
      let out = `AXION Search deep research for "${q}" (${new Date().toLocaleString()})\n`;
      if (d.summary) out += `\nSummary from AXION Search: ${d.summary}\n`;
      pages.forEach((r,i) => { out += `\n===== ${i+1}. ${r.title} =====\nURL: ${r.url}\n${r.fetched}\n`; if (r.snippet) out += `Search snippet: ${r.snippet}\n`; });
      if (d.results.length > top.length) out += '\nAdditional results:\n' + d.results.slice(top.length).map(r => `- ${r.title} — ${r.url}`).join('\n');
      return out.slice(0, 36000);
    } catch (e) { return `AXION Search deep research failed for "${q}": ${e.message}. No results were invented.`; }
  };
  const test = async onProgress => {
    const rows = []; const t0 = Date.now();
    try { const d = await searchRaw('AXION AI search engine integration'); const row = { id: 'axion-search', label: 'Official AXION Search SDK', ok: d.results.length > 0 || !!d.summary, ms: Date.now()-t0, info: `${d.results.length} results from ${S().searchBase || 'https://axion-search.axn.cc.cd'}` }; rows.push(row); onProgress && onProgress(row); }
    catch (e) { const row = { id: 'axion-search', label: 'Official AXION Search SDK', ok: false, ms: Date.now()-t0, info: e.message.slice(0,240) }; rows.push(row); onProgress && onProgress(row); }
    return rows;
  };
  return { search, searchRaw, fetchPage, deepSearch, test, getSdk };
})();
