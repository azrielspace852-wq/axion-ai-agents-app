/* =========================================================
   AXION AI — Config: Providers & Model Catalog
   All client-side. API keys stored ONLY in localStorage of the user's device.
   ========================================================= */
window.AXION = window.AXION || {};

AXION.APP = {
  name: 'AXION AI',
  version: '2.8.3',
  docsUrl: 'https://axion-neuralis.axn.cc.cd',
  feedbackEmails: ['azrielspace852@gmail.com', 'axionneuralis@gmail.com'],
  knowledgeRepo: 'https://github.com/azrielspace852-wq/knowladge',
  defaultTheme: 'dark',
  defaultLang: 'en',
  maxAgentIterations: 8,
};

/* Each provider:
   - id, label, kind: 'openai' | 'anthropic' | 'google' | 'custom'
   - baseUrl: default endpoint (editable in settings)
   - keyStorage: localStorage key for API key
   - models: curated list; also supports dynamic /models fetch + custom input
   - flags: thinking, image, audio(tts), functionCalling
*/
AXION.PROVIDERS = [
  {
    id: 'google', label: 'Google Gemini', kind: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    keyStorage: 'axion_key_google',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', thinking: true, image: true, audio: false, ctx: '1M' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', thinking: true, image: true, audio: false, ctx: '1M' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', thinking: true, image: true, audio: false, ctx: '1M' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', thinking: false, image: true, audio: true, ctx: '1M' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', thinking: false, image: false, audio: false, ctx: '1M' },
      { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Imagen)', thinking: false, image: true, audio: false, ctx: '1M', imageGen: true },
      { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS (Preview)', thinking: false, image: false, audio: true, ctx: '32k', tts: true },
      { id: 'gemma-3-27b-it', label: 'Gemma 3 27B Instruct (open)', thinking: false, image: false, audio: false, ctx: '128k' },
      { id: 'gemma-3-12b-it', label: 'Gemma 3 12B Instruct (open)', thinking: false, image: false, audio: false, ctx: '32k' },
      { id: 'gemma-3-4b-it', label: 'Gemma 3 4B Instruct (open)', thinking: false, image: false, audio: false, ctx: '32k' },
      { id: 'gemma-2-27b-it', label: 'Gemma 2 27B Instruct (open)', thinking: false, image: false, audio: false, ctx: '8k' },
    ],
  },
  {
    id: 'openai', label: 'OpenAI', kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyStorage: 'axion_key_openai',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', thinking: false, image: true, audio: false, ctx: '128k' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', thinking: false, image: true, audio: false, ctx: '128k' },
      { id: 'gpt-4.1', label: 'GPT-4.1', thinking: false, image: true, audio: false, ctx: '1M' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', thinking: false, image: true, audio: false, ctx: '1M' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', thinking: false, image: true, audio: false, ctx: '1M' },
      { id: 'o3', label: 'o3 (reasoning)', thinking: true, image: true, audio: false, ctx: '200k' },
      { id: 'o3-mini', label: 'o3 Mini (reasoning)', thinking: true, image: true, audio: false, ctx: '200k' },
      { id: 'o4-mini', label: 'o4 Mini (reasoning)', thinking: true, image: true, audio: false, ctx: '200k' },
      { id: 'gpt-4o-audio-preview', label: 'GPT-4o Audio Preview (TTS/STT)', thinking: false, image: false, audio: true, tts: true, ctx: '128k' },
      { id: 'dall-e-3', label: 'DALL·E 3 (image gen)', thinking: false, image: false, audio: false, imageGen: true, ctx: '4k' },
    ],
  },
  {
    id: 'anthropic', label: 'Anthropic Claude', kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyStorage: 'axion_key_anthropic',
    models: [
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (extended thinking)', thinking: true, image: true, audio: false, ctx: '200k' },
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', thinking: false, image: true, audio: false, ctx: '200k' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', thinking: false, image: true, audio: false, ctx: '200k' },
      { id: 'claude-3-opus-latest', label: 'Claude 3 Opus', thinking: false, image: true, audio: false, ctx: '200k' },
    ],
  },
  {
    id: 'groq', label: 'Groq', kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyStorage: 'axion_key_groq',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', thinking: false, image: false, audio: false, ctx: '128k' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', thinking: false, image: false, audio: false, ctx: '128k' },
      { id: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B Vision', thinking: false, image: true, audio: false, ctx: '128k' },
      { id: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11B Vision', thinking: false, image: true, audio: false, ctx: '128k' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', thinking: false, image: false, audio: false, ctx: '32k' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B', thinking: false, image: false, audio: false, ctx: '8k' },
      { id: 'whisper-large-v3', label: 'Whisper Large v3 (STT)', thinking: false, image: false, audio: true, stt: true, ctx: '-' },
    ],
  },
  {
    id: 'xai', label: 'xAI Grok', kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyStorage: 'axion_key_xai',
    models: [
      { id: 'grok-3', label: 'Grok 3', thinking: true, image: false, audio: false, ctx: '128k' },
      { id: 'grok-3-fast', label: 'Grok 3 Fast', thinking: true, image: false, audio: false, ctx: '128k' },
      { id: 'grok-2', label: 'Grok 2', thinking: false, image: false, audio: false, ctx: '128k' },
      { id: 'grok-2-fast', label: 'Grok 2 Fast', thinking: false, image: false, audio: false, ctx: '128k' },
      { id: 'grok-2-vision', label: 'Grok 2 Vision', thinking: false, image: true, audio: false, ctx: '128k' },
      { id: 'grok-2-image', label: 'Grok 2 Image (gen)', thinking: false, image: false, audio: false, imageGen: true, ctx: '32k' },
    ],
  },
  {
    id: 'custom', label: 'Custom / Agnes / OpenAI-Compatible', kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyStorage: 'axion_key_custom',
    baseUrlStorage: 'axion_baseurl_custom',
    models: [
      { id: 'custom-model', label: 'Custom Model (ketik ID model di Settings)', thinking: false, image: false, audio: false, ctx: '-' },
    ],
    note: 'Gunakan untuk provider apa pun yang kompatibel dengan API OpenAI (termasuk Agnes, OpenRouter, Together, dll). Atur Base URL & Model ID di Settings.',
  },
];

