'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const State = {
  settings:        null,
  memory:          [],        // {role, content, _display?, _isImage?, _payload?, _filename?}
  isProcessing:    false,
  a1111Online:     false,
  progressInterval: null,
  currentView:     'chat',
  modalResolve:    null,
};

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    State.settings = await window.api.settings.get();
    populateSettings();
    await pingA1111();
    await refreshLoadedModel();
    renderChatOrWelcome();
    initTextarea();
  } catch (e) {
    console.error('[AXIOM] Boot error:', e);
    toast('Failed to initialize: ' + e.message, 'error', 6000);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function sanitize(str) {
  if (typeof str !== 'string') str = String(str ?? '');
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/\n/g, '<br>');
}

function safeParseJSON(str) {
  try   { return JSON.parse(str); }
  catch { return null; }
}

function toast(msg, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${{ error: '⚠', success: '✓', info: 'ℹ' }[type] ?? 'ℹ'}</span><span>${sanitize(msg)}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── UI State ──────────────────────────────────────────────────────────────────
function setProcessing(val) {
  State.isProcessing    = val;
  $('send-btn').disabled = val;
  $('user-input').disabled = val;
  $('send-btn').classList.toggle('loading', val);
  const dot = $('a1111-dot');
  if (val) {
    dot.className = 'status-dot thinking';
  } else {
    dot.className = `status-dot ${State.a1111Online ? 'online' : 'offline'}`;
  }
}

function setA1111Status(online) {
  State.a1111Online = online;
  $('a1111-dot').className = `status-dot ${online ? 'online' : 'offline'}`;
}

function updateLoadedModelPill(name) {
  const pill = $('loaded-model-pill');
  const label = $('loaded-model-name');
  if (!pill || !label) return;
  if (name) {
    label.textContent = name;
    pill.classList.remove('hidden');
  } else {
    pill.classList.add('hidden');
  }
}

async function refreshLoadedModel() {
  const res = await window.api.a1111.currentModel();
  if (res.model) {
    // Extract just the filename without path
    const name = res.model.split(/[\/]/).pop().replace(/\.[^.]+$/, '');
    updateLoadedModelPill(name);
  }
}

function updateTokenCounter(usage) {
  if (!usage) return;
  const el = $('token-counter');
  el.classList.remove('hidden');
  el.textContent = `${(usage.total_tokens ?? 0).toLocaleString()} tokens`;
}

// ── Views ─────────────────────────────────────────────────────────────────────
function showView(view) {
  State.currentView = view;
  $('nav-chat').classList.toggle('active', view === 'chat');
  $('nav-gallery').classList.toggle('active', view === 'gallery');
  if (view === 'chat') {
    renderChatOrWelcome();
  } else {
    loadGallery();
  }
}

function switchTab(tab) {
  $('tab-settings').classList.toggle('active', tab === 'settings');
  $('tab-params').classList.toggle('active',   tab === 'params');
  $('panel-settings').classList.toggle('hidden', tab !== 'settings');
  $('panel-params').classList.toggle('hidden',   tab !== 'params');
}

// ── Textarea ──────────────────────────────────────────────────────────────────
function initTextarea() {
  const ta = $('user-input');

  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    State.historyIndex = -1; // reset history browsing when typing
  });

  ta.addEventListener('keydown', e => {
    // Send
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
      return;
    }

    // Prompt history — ↑ / ↓
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      if (State.promptHistory.length === 0) return;
      e.preventDefault();
      if (State.historyIndex < State.promptHistory.length - 1) {
        State.historyIndex++;
      }
      ta.value = State.promptHistory[State.promptHistory.length - 1 - State.historyIndex] ?? '';
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
      // Move cursor to end
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = ta.value.length; }, 0);
      return;
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      if (State.historyIndex <= 0) {
        State.historyIndex = -1;
        ta.value = '';
        ta.style.height = 'auto';
        return;
      }
      e.preventDefault();
      State.historyIndex--;
      ta.value = State.promptHistory[State.promptHistory.length - 1 - State.historyIndex] ?? '';
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
      return;
    }

    // Ctrl+L — clear memory
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      clearMemory();
      return;
    }
  });
}

