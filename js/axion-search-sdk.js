/* ============================================================
 *  AXION Search SDK v4 — UMD, zero dependencies
 *  Usage:
 *    const axn = new AxionSDK({ base: 'https://axion-search.axn.cc.cd' });
 *    await axn.search(q, { type:'web', safe:true, lang:'en' });
 *    await axn.summary(q, { model:'gemini-2.5-flash', lang:'en' });
 *    await axn.chat([{role:'user', content:'...'}], { lang:'id' });
 *    await axn.aiToolSearch('berita terbaru');   // untuk layanan AI eksternal
 *    axn.searchUrl('kucing');   // /search?q=kucing
 *    axn.shortUrl('kucing');    // /s/kucing
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AxionSDK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function AxionSDK(opts) {
    opts = opts || {};
    this.base = (opts.base || 'https://axion-search.axn.cc.cd').replace(/\/+$/, '');
    this.timeout = opts.timeout || 100000;
  }
  AxionSDK.prototype._req = function (method, path, params, body) {
    var self = this;
    var qs = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var url = this.base + path + (qs ? '?' + qs : '');
    var opts = { method: method, headers: { Accept: 'application/json' } };
    if (method === 'POST') { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body || {}); }
    var structuredError = function (message, status) { return { ok: false, success: false, error: String(message || 'Unknown AXION Search error'), httpStatus: status || 0, results: [], data: { results: [] } }; };
    if (typeof fetch === 'function') {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) opts.signal = controller.signal;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, self.timeout);
      return fetch(url, opts).then(function (r) {
        return r.text().then(function (text) {
          var parsed;
          try { parsed = JSON.parse(text); }
          catch (_) {
            var looksHtml = /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(text) || /<body[\s>]/i.test(text.slice(0, 1000));
            var message = looksHtml
              ? 'AXION Search endpoint returned HTML instead of JSON (HTTP ' + r.status + '). Check the service route, reverse proxy, Cloudflare challenge, or endpoint deployment.'
              : 'AXION Search endpoint returned malformed JSON (HTTP ' + r.status + ').';
            return structuredError(message, r.status);
          }
          if (!r.ok) {
            if (parsed && typeof parsed === 'object') { parsed.ok = false; parsed.success = false; parsed.httpStatus = r.status; parsed.error = parsed.error || parsed.message || ('HTTP ' + r.status); return parsed; }
            return structuredError('HTTP ' + r.status, r.status);
          }
          if (Array.isArray(parsed)) return { ok: true, success: true, httpStatus: r.status, results: parsed, data: { results: parsed } };
          if (!parsed || typeof parsed !== 'object') return structuredError('AXION Search returned a valid JSON scalar instead of an object payload.', r.status);
          return parsed;
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return structuredError('AXION Search request timed out after ' + self.timeout + ' ms.', 0);
        return structuredError('AXION Search network/CORS error: ' + (e && e.message || e), 0);
      }).then(function (data) { return data; }).finally(function () { clearTimeout(timer); });
    }
    return Promise.resolve(structuredError('Fetch API is not available in this environment.', 0));
  };
  AxionSDK.prototype.search = function (query, opts) {
    opts = opts || {};
    return this._req('GET', '/api/v1/search', { q: query, type: opts.type || 'web', safe: opts.safe === false ? '0' : '1', lang: opts.lang || 'en' });
  };
  AxionSDK.prototype.summary = function (query, opts) {
    opts = opts || {};
    return this._req('GET', '/api/summary', { q: query, model: opts.model || 'gemini-2.5-flash', ai: '1', lang: opts.lang || 'en' });
  };
  AxionSDK.prototype.chat = function (messages, opts) {
    opts = opts || {};
    return this._req('POST', '/api/v1/chat', {}, { messages: messages, model: opts.model || 'gemini-2.5-flash', lang: opts.lang || 'en', safe: opts.safe !== false });
  };
  AxionSDK.prototype.aiToolSearch = function (query, opts) {
    opts = opts || {};
    return this._req('GET', '/api/v1/tool/search', { q: query, safe: opts.safe === false ? '0' : '1', lang: opts.lang || 'en' });
  };
  AxionSDK.prototype.health = function () { return this._req('GET', '/health', {}); };
  AxionSDK.prototype.searchUrl = function (query) { return this.base + '/search?q=' + encodeURIComponent(query); };
  AxionSDK.prototype.shortUrl = function (query) { return this.base + '/s/' + encodeURIComponent(query); };
  AxionSDK.prototype.openaiToolSpec = function () {
    return { type: 'function', function: { name: 'axion_web_search', description: 'Search the web via AXION Search. Returns up-to-date titles, URLs and snippets to ground AI answers.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } } };
  };
  return AxionSDK;
});
