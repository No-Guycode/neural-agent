/**
 * Neural Agent - Renderer Process
 * Handles all UI logic, agent orchestration, A1111 & OpenAI integration.
 */

// ── State ────────────────────────────────────────────────────────────────────
const State = {
  settings: null,
  memory: [],           // [{role, content}] for OpenAI
  isProcessing: false,
  a1111Online: false,
  selectedModel: null,  // { filename, baseName, notes }
  loraTag: '',
  loraWords: '',
  modalResolve: null,
  progressInterval: null,
  currentView: 'chat',
};

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    State.settings = await window.api.settings.get();
    populateSettings();
    updateModelHint();
    await pingA1111();
    renderMemory();
    autoResizeTextarea();
    log('Neural Agent initialized.', 'info');
  } catch (e) {
    log('Init error: ' + e.message, 'error');
  }
});

// ── UI Helpers ────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function log(msg, level = 'info') {
  console.log(`[NeuralAgent:${level}] ${msg}`);
}

function setProcessing(val) {
  State.isProcessing = val;
  const btn = document.getElementById('send-btn');
  const inp = document.getElementById('user-input');
  btn.disabled = val;
  inp.disabled = val;
  btn.classList.toggle('loading', val);

  // Update title-bar status dot
  const dot = document.getElementById('a1111-dot');
  if (val) {
    dot.className = 'status-dot thinking';
  } else {
    dot.className = `status-dot ${State.a1111Online ? 'online' : 'offline'}`;
  }
}

function setA1111Status(online) {
  State.a1111Online = online;
  const dot = document.getElementById('a1111-dot');
  dot.className = `status-dot ${online ? 'online' : 'offline'}`;
}

function showView(view) {
  State.currentView = view;
  document.getElementById('nav-chat').classList.toggle('active', view === 'chat');
  document.getElementById('nav-gallery').classList.toggle('active', view === 'gallery');
  document.getElementById('messages').innerHTML = '';

  if (view === 'chat') {
    renderWelcomeOrHistory();
  } else {
    loadGallery();
  }
}

function switchTab(tab) {
  document.getElementById('tab-settings').classList.toggle('active', tab === 'settings');
  document.getElementById('tab-params').classList.toggle('active', tab === 'params');
  document.getElementById('panel-settings').classList.toggle('hidden', tab !== 'settings');
  document.getElementById('panel-params').classList.toggle('hidden', tab !== 'params');
}

function autoResizeTextarea() {
  const ta = document.getElementById('user-input');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  });
  ta.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  });
}

function scrollMessages() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

// ── Message Rendering ────────────────────────────────────────────────────────
function clearWelcome() {
  const w = document.getElementById('welcome');
  if (w) w.remove();
}

function renderWelcomeOrHistory() {
  const msgs = document.getElementById('messages');
  msgs.innerHTML = '';
  if (State.memory.length === 0) {
    msgs.innerHTML = `
      <div id="welcome">
        <div class="welcome-glyph">🧠</div>
        <div class="welcome-title">AXIOM</div>
        <div class="welcome-sub">Sharp. Direct. Occasionally sarcastic.<br/>Text or image — I'll figure it out. Set your Groq key and let's go.</div>
      </div>`;
  } else {
    State.memory.forEach(m => {
      if (m.role !== 'system') appendBubble(m.role, m._display || m.content, m._isImage);
    });
  }
  scrollMessages();
}

function appendBubble(role, content, isImage = false) {
  clearWelcome();
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatar = role === 'user' ? '👤' : '🤖';
  let bodyHtml;
  if (isImage) {
    bodyHtml = `<div class="msg-bubble" style="padding:8px">
      <img class="msg-image" src="${content}" onclick="openImageViewer('${content}')" alt="Generated image"/>
    </div>`;
  } else {
    bodyHtml = `<div class="msg-bubble">${sanitizeHtml(content)}</div>`;
  }

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">${bodyHtml}</div>`;
  msgs.appendChild(div);
  scrollMessages();
  return div;
}

function appendThoughtBubble(steps) {
  clearWelcome();
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="thought-bubble">
        <div class="thought-label">
          <span class="status-dot thinking"></span>THINKING
        </div>
        <div id="thought-steps"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollMessages();
  return div.querySelector('#thought-steps');
}