// ── Scroll ────────────────────────────────────────────────────────────────────
function scrollMessages() {
  const el = $('messages');
  if (!el) return;
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (dist < 150) el.scrollTop = el.scrollHeight;
}

function forceScrollBottom() {
  const el = $('messages');
  if (el) el.scrollTop = el.scrollHeight;
}

// ── Message Rendering ─────────────────────────────────────────────────────────
function clearWelcome() {
  $('welcome')?.remove();
}

function renderChatOrWelcome() {
  const el = $('messages');
  el.innerHTML = '';
  if (State.memory.length === 0) {
    el.innerHTML = `
      <div id="welcome">
        <div class="welcome-glyph">🧠</div>
        <div class="welcome-title">AXIOM</div>
        <div class="welcome-sub">Sharp. Direct. Occasionally sarcastic.<br/>Text or image — I'll figure it out.</div>
      </div>`;
  } else {
    for (const m of State.memory) {
      if (m.role === 'system') continue;
      if (m._isImage && m._payload) {
        appendImageBubble(m._display, m._payload, m._filename ?? '');
      } else {
        appendBubble(m.role, m._display ?? m.content);
      }
    }
  }
  scrollMessages();
}

function appendBubble(role, content) {
  clearWelcome();
  const msgs = $('messages');
  const div  = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="msg-body"><div class="msg-bubble">${sanitize(content)}</div></div>`;
  msgs.appendChild(div);
  scrollMessages();
  return div;
}

function appendThoughtBubble() {
  clearWelcome();
  const msgs = $('messages');
  const div  = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="thought-bubble">
        <div class="thought-label"><span class="status-dot thinking"></span>THINKING</div>
        <div class="thought-steps"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollMessages();
  return div.querySelector('.thought-steps');
}

function addStep(container, text, state = 'spin') {
  const icons = { spin: '⟳', done: '✓', error: '✗' };
  const el    = document.createElement('div');
  el.className = 'step-item';
  el.innerHTML = `<div class="step-num ${state}">${icons[state] ?? '⟳'}</div><div class="step-text">${sanitize(text)}</div>`;
  container.appendChild(el);
  scrollMessages();
  return el;
}

function updateStep(el, text, state = 'done') {
  const icons = { spin: '⟳', done: '✓', error: '✗' };
  el.querySelector('.step-num').className = `step-num ${state}`;
  el.querySelector('.step-num').textContent = icons[state] ?? '⟳';
  el.querySelector('.step-text').textContent = text;
}

function appendTyping() {
  clearWelcome();
  const msgs = $('messages');
  const div  = document.createElement('div');
  div.className = 'msg assistant';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="msg-bubble" style="padding:10px 14px">
        <div class="typing-indicator">
          <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollMessages();
  return div;
}

function removeTyping() { $('typing-msg')?.remove(); }

function appendProgressBar() {
  const msgs = $('messages');
  const div  = document.createElement('div');
  div.className = 'msg assistant';
  div.id = 'progress-msg';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body" style="width:72%">
      <div class="msg-bubble" style="width:100%">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div id="progress-label" style="font-size:12px;color:var(--text-sub)">Generating… 0%</div>
          <button onclick="interruptGeneration()" style="
            background:rgba(255,79,106,0.12);border:1px solid rgba(255,79,106,0.3);
            color:rgba(255,79,106,0.8);border-radius:5px;padding:2px 8px;
            font-size:10px;cursor:pointer;font-family:var(--font-mono);
          ">✕ Stop</button>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" id="progress-fill" style="width:0%"></div></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollMessages();
}

async function interruptGeneration() {
  await window.api.a1111.interrupt();
  toast('Generation interrupted', 'info');
}

function updateProgress(pct, label) {
  const fill = $('progress-fill');
  const lbl  = $('progress-label');
  if (fill) fill.style.width = Math.round(pct * 100) + '%';
  if (lbl)  lbl.textContent  = label || `Generating… ${Math.round(pct * 100)}%`;
  scrollMessages();
}

function removeProgress() {
  $('progress-msg')?.remove();
  if (State.progressInterval) {
    clearInterval(State.progressInterval);
    State.progressInterval = null;
  }
}

// ── Image Bubble with Params Panel ────────────────────────────────────────────
const PARAM_LABELS = {
  width: 'Width', height: 'Height', steps: 'Steps', cfg_scale: 'CFG',
  sampler_name: 'Sampler', seed: 'Seed', enable_hr: 'Hires Fix',
  hr_upscaler: 'Upscaler', hr_scale: 'HR Scale',
  hr_second_pass_steps: 'HR Steps', denoising_strength: 'Denoise',
};

function appendImageBubble(dataUrl, params, filename) {
  clearWelcome();
  const msgs  = $('messages');
  const panelId = `params-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Chip row (quick summary)
  const chips = [];
  if (params.width && params.height) chips.push(`${params.width}×${params.height}`);
  for (const [k, v] of Object.entries(params)) {
    if (['prompt','negative_prompt','width','height'].includes(k)) continue;
    const label = PARAM_LABELS[k] ?? k;
    chips.push(`${label}: ${k === 'enable_hr' ? (v ? 'ON' : 'OFF') : v}`);
  }
  const chipHTML = chips.map(c => `<span class="param-chip">${sanitize(c)}</span>`).join('');

  // Full params grid
  const gridHTML = Object.entries(params)
    .filter(([k]) => !['prompt','negative_prompt'].includes(k))
    .map(([k, v]) => `
      <div class="params-kv">
        <span class="params-key">${sanitize(PARAM_LABELS[k] ?? k)}</span>
        <span class="params-val">${sanitize(String(k === 'enable_hr' ? (v ? 'ON' : 'OFF') : v))}</span>
      </div>`).join('');

  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body" style="max-width:80%">
      <div class="msg-bubble" style="padding:8px">
        <img class="msg-image" src="${dataUrl}" onclick="openViewer('${dataUrl}')" alt="Generated image" style="cursor:zoom-in"/>
        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
          <div class="img-params-toggle" onclick="toggleParams('${panelId}')" style="flex:1;min-width:0">
            <span style="font-size:11px;color:var(--text-dim)">⚙</span>
            <span style="font-size:10px;color:var(--text-dim);font-family:var(--font-mono)">params</span>
            <div class="param-chips-preview">${chipHTML}</div>
          </div>
          <button onclick="copyPrompt(${JSON.stringify(params.prompt ?? '')})" class="img-action-btn" title="Copy positive prompt">📋</button>
          <button onclick="regenerateImage()" class="img-action-btn" title="Regenerate with new seed">🎲</button>
        </div>
        <div class="img-params-panel hidden" id="${panelId}">
          <div class="params-section-label">POSITIVE PROMPT</div>
          <div class="params-prompt-text">${sanitize(params.prompt ?? '')}</div>
          <div class="params-section-label" style="margin-top:8px">NEGATIVE PROMPT</div>
          <div class="params-prompt-text">${sanitize(params.negative_prompt ?? '')}</div>
          <div class="params-section-label" style="margin-top:8px">PARAMETERS</div>
          <div class="params-grid">${gridHTML}</div>
          <div style="font-size:9px;color:var(--text-dim);font-family:var(--font-mono);margin-top:8px">${sanitize(filename)}</div>
        </div>
      </div>
    </div>`;

  msgs.appendChild(div);
  scrollMessages();
}

function toggleParams(id) {
  $( id)?.classList.toggle('hidden');
  scrollMessages();
}

// ── Memory Sidebar ────────────────────────────────────────────────────────────
function renderMemory() {
  const list  = $('memory-list');
  const items = State.memory.filter(m => m.role !== 'system');
  if (items.length === 0) {
    list.innerHTML = `<div style="font-size:11px;color:var(--text-dim);text-align:center;margin-top:12px;">No history yet</div>`;
    return;
  }
  list.innerHTML = items.map(m => {
    const preview = (m._display ?? m.content ?? '').toString().slice(0, 52).replace(/\n/g, ' ');
    return `<div class="memory-item ${m.role}">${m.role === 'user' ? '→' : '←'} ${sanitize(preview)}</div>`;
  }).join('');
}

function clearMemory() {
  State.memory = [];
  renderMemory();
  renderChatOrWelcome();
  toast('Memory cleared', 'info');
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function populateSettings() {
  const s = State.settings;
  if (!s) return;

  $('s-api-key').value       = s.openaiApiKey       ?? '';
  $('s-model').value         = s.openaiModel         ?? 'llama-3.3-70b-versatile';
  $('s-system-prompt').value = s.systemPrompt        ?? '';
  $('s-auto-launch').checked = s.autoLaunchWebui     !== false;
  $('s-webui-bat').value     = s.webuiBat            ?? '';
  $('s-a1111-url').value     = s.a1111Url            ?? 'http://127.0.0.1:7860';
  $('s-models-dir').value    = s.modelsDir           ?? '';
  $('s-output-dir').value    = s.outputDir           ?? '';
  $('s-encryption').checked  = !!s.encryptionEnabled;
  $('s-enc-key-file').value  = s.encryptionKeyFile   ?? '';
  $('s-custom-negative').value = s.customNegative ?? '';

  const p = s.imageParams ?? {};
  $('p-width').value        = p.width                ?? 512;
  $('p-height').value       = p.height               ?? 512;
  $('p-steps').value        = p.steps                ?? 30;
  $('p-cfg').value          = p.cfg_scale            ?? 7;
  $('p-sampler').value      = p.sampler_name         ?? 'DPM++ 2M Karras';
  $('p-hires').checked      = p.enable_hr            !== false;
  $('p-upscaler').value     = p.hr_upscaler          ?? 'Lanczos';
  $('p-hires-steps').value  = p.hr_second_pass_steps ?? 15;
  $('p-denoise').value      = p.denoising_strength   ?? 0.45;
  $('p-hr-scale').value     = p.hr_scale             ?? 2;
}

async function saveSettings() {
  const incoming = {
    openaiApiKey:      $('s-api-key').value.trim(),
    openaiModel:       $('s-model').value,
    systemPrompt:      $('s-system-prompt').value,
    autoLaunchWebui:   $('s-auto-launch').checked,
    webuiBat:          $('s-webui-bat').value.trim(),
    a1111Url:          $('s-a1111-url').value.trim().replace(/\/$/, ''),
    modelsDir:         $('s-models-dir').value.trim(),
    outputDir:         $('s-output-dir').value.trim(),
    encryptionEnabled: $('s-encryption').checked,
    encryptionKeyFile:  $('s-enc-key-file').value.trim(),
    customNegative:    $('s-custom-negative').value.trim(),
    imageParams: {
      width:                + $('p-width').value,
      height:               + $('p-height').value,
      steps:                + $('p-steps').value,
      cfg_scale:            + $('p-cfg').value,
      sampler_name:           $('p-sampler').value,
      enable_hr:              $('p-hires').checked,
      hr_upscaler:            $('p-upscaler').value,
      hr_second_pass_steps: + $('p-hires-steps').value,
      denoising_strength:   + $('p-denoise').value,
      hr_scale:             + $('p-hr-scale').value,
    },
  };

  const res = await window.api.settings.save(incoming);
  if (res.ok) {
    State.settings = incoming;
    toast('Settings saved ✓', 'success');
    $('model-hint').textContent = incoming.openaiModel ?? '';
  } else {
    toast('Failed to save settings', 'error');
  }
}

async function pingA1111() {
  const res = await window.api.a1111.ping();
  setA1111Status(res.online);
  const el = $('a1111-ping-result');
  if (el) {
    el.textContent = res.online ? '✓ Online' : '✗ Offline';
    el.style.color = res.online ? 'var(--success)' : 'var(--danger)';
  }
  return res.online;
}

async function generateEncKey() {
  const res = await window.api.encryption.generateKey();
  if (res.key) toast('New encryption key generated ✓', 'success');
  else         toast('Error: ' + res.error, 'error');
}

// ── Model Selection ───────────────────────────────────────────────────────────
async function selectBestModel(prompt, container) {
  const step1 = addStep(container, 'Scanning available models…');
  const { models, error } = await window.api.models.scan();

  if (error || !models?.length) {
    updateStep(step1, error ?? 'No models found with .txt notes', 'error');
    return null;
  }
  updateStep(step1, `Found ${models.length} model(s) with notes`);

  const step2 = addStep(container, 'Asking AI to pick the best model…');
  const ctx   = models.map(m => `Model: ${m.baseName}\nNotes:\n${m.notes}`).join('\n\n---\n\n');

  const res = await window.api.openai.chat([
    { role: 'system', content: 'You select the best Stable Diffusion model. Respond ONLY with raw JSON: {"choice":"<baseName>","reason":"<one line why>"}' },
    { role: 'user',   content: `Prompt:\n${prompt}\n\nAvailable models:\n${ctx}\n\nPick the best model.` },
  ]);

  if (res.error) {
    updateStep(step2, `AI selection failed — using first model: ${models[0].baseName}`, 'error');
    return models[0];
  }

  const parsed = safeParseJSON(res.content);
  const chosen = models.find(m => m.baseName === parsed?.choice) ?? models[0];
  updateStep(step2, `Selected: ${chosen.baseName} — ${parsed?.reason ?? 'best match'}`);
  return chosen;
}

// ── LoRA Modal ────────────────────────────────────────────────────────────────
function showLoraModal(modelName) {
  $('lora-modal-sub').textContent = `Model "${modelName}" loaded. Add a LoRA?`;
  $('lora-tag-input').value     = '';
  $('lora-trigger-input').value = '';
  $('modal-overlay').classList.add('show');
  return new Promise(resolve => { State.modalResolve = resolve; });
}

function closeModal(apply) {
  const tag     = $('lora-tag-input').value.trim();
  const trigger = $('lora-trigger-input').value.trim();
  $('modal-overlay').classList.remove('show');
  if (State.modalResolve) {
    State.modalResolve(apply ? { tag, trigger } : null);
    State.modalResolve = null;
  }
}

// ── Image Generation Pipeline ─────────────────────────────────────────────────
async function generateImage(rawPrompt, chatParams = {}, requestedModelName = null) {
  const container = appendThoughtBubble();

  // ── Step 1: Model selection ───────────────────────────────────────────────
  let model;
  if (requestedModelName) {
    const s1 = addStep(container, `Looking up requested model: "${requestedModelName}"…`);
    const { models = [] } = await window.api.models.scan();
    const found = models.find(m =>
      m.baseName.toLowerCase() === requestedModelName.toLowerCase() ||
      m.baseName.toLowerCase().includes(requestedModelName.toLowerCase())
    );
    if (found) {
      model = found;
      updateStep(s1, `Using: ${found.baseName}`);
    } else {
      updateStep(s1, `"${requestedModelName}" not found — falling back to AI selection`, 'error');
      model = await selectBestModel(rawPrompt, container);
    }
  } else {
    model = await selectBestModel(rawPrompt, container);
  }

  if (!model) {
    appendBubble('assistant', '⚠ No models found. Check your models directory in Settings and make sure each .safetensors has a matching .txt notes file.');
    return;
  }

  // ── Step 2: Load model in A1111 ───────────────────────────────────────────
  const s2         = addStep(container, `Loading ${model.baseName} in A1111…`);
  const { models: a1111Models = [] } = await window.api.a1111.getModels();
  const a1111Match = a1111Models.find(m =>
    m.model_name?.toLowerCase().includes(model.baseName.toLowerCase()) ||
    m.title?.toLowerCase().includes(model.baseName.toLowerCase())
  );

  if (!a1111Match) {
    updateStep(s2, `"${model.baseName}" not in A1111's model list. Check your models path.`, 'error');
    appendBubble('assistant', `⚠ Model "${model.baseName}" not found in A1111. Is the models directory correct in Settings?`);
    return;
  }

  const setRes = await window.api.a1111.setModel(a1111Match.title ?? a1111Match.model_name);
  updateStep(s2, setRes.ok ? `Loaded: ${model.baseName}` : `Load failed — ${setRes.error ?? 'unknown'}`, setRes.ok ? 'done' : 'error');
  if (setRes.ok) updateLoadedModelPill(model.baseName);

  // ── Step 3: LoRA ──────────────────────────────────────────────────────────
  const s3        = addStep(container, 'LoRA selection…', 'spin');
  const loraChoice = await showLoraModal(model.baseName);
  let finalPrompt  = rawPrompt;

  if (loraChoice?.tag) {
    const parts = [rawPrompt, loraChoice.trigger, loraChoice.tag].filter(Boolean);
    finalPrompt = parts.join(', ').replace(/,\s*,/g, ',');
    updateStep(s3, `LoRA: ${loraChoice.tag}`);
  } else {
    updateStep(s3, 'No LoRA applied');
  }

  // ── Step 4: Prompt refinement ─────────────────────────────────────────────
  const s4    = addStep(container, 'Refining prompt…');
  const refRes = await window.api.openai.chat([
    {
      role: 'system',
      content: `You are an expert Stable Diffusion prompt engineer. Convert the user request into booru-style tags.

RULES:
- Comma-separated short tags only. No prose.
- Order: subject count → subject description → clothing → pose/action → setting → lighting → quality tags
- Standard danbooru format: spaces not underscores ("hair over one eye" not "hair_over_one_eye")
- Quality tags last: masterpiece, best quality, very aesthetic, ultra-detailed
- Pull trigger words and negative prompt from the model notes
- Respond ONLY with raw JSON: {"prompt":"<tags>","negative_prompt":"<tags>"}`,
    },
    {
      role: 'user',
      content: `Model: ${model.baseName}\nNotes:\n${model.notes}\n\nRequest: ${finalPrompt}\n\nConvert to booru tags.`,
    },
  ]);

  let positivePrompt = finalPrompt;
  let negativePrompt = 'low quality, blurry, distorted, bad anatomy, watermark';

  const refined = safeParseJSON(refRes.content ?? '');
  if (refined?.prompt) {
    positivePrompt = refined.prompt;
    negativePrompt = refined.negative_prompt ?? negativePrompt;
    // Append global custom negative if set
    const customNeg = State.settings.customNegative?.trim();
    if (customNeg) negativePrompt = `${negativePrompt}, ${customNeg}`;
    updateStep(s4, 'Prompt refined');
  } else {
    updateStep(s4, 'Refinement failed — using raw prompt', 'error');
  }

  // ── Step 5: Override info ─────────────────────────────────────────────────
  const overrideKeys = Object.keys(chatParams);
  if (overrideKeys.length > 0) {
    addStep(container, `Param overrides: ${overrideKeys.map(k => `${k}=${chatParams[k]}`).join(', ')}`, 'done');
  }

  // ── Step 6: Generate ──────────────────────────────────────────────────────
  const s6 = addStep(container, 'Sending to A1111…');

  const payload = {
    prompt:          positivePrompt,
    negative_prompt: negativePrompt,
    ...(State.settings.imageParams ?? {}),
    ...chatParams,   // explicit chat overrides win
  };

  // Store for regenerate
  State.lastPayload        = payload;
  State.lastRawPrompt      = rawPrompt;
  State.lastRequestedModel = requestedModelName;

  appendProgressBar();
  State.progressInterval = setInterval(async () => {
    const prog = await window.api.a1111.progress();
    updateProgress(
      prog.progress,
      `Generating… ${Math.round(prog.progress * 100)}%${prog.eta ? ` — ETA: ${prog.eta.toFixed(1)}s` : ''}`
    );
  }, 1000);

  const genRes = await window.api.a1111.generate(payload);
  removeProgress();

  if (genRes.error) {
    updateStep(s6, `Failed: ${genRes.error}`, 'error');
    appendBubble('assistant', `⚠ Generation failed: ${genRes.error}`);
    return;
  }

  const imgData = genRes.images?.[0];
  if (!imgData) {
    updateStep(s6, 'No image data returned', 'error');
    appendBubble('assistant', '⚠ A1111 returned no image data.');
    return;
  }

  updateStep(s6, 'Image generated successfully!');

  // ── Step 7: Save & display ────────────────────────────────────────────────
  const filename = `axiom_${Date.now()}.png`;
  await window.api.image.save(imgData, filename);

  const dataUrl = `data:image/png;base64,${imgData}`;

  State.memory.push({
    role:      'assistant',
    content:   `[Image: ${filename}]`,
    _display:  dataUrl,
    _isImage:  true,
    _payload:  payload,
    _filename: filename,
  });
  renderMemory();
  appendImageBubble(dataUrl, payload, filename);
  toast('Image saved!', 'success');
}