AXION.refreshCustomProviders = () => {
  AXION.PROVIDERS = AXION.PROVIDERS.filter(p => !String(p.id).startsWith('custom_user_'));
  const entries = (AXION.settings && Array.isArray(AXION.settings.customProviders)) ? AXION.settings.customProviders : [];
  for (const entry of entries) {
    const id = String(entry.id || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    if (!id || !id.startsWith('custom_user_')) continue;
    AXION.PROVIDERS.push({ id, label: entry.name || id, kind: 'openai', baseUrl: entry.baseUrl || 'https://api.openai.com/v1', keyStorage: 'axion_key_' + id, baseUrlStorage: 'axion_baseurl_' + id, models: [{ id: entry.model || 'custom-model', label: entry.model || 'Custom Model', thinking: false, image: false, audio: false, ctx: '-' }], note: 'Custom OpenAI-compatible endpoint.' });
  }
};
AXION.getProvider = (id) => AXION.PROVIDERS.find(p => p.id === id) || AXION.PROVIDERS[0];

/* Git permission levels — v2.5: expanded repository access (code search,
   full tree, PRs, issues, releases, readme, commits, tags). */
AXION.GIT_PERMISSIONS = {
  low:    { label: 'Low — Read Only',           desc: 'AI hanya bisa membaca repository (list, file, tree, search kode, issues, PR, commits). Tidak ada perubahan.', risk: 'safe' },
  medium: { label: 'Medium — Ask First',         desc: 'AI bisa semua tindakan baca + tulis (file, branch, PR, issue, repo), tetapi meminta izin Anda sebelum setiap aksi tulis.', risk: 'medium' },
  high:   { label: 'High — Elevated Actions (approval required)', desc: 'AI may propose higher-impact repository operations, but every write still requires explicit Allow. No repository change is applied automatically. Higher risk: review each proposal carefully.', risk: 'high' },
};

/* Thinking levels mapped per provider */
AXION.THINKING_LEVELS = ['off', 'low', 'medium', 'high'];