function addThoughtStep(container, num, text, state = 'spin') {
  const el = document.createElement('div');
  el.className = 'step-item';
  el.innerHTML = `<div class="step-num ${state}">${state === 'spin' ? '⟳' : state === 'done' ? '✓' : '✗'}</div>
    <div class="step-text">${text}</div>`;
  container.appendChild(el);
  scrollMessages();
  return el;
}

function updateStep(el, text, state = 'done') {
  const num = el.querySelector('.step-num');
  num.className = `step-num ${state}`;
  num.textContent = state === 'done' ? '✓' : state === 'error' ? '✗' : '⟳';
  el.querySelector('.step-text').textContent = text;
}

function appendTyping() {
  clearWelcome();
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.id = 'typing-indicator-msg';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="msg-bubble" style="padding:10px 14px">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollMessages();
  return div;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator-msg');
  if (el) el.remove();
}

function appendProgressBar() {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.id = 'progress-msg';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body" style="width:72%">
      <div class="msg-bubble" style="width:100%">
        <div style="font-size:12px;color:var(--text-sub);margin-bottom:8px;" id="progress-label">Generating image… 0%</div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" id="progress-fill" style="width:0%"></div></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollMessages();
}

function updateProgress(pct, label) {
  const fill = document.getElementById('progress-fill');
  const lbl = document.getElementById('progress-label');
  if (fill) fill.style.width = Math.round(pct * 100) + '%';
  if (lbl) lbl.textContent = label || `Generating image… ${Math.round(pct * 100)}%`;
  scrollMessages();
}

function removeProgress() {
  const el = document.getElementById('progress-msg');
  if (el) el.remove();
  if (State.progressInterval) { clearInterval(State.progressInterval); State.progressInterval = null; }
}

// ── Memory ────────────────────────────────────────────────────────────────────
function renderMemory() {
  const list = document.getElementById('memory-list');
  const userItems = State.memory.filter(m => m.role !== 'system');
  if (userItems.length === 0) {
    list.innerHTML = `<div style="font-size:11px;color:var(--text-dim);text-align:center;margin-top:12px;">No history yet</div>`;
    return;
  }
  list.innerHTML = userItems.map(m => {
    const preview = (m._display || m.content || '').toString().slice(0, 48).replace(/\n/g, ' ');
    return `<div class="memory-item ${m.role}" title="${preview}">${m.role === 'user' ? '→' : '←'} ${preview}</div>`;
  }).join('');
}

function clearMemory() {
  State.memory = [];
  renderMemory();
  renderWelcomeOrHistory();
  toast('Memory cleared', 'info');
}

// ── Settings ──────────────────────────────────────────────────────────────────
function populateSettings() {
  const s = State.settings;
  if (!s) return;
  document.getElementById('s-api-key').value          = s.openaiApiKey || '';
  document.getElementById('s-model').value            = s.openaiModel || 'gpt-4o';
  document.getElementById('s-system-prompt').value    = s.systemPrompt || '';
  document.getElementById('s-a1111-url').value        = s.a1111Url || 'http://127.0.0.1:7860';
  document.getElementById('s-models-dir').value       = s.modelsDir || '';
  document.getElementById('s-output-dir').value       = s.outputDir || '';
  document.getElementById('s-encryption').checked     = !!s.encryptionEnabled;
  document.getElementById('s-enc-key-file').value     = s.encryptionKeyFile || '';

  const p = s.imageParams || {};
  document.getElementById('p-width').value            = p.width || 512;
  document.getElementById('p-height').value           = p.height || 512;
  document.getElementById('p-steps').value            = p.steps || 30;
  document.getElementById('p-cfg').value              = p.cfg_scale || 7;
  document.getElementById('p-sampler').value          = p.sampler_name || 'DPM++ 2M Karras';
  document.getElementById('p-hires').checked          = p.enable_hr !== false;
  document.getElementById('p-upscaler').value         = p.hr_upscaler || 'Lanczos';
  document.getElementById('p-hires-steps').value      = p.hr_second_pass_steps || 15;
  document.getElementById('p-denoise').value          = p.denoising_strength || 0.45;
  document.getElementById('p-hr-scale').value         = p.hr_scale || 2;
}