// ── Regenerate ───────────────────────────────────────────────────────────────
async function regenerateImage() {
  if (State.isProcessing) return;
  if (!State.lastPayload) { toast('Nothing to regenerate yet', 'info'); return; }

  setProcessing(true);
  clearWelcome();

  // New random seed
  const payload = { ...State.lastPayload, seed: -1 };
  State.lastPayload = payload;

  appendBubble('assistant', '🎲 Regenerating with new seed…');
  forceScrollBottom();

  try {
    appendProgressBar();
    State.progressInterval = setInterval(async () => {
      const prog = await window.api.a1111.progress();
      updateProgress(
        prog.progress,
        `Regenerating… ${Math.round(prog.progress * 100)}%${prog.eta ? ` — ETA: ${prog.eta.toFixed(1)}s` : ''}`
      );
    }, 1000);

    const genRes = await window.api.a1111.generate(payload);
    removeProgress();

    if (genRes.error) {
      appendBubble('assistant', `⚠ Regeneration failed: ${genRes.error}`);
      return;
    }

    const imgData = genRes.images?.[0];
    if (!imgData) { appendBubble('assistant', '⚠ No image data returned.'); return; }

    const filename = `axiom_${Date.now()}.png`;
    await window.api.image.save(imgData, filename);

    const dataUrl = `data:image/png;base64,${imgData}`;
    State.memory.push({
      role: 'assistant', content: `[Image: ${filename}]`,
      _display: dataUrl, _isImage: true, _payload: payload, _filename: filename,
    });
    renderMemory();
    appendImageBubble(dataUrl, payload, filename);
    toast('Regenerated!', 'success');
  } catch (e) {
    removeProgress();
    appendBubble('assistant', `⚠ Error: ${e.message}`);
  } finally {
    setProcessing(false);
  }
}

