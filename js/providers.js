/* =========================================================
   AXION AI — Provider adapters (v2.5).
   Unified interface: AXION.providers.chat(opts)
   v2.5 FIXES:
   - SSE readers now FLUSH the leftover buffer when the stream
     ends (the final data: event without trailing newline was
     being dropped → truncated output).
   - max_output_tokens raised & configurable (was 8192, too low
     for long answers → "cut off mid-sentence").
   - On AbortError (user pressed Stop) we RETURN the partial
     text accumulated so far instead of throwing, so the user
     keeps what was already generated.
   - Streaming SSE with robust parsing + non-streaming fallback.
   - TTS / audio / image outputs handled correctly.
   All calls go directly from the browser to the provider.
   ========================================================= */
window.AXION = window.AXION || {};
AXION.providers = (() => {
  const apiKeyOf = (providerId) => {
    const p = AXION.getProvider(providerId);
    return localStorage.getItem(p.keyStorage) || '';
  };
  const baseUrlOf = (providerId) => {
    const p = AXION.getProvider(providerId);
    if (p.baseUrlStorage) return localStorage.getItem(p.baseUrlStorage) || p.baseUrl;
    return localStorage.getItem('axion_baseurl_' + providerId) || p.baseUrl;
  };
  const maxTokens = () => {
    const v = parseInt((AXION.settings && AXION.settings.maxOutputTokens) || 0, 10);
    return v > 0 ? v : 16384;
  };
  /* Normalize history to [{role, text, images:[{data,mime}]}] */
  const normalize = (history) => {
    return history.map(h => {
      if (typeof h === 'string') return { role: 'user', text: h, images: [] };
      if (h.parts) {
        let text = '', images = [];
        for (const part of h.parts) {
          if (part.text) text += part.text;
          else if (part.inlineData) images.push({ data: part.inlineData.data, mime: part.inlineData.mimeType });
        }
        return { role: h.role === 'model' ? 'assistant' : h.role, text, images };
      }
      return { role: h.role === 'model' ? 'assistant' : (h.role || 'user'), text: h.content || h.text || '', images: h.images || [] };
    });
  };
  /* Read an OpenAI-style SSE stream. v2.5: flush leftover buf. */
  const readSSE = async (res, onEvent) => {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const processLine = (line) => {
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      try { onEvent(JSON.parse(payload)); } catch { /* partial */ }
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) processLine(line);
    }
    // v2.5: flush the final buffered chunk (no trailing newline)
    if (buf) processLine(buf);
  };
  /* ---------- OpenAI-compatible (OpenAI, Groq, xAI, custom/Agnes) ---------- */
  const chatOpenAI = async (opts) => {
    const { apiKey, baseUrl, model, modelInfo, messages, system, thinking, signal, onChunk } = opts;
    const msgs = normalize(messages);
    // Image-gen models (DALL·E, grok-image) use a different endpoint
    if (modelInfo && modelInfo.imageGen) {
      const prompt = msgs.map(m => m.text).join('\n');
      const res = await fetch(baseUrl + '/images/generations', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 300));
      const data = await res.json();
      const img = data.data && data.data[0];
      const b64 = img && (img.b64_json || (img.url ? null : null));
      if (b64) return { text: 'Image generated.', images: [{ data: b64, mimeType: 'image/png' }] };
      if (img && img.url) return { text: 'Image generated: ' + img.url, images: [] };
      return { text: JSON.stringify(data).slice(0, 500) };
    }
    // TTS models (gpt-4o-audio-preview output audio, or explicit tts flag)
    if (modelInfo && modelInfo.tts && !modelInfo.audioInput) {
      const input = msgs.map(m => m.text).join('\n');
      try {
        const res = await fetch(baseUrl + '/audio/speech', {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({ model: model.replace(/-audio-preview$/, '') || 'gpt-4o-mini-tts', input, voice: 'alloy', response_format: 'mp3' }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const buf = await blob.arrayBuffer();
          let binary = ''; const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return { text: AXION.t('ttsNote'), audio: { data: btoa(binary), mimeType: 'audio/mpeg' } };
        }
      } catch (e) { /* fall through to chat completion */ }
    }
    const body = {
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...msgs.map(m => {
          if (m.images && m.images.length) {
            return { role: m.role, content: [{ type: 'text', text: m.text }, ...m.images.map(im => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.data}` } }))] };
          }
          return { role: m.role, content: m.text };
        }),
      ],
      max_tokens: maxTokens(),
      stream: true,
    };
    // Reasoning models (o-series): OpenAI uses reasoning_effort. Many OpenAI-compatible
    // endpoints (xAI/Groq/custom) reject this field → guard to provider 'openai' only.
    if (opts.providerId === 'openai' && modelInfo && modelInfo.thinking && thinking && thinking !== 'off') {
      body.reasoning_effort = thinking === 'high' ? 'high' : thinking === 'low' ? 'low' : 'medium';
    }
    // OpenAI o-series (o3/o4-mini/…) REQUIRE max_completion_tokens, NOT max_tokens (else HTTP 400).
    if (opts.providerId === 'openai' && /^o[0-9]/.test(model)) {
      delete body.max_tokens;
      body.max_completion_tokens = maxTokens();
    }
    let fullText = '', fullThinking = '';
    try {
      const res = await fetch(baseUrl + '/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
      await readSSE(res, (json) => {
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
        if (!delta) return;
        if (delta.reasoning_content) { fullThinking += delta.reasoning_content; }
        if (delta.content) { fullText += delta.content; }
        if (delta.audio && delta.audio.data) { /* streaming audio ignored; handled non-streaming */ }
        onChunk && onChunk(fullText, fullThinking);
      });
      return { text: fullText, thinking: fullThinking };
    } catch (e) {
      // v2.5: user pressed Stop → return whatever we already streamed
      if (e.name === 'AbortError') return { text: fullText, thinking: fullThinking, aborted: true };
      // Fallback: non-streaming (helps models/proxies that reject SSE — the TTS/websocket fix)
      try {
        const body2 = JSON.parse(JSON.stringify(body)); delete body2.stream;
        const res = await fetch(baseUrl + '/chat/completions', {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify(body2),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
        const data = await res.json();
        const msg = data.choices && data.choices[0] && data.choices[0].message;
        let text = msg ? (msg.content || '') : '';
        let think = msg && msg.reasoning_content ? msg.reasoning_content : '';
        onChunk && onChunk(text, think);
        return { text, thinking: think, raw: data };
      } catch (e2) {
        if (e2.name === 'AbortError') return { text: fullText, thinking: fullThinking, aborted: true };
        throw e2;
      }
    }
  };
  /* ---------- Anthropic ---------- */
  const chatAnthropic = async (opts) => {
    const { apiKey, baseUrl, model, modelInfo, messages, system, thinking, signal, onChunk } = opts;
    const msgs = normalize(messages);
    const body = {
      model, max_tokens: Math.max(maxTokens(), 8192), stream: true,
      messages: msgs.map(m => ({
        role: m.role,
        content: m.images && m.images.length
          ? [{ type: 'text', text: m.text }, ...m.images.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } }))]
          : m.text,
      })),
    };
    if (system) body.system = system;
    let thinkBudget = 4000;
    if (modelInfo && modelInfo.thinking && thinking && thinking !== 'off') {
      thinkBudget = thinking === 'high' ? 8000 : thinking === 'low' ? 1024 : 4000;
      body.thinking = { type: 'enabled', budget_tokens: Math.max(1024, Math.min(thinkBudget, 32000)) };
      body.max_tokens = Math.max(maxTokens(), thinkBudget * 2);
    }
    let fullText = '', fullThinking = '';
    const processEventBlock = (ev) => {
      const dataLine = ev.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) return;
      try {
        const json = JSON.parse(dataLine.slice(5).trim());
        if (json.type === 'content_block_delta') {
          if (json.delta.type === 'text_delta') { fullText += json.delta.text; }
          else if (json.delta.type === 'thinking_delta') { fullThinking += json.delta.thinking; }
          onChunk && onChunk(fullText, fullThinking);
        }
      } catch { /* partial */ }
    };
    try {
      const res = await fetch(baseUrl + '/messages', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split(/\r?\n\r?\n/);
        buf = events.pop();
        for (const ev of events) processEventBlock(ev);
      }
      if (buf.trim()) processEventBlock(buf); // v2.5: flush leftover
      return { text: fullText, thinking: fullThinking };
    } catch (e) {
      if (e.name === 'AbortError') return { text: fullText, thinking: fullThinking, aborted: true };
      // non-streaming fallback
      try {
        const body2 = JSON.parse(JSON.stringify(body)); delete body2.stream; delete body2.thinking;
        const res = await fetch(baseUrl + '/messages', {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify(body2),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
        const data = await res.json();
        const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
        const think = (data.content || []).filter(c => c.type === 'thinking').map(c => c.thinking).join('');
        onChunk && onChunk(text, think);
        return { text, thinking: think };
      } catch (e2) {
        if (e2.name === 'AbortError') return { text: fullText, thinking: fullThinking, aborted: true };
        throw e2;
      }
    }
  };
  /* ---------- Google Gemini / Gemma ---------- */
  const chatGoogle = async (opts) => {
    const { apiKey, baseUrl, model, modelInfo, messages, system, thinking, signal, onChunk } = opts;
    const msgs = normalize(messages);
    const isGemma = /^gemma/i.test(model);
    const isTTS = modelInfo && (modelInfo.tts || (modelInfo.audio && !modelInfo.image));
    const isImageGen = modelInfo && modelInfo.imageGen;
    // Build Gemini contents
    const contents = msgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        { text: m.text },
        ...(m.images || []).map(im => ({ inlineData: { mimeType: im.mime, data: im.data } })),
      ],
    }));
    const genConfig = { maxOutputTokens: maxTokens(), temperature: 0.7 };
    // Gemini thinking: off/low/medium/high → thinkingBudget (tokens).
    if (!isGemma && thinking && thinking !== 'off') {
      const budget = { low: 1024, medium: 8192, high: 32768 }[thinking] || 8192;
      genConfig.thinkingConfig = { thinkingBudget: budget, includeThoughts: true };
    }
    if (isImageGen) genConfig.responseModalities = ['TEXT', 'IMAGE'];
    const body = { contents, generationConfig: genConfig };
    let effectiveSystem = system;
    if (isGemma) {
      body.contents = [{ role: 'user', parts: [{ text: system + '\n\n---\n' }] }, ...contents];
    } else if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }
    const useStream = !isTTS;
    const endpoint = useStream
      ? `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
      : `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
    let fullText = '', fullThinking = '', images = [], audio = null;
    const handleCandidate = (cand) => {
      const parts = (cand && cand.content && cand.content.parts) || [];
      for (const part of parts) {
        // Gemini v1beta thinking parts: {"thought": "..."} (string), or {"text":"...","thought":true}, or {"thinking":"..."}
        if (typeof part.thought === 'string') fullThinking += part.thought;
        else if (part.thought === true && part.text) fullThinking += part.text;
        else if (typeof part.thinking === 'string') fullThinking += part.thinking;
        else if (part.text) fullText += part.text;
        else if (part.inlineData) {
          const mime = part.inlineData.mimeType || '';
          if (mime.startsWith('audio/')) audio = { data: part.inlineData.data, mimeType: mime };
          else if (mime.startsWith('image/')) images.push({ data: part.inlineData.data, mimeType: mime });
        }
      }
    };
    try {
      if (useStream) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        const processLine = (line) => {
          if (!line.startsWith('data:')) return;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') return;
          try {
            const json = JSON.parse(payload);
            handleCandidate(json.candidates && json.candidates[0]);
            onChunk && onChunk(fullText, fullThinking, images);
          } catch { /* partial */ }
        };
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split(/\r?\n/);
          buf = lines.pop();
          for (const line of lines) processLine(line);
        }
        if (buf) processLine(buf); // v2.5: flush leftover
      } else {
        const data = await res.json();
        const cand = data.candidates && data.candidates[0];
        handleCandidate(cand);
        onChunk && onChunk(fullText, fullThinking, images);
      }
      return { text: fullText, thinking: fullThinking, images, audio };
    } catch (e) {
      if (e.name === 'AbortError') return { text: fullText, thinking: fullThinking, images, audio, aborted: true };
      throw e;
    }
  };
  /* ---------- Unified entry ---------- */
  const chat = async (opts) => {
    const providerId = opts.providerId || AXION.settings.provider;
    const p = AXION.getProvider(providerId);
    const apiKey = opts.apiKey || apiKeyOf(providerId);
    const baseUrl = opts.baseUrl || baseUrlOf(providerId);
    if (!apiKey) throw new Error(AXION.t('errorNoKey'));
    const common = { ...opts, apiKey, baseUrl };
    if (p.kind === 'openai') return chatOpenAI(common);
    if (p.kind === 'anthropic') return chatAnthropic(common);
    if (p.kind === 'google') return chatGoogle(common);
    return chatOpenAI(common);
  };
  /* Fetch live model list from provider — OpenAI-compatible & Google */
  const fetchModels = async (providerId) => {
    const p = AXION.getProvider(providerId);
    const apiKey = apiKeyOf(providerId);
    if (!apiKey) return null;
    try {
      if (p.kind === 'openai') {
        const res = await fetch(baseUrlOf(providerId) + '/models', { headers: { 'Authorization': 'Bearer ' + apiKey } });
        if (!res.ok) return null;
        const data = await res.json();
        const ids = (data.data || []).map(m => m.id).sort();
        return ids.map(id => ({ id, label: id, thinking: /o[1-9]|reason|deepseek-r|grok-3/i.test(id), image: /vision|gpt-4o|claude|gemini/i.test(id), audio: false, ctx: '-' }));
      }
      if (p.kind === 'google') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return (data.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => ({ id: m.name.replace('models/', ''), label: m.name.replace('models/', ''), thinking: /thinking|2\.5|gemini-2/i.test(m.name), image: /vision|image|gemini-2|gemini-1\.5/i.test(m.name), audio: false, ctx: (m.inputTokenLimit ? Math.round(m.inputTokenLimit / 1000) + 'k' : '-') }));
      }
    } catch { /* network/CORS — fall back to curated list */ }
    return null;
  };
  return { chat, fetchModels, normalize, maxTokens };
})();