async function saveSettings() {
  const newSettings = {
    openaiApiKey:      document.getElementById('s-api-key').value.trim(),
    openaiModel:       document.getElementById('s-model').value,
    systemPrompt:      document.getElementById('s-system-prompt').value,
    a1111Url:          document.getElementById('s-a1111-url').value.trim().replace(/\/$/, ''),
    modelsDir:         document.getElementById('s-models-dir').value.trim(),
    outputDir:         document.getElementById('s-output-dir').value.trim(),
    encryptionEnabled: document.getElementById('s-encryption').checked,
    encryptionKeyFile: document.getElementById('s-enc-key-file').value.trim(),
    imageParams: {
      width:                   +document.getElementById('p-width').value,
      height:                  +document.getElementById('p-height').value,
      steps:                   +document.getElementById('p-steps').value,
      cfg_scale:               +document.getElementById('p-cfg').value,
      sampler_name:             document.getElementById('p-sampler').value,
      enable_hr:                document.getElementById('p-hires').checked,
      hr_upscaler:              document.getElementById('p-upscaler').value,
      hr_second_pass_steps:    +document.getElementById('p-hires-steps').value,
      denoising_strength:      +document.getElementById('p-denoise').value,
      hr_scale:                +document.getElementById('p-hr-scale').value,
    }
  };
  await window.api.settings.save(newSettings);
  State.settings = newSettings;
  updateModelHint();
  toast('Settings saved ✓', 'success');
}

function updateModelHint() {
  const el = document.getElementById('model-hint');
  if (State.settings) el.textContent = State.settings.openaiModel || '';
}

function toggleEncryption() {
  const on = document.getElementById('s-encryption').checked;
  document.getElementById('enc-key-row').style.opacity = on ? '1' : '0.4';
}

async function generateEncKey() {
  const res = await window.api.encryption.generateKey();
  if (res.key) {
    toast('New encryption key generated', 'success');
    document.getElementById('s-enc-key-file').value = State.settings?.encryptionKeyFile || '';
  } else {
    toast('Failed to generate key: ' + res.error, 'error');
  }
}

// ── A1111 Ping ────────────────────────────────────────────────────────────────
async function pingA1111() {
  const result = await window.api.a1111.ping();
  setA1111Status(result.online);
  const el = document.getElementById('a1111-ping-result');
  if (el) {
    el.textContent = result.online ? '✓ Online' : '✗ Offline';
    el.style.color = result.online ? 'var(--success)' : 'var(--danger)';
  }
  return result.online;
}

// ── Model Selection (AI-driven) ───────────────────────────────────────────────
async function selectBestModel(imagePrompt, thoughtContainer) {
  const step = addThoughtStep(thoughtContainer, 1, 'Scanning available models…');

  const { models, error } = await window.api.models.scan();
  if (error || !models || models.length === 0) {
    updateStep(step, `No models found in ${State.settings.modelsDir || 'models dir'}`, 'error');
    return null;
  }
  updateStep(step, `Found ${models.length} model(s) with notes`);

  const step2 = addThoughtStep(thoughtContainer, 2, 'Asking AI to pick the best model…');

  // Ask the LLM to pick
  const modelContext = models.map(m => `Model: ${m.baseName}\nNotes:\n${m.notes}`).join('\n\n---\n\n');
  const pickMessages = [
    { role: 'system', content: 'You select the best image generation model. Respond ONLY with valid JSON: {"choice":"<baseName>","reason":"<why>"}' },
    { role: 'user', content: `Image prompt:\n${imagePrompt}\n\nAvailable models:\n${modelContext}\n\nPick the best model for this prompt.` }
  ];

  const res = await window.api.openai.chat(pickMessages);
  if (res.error) {
    updateStep(step2, 'AI model selection failed: ' + res.error, 'error');
    // Fallback: use first model
    updateStep(step2, `Falling back to first model: ${models[0].baseName}`, 'done');
    return models[0];
  }

  try {
    const parsed = JSON.parse(res.content);
    const chosen = models.find(m => m.baseName === parsed.choice) || models[0];
    updateStep(step2, `Selected: ${chosen.baseName} — ${parsed.reason || 'best match'}`, 'done');
    return chosen;
  } catch {
    updateStep(step2, `Parsed choice failed. Using first model: ${models[0].baseName}`, 'done');
    return models[0];
  }
}