function copyPrompt(prompt) {
  navigator.clipboard.writeText(prompt)
    .then(() => toast('Prompt copied!', 'success'))
    .catch(() => toast('Copy failed', 'error'));
}

// ── Main Agent ────────────────────────────────────────────────────────────────
async function sendMessage() {
  if (State.isProcessing) return;

  const input    = $('user-input');
  const userText = input.value.trim();
  if (!userText) return;

  if (!State.settings?.openaiApiKey) {
    toast('No Groq API key — go to Settings and paste your key from console.groq.com', 'error', 6000);
    return;
  }

  input.value        = '';
  input.style.height = 'auto';
  setProcessing(true);
  clearWelcome();

  appendBubble('user', userText);
  forceScrollBottom();

  // Save to prompt history (dedupe consecutive identical prompts)
  if (State.promptHistory[State.promptHistory.length - 1] !== userText) {
    State.promptHistory.push(userText);
    if (State.promptHistory.length > 50) State.promptHistory.shift(); // cap at 50
  }
  State.historyIndex = -1;

  State.memory.push({ role: 'user', content: userText, _display: userText });
  renderMemory();

  try {
    // Build message history for Groq
    const messages = [
      { role: 'system', content: State.settings.systemPrompt },
      ...State.memory
        .filter(m => m.role !== 'system')
        .map(m => ({
          role:    m.role,
          content: m._isImage ? `[User previously generated image: ${m._filename ?? 'unknown'}]` : (m._display ?? m.content),
        })),
    ];

    appendTyping();
    const res = await window.api.openai.chat(messages);
    removeTyping();

    if (res.error) {
      appendBubble('assistant', `⚠ Groq error: ${res.error}`);
      toast(res.error, 'error', 6000);
      setProcessing(false);
      return;
    }

    updateTokenCounter(res.usage);

    const decision = safeParseJSON(res.content) ?? { type: 'text', response: res.content };

    if (decision.type === 'image') {
      const imgPrompt      = decision.imagePrompt ?? userText;
      const chatParams     = (typeof decision.params === 'object' && !Array.isArray(decision.params))
        ? decision.params
        : {};
      const requestedModel = typeof decision.model === 'string' && decision.model.length > 0
        ? decision.model
        : null;

      const online = await pingA1111();
      if (!online) {
        appendBubble('assistant', '⚠ A1111 is offline. Start the WebUI first.');
        setProcessing(false);
        return;
      }

      if (decision.reason) {
        appendBubble('assistant', decision.reason);
      }

      State.memory.push({
        role:     'assistant',
        content:  `[Routing to image: "${imgPrompt}"]`,
        _display: decision.reason ?? `Generating: "${imgPrompt}"`,
      });
      renderMemory();

      await generateImage(imgPrompt, chatParams, requestedModel);

    } else {
      const text = decision.response ?? res.content;
      State.memory.push({ role: 'assistant', content: text, _display: text });
      renderMemory();
      appendBubble('assistant', text);
    }

  } catch (e) {
    removeTyping();
    removeProgress();
    console.error('[AXIOM] sendMessage error:', e);
    appendBubble('assistant', `⚠ Unexpected error: ${e.message}`);
    toast(e.message, 'error', 5000);
  } finally {
    setProcessing(false);
  }
}