// ── LoRA Modal ────────────────────────────────────────────────────────────────
function showLoraModal(modelName) {
  document.getElementById('lora-modal-sub').textContent =
    `Model "${modelName}" is loaded. Want to apply a LoRA?`;
  document.getElementById('lora-tag-input').value = '';
  document.getElementById('lora-trigger-input').value = '';
  document.getElementById('modal-overlay').classList.add('show');
  return new Promise(resolve => { State.modalResolve = resolve; });
}

function closeModal(apply) {
  const tag     = document.getElementById('lora-tag-input').value.trim();
  const trigger = document.getElementById('lora-trigger-input').value.trim();
  document.getElementById('modal-overlay').classList.remove('show');
  if (State.modalResolve) {
    State.modalResolve(apply ? { tag, trigger } : null);
    State.modalResolve = null;
  }
}

// ── Image Generation Pipeline ─────────────────────────────────────────────────
async function generateImage(rawPrompt) {
  const thoughtDiv = appendThoughtBubble([]);
  const thoughtContainer = thoughtDiv;

  // Step 1: Select model
  const model = await selectBestModel(rawPrompt, thoughtContainer);
  if (!model) {
    removeTyping();
    appendBubble('assistant', '⚠️ No suitable model found. Check your models directory in settings.');
    return;
  }
  State.selectedModel = model;

  // Step 2: Load model in A1111
  const loadStep = addThoughtStep(thoughtContainer, 3, `Loading ${model.baseName} in A1111…`);
  const a1111Models = await window.api.a1111.getModels();
  const a1111Match = (a1111Models.models || []).find(m =>
    m.model_name?.toLowerCase().includes(model.baseName.toLowerCase()) ||
    m.title?.toLowerCase().includes(model.baseName.toLowerCase())
  );

  if (!a1111Match) {
    updateStep(loadStep, `Model "${model.baseName}" not found in A1111. Is it in the right directory?`, 'error');
    appendBubble('assistant', `⚠️ Model "${model.baseName}" not found in A1111's model list. Please check your A1111 models path.`);
    return;
  }

  const setResult = await window.api.a1111.setModel(a1111Match.title || a1111Match.model_name);
  if (!setResult.ok) {
    updateStep(loadStep, `Failed to load model: ${setResult.error || 'unknown error'}`, 'error');
  } else {
    updateStep(loadStep, `Model loaded: ${model.baseName}`);
    document.getElementById('model-status-label').textContent = model.baseName;
  }

  // Step 3: Ask LoRA
  const loraStep = addThoughtStep(thoughtContainer, 4, 'Asking about LoRA…', 'spin');
  const loraChoice = await showLoraModal(model.baseName);
  let finalPrompt = rawPrompt;
  if (loraChoice && loraChoice.tag) {
    finalPrompt = `${rawPrompt}, ${loraChoice.trigger || ''}${loraChoice.tag}`.trim().replace(/,\s*,/g, ',');
    State.loraTag = loraChoice.tag;
    State.loraWords = loraChoice.trigger;
    updateStep(loraStep, `LoRA applied: ${loraChoice.tag}`);
  } else {
    updateStep(loraStep, 'No LoRA applied');
  }

  // Step 4: Finalize prompt
  const promptStep = addThoughtStep(thoughtContainer, 5, 'Finalizing prompt & parameters…');
  // AI refines the prompt based on model notes
  const refineMessages = [
    { role: 'system', content: `You are an expert Stable Diffusion prompt engineer. Your job is to convert the user's request into a clean, ordered list of booru-style tags for image generation.

BOORU TAG RULES — follow these exactly:
- Use comma-separated short tags, NO full sentences, NO prose
- Order tags like this: subject count (1girl, 2girls), subject description (hair color, eye color, expression, clothing), action/pose, accessories, setting/background, lighting, quality tags
- Use standard danbooru tags where possible: "1girl", "pink hair", "hair over one eye", "laughing", "pleated skirt", "ruffle blouse", "dancing", "one foot raised", "wildflower field", "cloudy sky", etc.
- NO underscores — use spaces: "hair over one eye" not "hair_over_one_eye"
- Quality tags go at the END: masterpiece, best quality, very aesthetic, ultra-detailed
- Negative prompt should also be comma-separated booru-style tags
- Pull trigger words and negative prompt from the model notes
- Respond ONLY with raw JSON, no markdown: {"prompt":"<booru tags>","negative_prompt":"<booru tags>"}` },
    { role: 'user', content: `Model: ${model.baseName}\nModel notes:\n${model.notes}\n\nUser request: ${finalPrompt}\n\nConvert into booru-style SD tags. Follow tag ordering rules strictly.` }
  ];

  const refineRes = await window.api.openai.chat(refineMessages);
  let positivePrompt = finalPrompt;
  let negativePrompt = 'low quality, blurry, distorted, ugly, bad anatomy';

  try {
    const refined = JSON.parse(refineRes.content || '{}');
    positivePrompt = refined.prompt || finalPrompt;
    negativePrompt = refined.negative_prompt || negativePrompt;
    updateStep(promptStep, 'Prompt refined for model');
  } catch {
    updateStep(promptStep, 'Using raw prompt (refinement parse failed)');
  }

  // Step 5: Generate
  const genStep = addThoughtStep(thoughtContainer, 6, 'Sending to A1111 for generation…');

  const params = State.settings.imageParams || {};
  const payload = {
    prompt: positivePrompt,
    negative_prompt: negativePrompt,
    ...params,
  };

  appendProgressBar();
  // Poll progress
  State.progressInterval = setInterval(async () => {
    const prog = await window.api.a1111.progress();
    if (prog.progress !== undefined) {
      updateProgress(prog.progress, `Generating… ${Math.round(prog.progress * 100)}% — ETA: ${prog.eta ? prog.eta.toFixed(1) + 's' : '?'}`);
    }
  }, 1000);

  const genResult = await window.api.a1111.generate(payload);
  removeProgress();

  if (genResult.error) {
    updateStep(genStep, 'Generation failed: ' + genResult.error, 'error');
    appendBubble('assistant', `⚠️ Image generation failed: ${genResult.error}`);
    return;
  }

  updateStep(genStep, 'Image generated successfully!');

  // Step 6: Display
  const imgData = genResult.images?.[0];
  if (!imgData) {
    appendBubble('assistant', '⚠️ No image data returned from A1111.');
    return;
  }

  const dataUrl = `data:image/png;base64,${imgData}`;

  // Save to output dir
  const filename = `neural_${Date.now()}.png`;
  await window.api.image.save(imgData, filename);

  // Add to memory
  State.memory.push({
    role: 'assistant',
    content: `[Generated image: ${filename}]`,
    _display: dataUrl,
    _isImage: true,
  });
  renderMemory();

  appendBubble('assistant', dataUrl, true);
  toast('Image generated and saved!', 'success');
}

// ── Main Agent ────────────────────────────────────────────────────────────────
async function sendMessage() {
  if (State.isProcessing) return;
  const input = document.getElementById('user-input');
  const userText = input.value.trim();
  if (!userText) return;

  if (!State.settings?.openaiApiKey) {
    toast('No Groq API key! Go to Settings and paste your key from console.groq.com', 'error', 6000);
    return;
  }

  input.value = '';
  input.style.height = 'auto';
  setProcessing(true);
  clearWelcome();

  // Display user message
  appendBubble('user', userText);
  State.memory.push({ role: 'user', content: userText, _display: userText });
  renderMemory();

  try {
    // Build messages for OpenAI
    const messages = [
      { role: 'system', content: State.settings.systemPrompt },
      ...State.memory
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m._isImage ? '[Image was generated]' : (m._display || m.content) }))
    ];

    // Show typing
    const typing = appendTyping();

    // Call OpenAI to decide
    log('Calling OpenAI to decide response type…');
    const res = await window.api.openai.chat(messages);
    removeTyping();

    if (res.error) {
      appendBubble('assistant', `⚠️ OpenAI error: ${res.error}`);
      toast(res.error, 'error', 6000);
      setProcessing(false);
      return;
    }

    // Update token counter
    if (res.usage) {
      const tc = document.getElementById('token-counter');
      tc.classList.remove('hidden');
      tc.textContent = `${res.usage.total_tokens} tokens`;
    }

    // Parse LLM decision
    let decision;
    try {
      decision = JSON.parse(res.content);
    } catch {
      decision = { type: 'text', response: res.content };
    }

    log(`Decision: type=${decision.type}`);

    if (decision.type === 'image') {
      const imgPrompt = decision.imagePrompt || userText;

      // Check A1111 is online
      const online = await pingA1111();
      if (!online) {
        appendBubble('assistant', '⚠️ A1111 is offline. Please start the WebUI first, then try again.');
        setProcessing(false);
        return;
      }

      State.memory.push({
        role: 'assistant',
        content: `[Routing to image generation: "${imgPrompt}"]`,
        _display: `🎨 Generating image: "${imgPrompt}"…`,
      });
      appendBubble('assistant', `🎨 Generating image: "${imgPrompt}"…`);
      renderMemory();

      await generateImage(imgPrompt);

    } else {
      // Text response
      const responseText = decision.response || res.content;
      State.memory.push({ role: 'assistant', content: responseText, _display: responseText });
      renderMemory();
      appendBubble('assistant', responseText);
    }

  } catch (e) {
    removeTyping();
    log('Error in sendMessage: ' + e.message, 'error');
    appendBubble('assistant', `⚠️ Unexpected error: ${e.message}`);
    toast(e.message, 'error', 6000);
  } finally {
    setProcessing(false);
  }
}