// ── Gallery ───────────────────────────────────────────────────────────────────
async function loadGallery() {
  const msgs = $('messages');
  msgs.innerHTML = `
    <div style="padding:20px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:var(--text-dim);text-transform:uppercase">
          Output Gallery
        </div>
        <button class="btn btn-outline btn-sm" onclick="openOutputFolder()">Open Folder</button>
      </div>
      <div id="gallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;"></div>
      <div id="gallery-status" style="color:var(--text-sub);font-size:12px;margin-top:12px">Loading…</div>
    </div>`;

  const { files = [], error } = await window.api.gallery.list();
  const grid   = $('gallery-grid');
  const status = $('gallery-status');

  if (error) { status.textContent = `Error: ${error}`; return; }
  if (!files.length) { status.textContent = 'No images found in output directory.'; return; }

  status.textContent = `${files.length} file(s)`;

  for (const f of files) {
    const isPng       = f.name.endsWith('.png');
    const isEncrypted = f.name.endsWith('.encrypted');

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--bg-card);border:1px solid var(--border);border-radius:10px;
      overflow:hidden;cursor:pointer;transition:border-color 0.15s;`;

    if (isPng) {
      // Load and show thumbnail
      const fileRes = await window.api.gallery.readFile(f.path);
      if (fileRes.data) {
        const src = `data:image/png;base64,${fileRes.data}`;
        card.innerHTML = `
          <img src="${src}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block"/>
          <div style="padding:6px 8px;font-size:9px;font-family:var(--font-mono);color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(f.name)}</div>`;
        card.onclick = () => openViewer(src);
      }
    } else if (isEncrypted) {
      card.innerHTML = `
        <div style="aspect-ratio:1;display:grid;place-items:center;flex-direction:column;gap:8px">
          <div style="font-size:28px">🔒</div>
        </div>
        <div style="padding:6px 8px;font-size:9px;font-family:var(--font-mono);color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(f.name)}</div>`;
      card.onclick = () => toast('Open the A1111 Encrypted Gallery tab to view this image.', 'info', 4000);
    }

    card.onmouseover  = () => card.style.borderColor = 'var(--accent)';
    card.onmouseleave = () => card.style.borderColor = 'var(--border)';
    grid.appendChild(card);
  }
}

async function openOutputFolder() {
  const res = await window.api.gallery.openFolder();
  if (res?.error) toast(res.error, 'error');
}

// ── Image Viewer ──────────────────────────────────────────────────────────────
function openViewer(src) {
  $('viewer-img').src = src;
  $('image-viewer').classList.add('show');
}

function closeImageViewer() {
  $('image-viewer').classList.remove('show');
}

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeImageViewer();
});