// ── Gallery View ──────────────────────────────────────────────────────────────
async function loadGallery() {
  const msgs = document.getElementById('messages');
  msgs.innerHTML = `
    <div style="padding:20px 0">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:var(--text-dim);text-transform:uppercase;margin-bottom:16px;">
        Encrypted Gallery
      </div>
      <div id="gallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;"></div>
      <div id="gallery-loading" style="color:var(--text-sub);font-size:12px;margin-top:10px;">Loading…</div>
    </div>`;

  const { files } = await window.api.gallery.list();
  const grid = document.getElementById('gallery-grid');
  const loadingEl = document.getElementById('gallery-loading');

  if (!files || files.length === 0) {
    loadingEl.textContent = 'No encrypted images found in output directory.';
    return;
  }

  loadingEl.textContent = `${files.length} image(s) found. Loading previews…`;

  // For now, show filenames as cards (full decrypt needs the key — showed separately)
  files.forEach(f => {
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--bg-card);border:1px solid var(--border);border-radius:10px;
      padding:12px;cursor:pointer;transition:border-color 0.15s;
      display:flex;flex-direction:column;align-items:center;gap:8px;
    `;
    card.innerHTML = `
      <div style="font-size:28px;">🔒</div>
      <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-sub);text-align:center;word-break:break-all;">${f.name}</div>
    `;
    card.onmouseover = () => card.style.borderColor = 'var(--accent)';
    card.onmouseleave = () => card.style.borderColor = 'var(--border)';
    card.onclick = async () => {
      toast('Decrypting image (requires A1111 extension key)…', 'info');
      // Read raw encrypted file — actual decryption requires the Fernet key
      // Since we're in Electron, we hand off to Python via A1111 for now
      // Display placeholder
      card.innerHTML = `<div style="font-size:28px;animation:pulse 1s infinite;">🔓</div><div style="font-size:10px;font-family:var(--font-mono);color:var(--text-sub)">Viewing in A1111…</div>`;
      toast('Open the Encrypted Gallery tab in A1111 WebUI to view this image.', 'info', 5000);
    };
    grid.appendChild(card);
  });

  loadingEl.textContent = '';
}

// ── Image Viewer ──────────────────────────────────────────────────────────────
function openImageViewer(src) {
  document.getElementById('viewer-img').src = src;
  document.getElementById('image-viewer').classList.add('show');
}

function closeImageViewer() {
  document.getElementById('image-viewer').classList.remove('show');
}

// ── Sanitize (simple) ─────────────────────────────────────────────────────────
function sanitizeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
