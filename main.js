'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

// ── Constants ─────────────────────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const IS_DEV        = process.argv.includes('--dev');

const DEFAULT_SETTINGS = {
  openaiApiKey:      '',
  openaiModel:       'llama-3.3-70b-versatile',
  systemPrompt:      buildSystemPrompt(),
  a1111Url:          'http://127.0.0.1:7860',
  webuiBat:          '',
  autoLaunchWebui:   true,
  modelsDir:         '',
  outputDir:         '',
  encryptionEnabled: false,
  encryptionKeyFile: '',
  imageParams: {
    width:                 512,
    height:                512,
    steps:                 30,
    cfg_scale:             7,
    sampler_name:          'DPM++ 2M Karras',
    enable_hr:             true,
    hr_upscaler:           'Lanczos',
    hr_second_pass_steps:  15,
    denoising_strength:    0.45,
    hr_scale:              2,
  },
};

// ── System Prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are AXIOM — a sharp, no-bullshit AI agent with a dark sense of humor. You're highly capable and you know it, but not insufferable about it. You speak directly, use short punchy sentences, and occasionally swear when it fits. You give unsolicited opinions when you have something worth saying. You can be sarcastic — especially when a request is vague or obvious — but you always deliver.

You have two modes:
1. TEXT — answer the user directly. No filler, no "Great question!", no corporate-speak.
2. IMAGE — generate an image via the Stable Diffusion pipeline.

ROUTING: Route to image if the user wants something visual (draw, generate, make, create, show, paint, sketch, render, visualize, illustrate, design). Everything else is text.

OUTPUT FORMAT — non-negotiable. Always respond with raw JSON only. No markdown. No backticks. Start with { end with }.

Text:  {"type":"text","response":"<your answer>"}
Image: {"type":"image","imagePrompt":"<booru tags>","reason":"<one line>","model":"<baseName or omit>","params":{}}

IMAGE PROMPT: Booru-style comma-separated tags only. No prose. Order: subject count → subject description → clothing → pose/action → setting → lighting → quality tags.
Example: "1girl, silver hair, hair over one eye, laughing, ruffle blouse, pleated skirt, dancing, one foot raised, wildflower hill, cloudy sky, wind, masterpiece, best quality, very aesthetic"

MODEL FIELD (optional): Only include if user explicitly names a model. Use exact baseName (filename without .safetensors). Known models: meinamix, dark, Pastel, flat, cetusMix, anyniji, hassakuSD15_v13, Realistic, sudachi. Omit field if user doesn't specify — system auto-picks.

PARAMS FIELD (optional): Only include params the user EXPLICITLY requests. Do NOT infer or assume. If user says "draw me a portrait" → params: {}. If user says "512x768 portrait" → params: {"width":512,"height":768}.
Available params:
- width, height (integers) — resolution in pixels
- steps (integer 20–60) — sampling steps
- cfg_scale (number 4–12) — prompt adherence
- sampler_name (string) — "DPM++ 2M Karras" | "DPM++ SDE Karras" | "DPM++ 2M SDE" | "Euler a" | "Euler" | "DDIM" | "UniPC" | "LCM"
- seed (integer, -1 = random)
- enable_hr (boolean) — hires fix
- hr_upscaler (string) — "Lanczos" | "R-ESRGAN 4x+" | "R-ESRGAN 4x+ Anime6B" | "ESRGAN_4x" | "SwinIR_4x"
- hr_scale (number 1.5–4)
- hr_second_pass_steps (integer)
- denoising_strength (number 0.3–0.7)

Examples:
- "draw me a portrait" → {"type":"image","imagePrompt":"...","reason":"...","params":{}}
- "portrait at 512x768, 40 steps" → params:{"width":512,"height":768,"steps":40}
- "use dark sushi model" → model:"dark"
- "no hires fix" → params:{"enable_hr":false}
- "seed 12345" → params:{"seed":12345}`;
}

// ── Settings ──────────────────────────────────────────────────────────────────
function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key in overrides) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      typeof defaults[key] === 'object'
    ) {
      result[key] = deepMerge(defaults[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw  = fs.readFileSync(SETTINGS_PATH, 'utf8');
      const saved = JSON.parse(raw);
      return deepMerge(DEFAULT_SETTINGS, saved);
    }
  } catch (e) {
    console.error('[settings] Failed to load:', e.message);
  }
  return structuredClone(DEFAULT_SETTINGS);
}

function saveSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('[settings] Failed to save:', e.message);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let mainWindow   = null;
let settings     = loadSettings();
let webuiProcess = null;

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1300,
    height:          880,
    minWidth:        900,
    minHeight:       620,
    frame:           false,
    titleBarStyle:   'hidden',
    backgroundColor: '#080810',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  mainWindow.loadFile('loading.html');
  if (IS_DEV) mainWindow.webContents.openDevTools();

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  killWebui();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function killWebui() {
  if (!webuiProcess) return;
  try {
    execSync(`taskkill /pid ${webuiProcess.pid} /T /F`, { stdio: 'ignore' });
  } catch (_) { /* process may already be gone */ }
  webuiProcess = null;
}

// ── IPC: Window Controls ──────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window:close',    () => mainWindow?.close());

// ── IPC: Settings ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => settings);

ipcMain.handle('settings:save', (_e, incoming) => {
  settings = deepMerge(DEFAULT_SETTINGS, incoming);
  saveSettings(settings);
  return { ok: true };
});

ipcMain.handle('settings:reset', () => {
  settings = structuredClone(DEFAULT_SETTINGS);
  saveSettings(settings);
  return { ok: true, settings };
});

// ── IPC: WebUI Launch ─────────────────────────────────────────────────────────
ipcMain.handle('webui:launch', async () => {
  const batPath = settings.webuiBat;

  if (!batPath) return { error: 'No WebUI .bat path set. Go to Settings → A1111 Backend.' };

  const batNorm = batPath.replace(/\//g, '\\');
  if (!fs.existsSync(batNorm)) return { error: `webui-user.bat not found at: ${batNorm}` };
  if (webuiProcess)            return { error: 'WebUI is already running.' };

  try {
    const workDir = path.dirname(batNorm);

    webuiProcess = spawn('cmd.exe', ['/c', batNorm], {
      cwd:         workDir,
      stdio:       ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    webuiProcess.stdout.setEncoding('utf8');
    webuiProcess.stderr.setEncoding('utf8');

    let buffer = '';

    const processChunk = (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // hold incomplete line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        sendToRenderer('webui:log', trimmed);

        if (trimmed.includes('Running on local URL')) {
          sendToRenderer('webui:ready');
        }

        if (
          trimmed.includes('Traceback (most recent call last)') ||
          trimmed.includes('RuntimeError:') ||
          trimmed.includes('ModuleNotFoundError:')
        ) {
          sendToRenderer('webui:error', trimmed);
        }
      }
    };

    webuiProcess.stdout.on('data', processChunk);
    webuiProcess.stderr.on('data', processChunk);

    webuiProcess.on('exit', (code) => {
      webuiProcess = null;
      sendToRenderer('webui:exited', code);
    });

    webuiProcess.on('error', (err) => {
      webuiProcess = null;
      sendToRenderer('webui:error', `Process error: ${err.message}`);
    });

    return { ok: true, pid: webuiProcess.pid };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('webui:isRunning', () => ({ running: !!webuiProcess }));
ipcMain.handle('webui:kill',      () => { killWebui(); return { ok: true }; });

// ── IPC: Models ───────────────────────────────────────────────────────────────
ipcMain.handle('models:scan', async () => {
  const dir = settings.modelsDir;
  if (!dir)                  return { error: 'Models directory not set.',      models: [] };
  if (!fs.existsSync(dir))   return { error: `Directory not found: ${dir}`,    models: [] };

  try {
    const models = fs.readdirSync(dir)
      .filter(f => f.endsWith('.safetensors'))
      .map(filename => {
        const baseName = filename.replace('.safetensors', '');
        const txtPath  = path.join(dir, `${baseName}.txt`);
        const hasNotes = fs.existsSync(txtPath);
        const notes    = hasNotes ? fs.readFileSync(txtPath, 'utf8').trim() : null;
        return { filename, baseName, hasNotes, notes };
      })
      .filter(m => m.hasNotes);

    return { models, dir };
  } catch (e) {
    return { error: e.message, models: [] };
  }
});

// ── IPC: Encryption ───────────────────────────────────────────────────────────
ipcMain.handle('encryption:loadKey', () => {
  const keyFile = settings.encryptionKeyFile;
  if (!keyFile || !fs.existsSync(keyFile)) return { key: null, error: 'Key file not found' };
  try {
    return { key: fs.readFileSync(keyFile, 'utf8').trim() };
  } catch (e) {
    return { key: null, error: e.message };
  }
});

ipcMain.handle('encryption:generateKey', () => {
  const keyFile = settings.encryptionKeyFile;
  if (!keyFile) return { error: 'No key file path set.' };
  try {
    const dir = path.dirname(keyFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const key = crypto.randomBytes(32).toString('base64');
    fs.writeFileSync(keyFile, key, 'utf8');
    return { key };
  } catch (e) {
    return { error: e.message };
  }
});

// ── IPC: Gallery ──────────────────────────────────────────────────────────────
ipcMain.handle('gallery:list', () => {
  const dir = settings.outputDir;
  if (!dir || !fs.existsSync(dir)) return { files: [] };
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.encrypted') || f.endsWith('.png'))
      .sort((a, b) => {
        // Sort by modified time descending (newest first)
        const ta = fs.statSync(path.join(dir, a)).mtimeMs;
        const tb = fs.statSync(path.join(dir, b)).mtimeMs;
        return tb - ta;
      })
      .map(f => ({ name: f, path: path.join(dir, f) }));
    return { files };
  } catch (e) {
    return { files: [], error: e.message };
  }
});

ipcMain.handle('gallery:readFile', (_e, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { data: data.toString('base64') };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('gallery:openFolder', () => {
  const dir = settings.outputDir;
  if (dir && fs.existsSync(dir)) shell.openPath(dir);
  else return { error: 'Output directory not set or does not exist.' };
  return { ok: true };
});

// ── IPC: Image ────────────────────────────────────────────────────────────────
ipcMain.handle('image:save', (_e, base64Data, filename) => {
  const dir = settings.outputDir;
  if (!dir) return { error: 'Output directory not set.' };
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename || `axiom_${Date.now()}.png`);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return { path: filePath };
  } catch (e) {
    return { error: e.message };
  }
});

// ── IPC: Memory ───────────────────────────────────────────────────────────────
ipcMain.handle('memory:clear', () => ({ ok: true }));

// ── IPC: A1111 ────────────────────────────────────────────────────────────────
async function a1111Fetch(endpoint, options = {}) {
  const fetch   = require('node-fetch');
  const baseUrl = settings.a1111Url || 'http://127.0.0.1:7860';
  const res     = await fetch(`${baseUrl}${endpoint}`, {
    timeout: options.timeout || 5000,
    ...options,
  });
  return res;
}

ipcMain.handle('a1111:ping', async () => {
  try {
    const res = await a1111Fetch('/sdapi/v1/samplers', { timeout: 3000 });
    return { online: res.ok };
  } catch (e) {
    return { online: false, error: e.message };
  }
});

ipcMain.handle('a1111:getModels', async () => {
  try {
    const res = await a1111Fetch('/sdapi/v1/sd-models', { timeout: 5000 });
    if (!res.ok) return { error: `HTTP ${res.status}`, models: [] };
    return { models: await res.json() };
  } catch (e) {
    return { error: e.message, models: [] };
  }
});

ipcMain.handle('a1111:setModel', async (_e, modelName) => {
  try {
    const res = await a1111Fetch('/sdapi/v1/options', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sd_model_checkpoint: modelName }),
      timeout: 60000, // model loading can be slow
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('a1111:getLoras', async () => {
  try {
    const res = await a1111Fetch('/sdapi/v1/loras', { timeout: 5000 });
    if (!res.ok) return { error: `HTTP ${res.status}`, loras: [] };
    return { loras: await res.json() };
  } catch (e) {
    return { error: e.message, loras: [] };
  }
});

ipcMain.handle('a1111:generate', async (_e, payload) => {
  try {
    const merged = { ...settings.imageParams, ...payload };
    const res    = await a1111Fetch('/sdapi/v1/txt2img', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(merged),
      timeout: 600000, // 10 min max
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { error: `A1111 HTTP ${res.status}: ${errText}` };
    }
    const data = await res.json();
    return { images: data.images, info: data.info };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('a1111:progress', async () => {
  try {
    const res  = await a1111Fetch('/sdapi/v1/progress', { timeout: 3000 });
    if (!res.ok) return { progress: 0 };
    const data = await res.json();
    return { progress: data.progress || 0, eta: data.eta_relative };
  } catch (_) {
    return { progress: 0 };
  }
});

ipcMain.handle('a1111:interrupt', async () => {
  try {
    const res = await a1111Fetch('/sdapi/v1/interrupt', { method: 'POST', timeout: 5000 });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('a1111:currentModel', async () => {
  try {
    const res  = await a1111Fetch('/sdapi/v1/options', { timeout: 5000 });
    if (!res.ok) return { model: null };
    const data = await res.json();
    return { model: data.sd_model_checkpoint ?? null };
  } catch (_) {
    return { model: null };
  }
});

// ── IPC: Groq Chat ────────────────────────────────────────────────────────────
async function groqChat(messages) {
  const fetch  = require('node-fetch');
  const apiKey = settings.openaiApiKey;
  const model  = settings.openaiModel;

  if (!apiKey) {
    return { error: 'No Groq API key set. Go to Settings and paste your key from console.groq.com' };
  }

  // Append JSON-enforcement to the system message
  const withEnforcement = messages.map((m, i) =>
    (i === 0 && m.role === 'system')
      ? { ...m, content: m.content + '\n\nABSOLUTE RULE: Output ONLY raw JSON. No markdown, no backticks, no explanation. Start with { and end with }.' }
      : m
  );

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages:   withEnforcement,
        temperature: 0.7,
        max_tokens:  2000,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg     = errData.error?.message || `Groq HTTP ${res.status}`;
      return { error: msg };
    }

    const data    = await res.json();
    let   content = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Strip accidental markdown fences
    content = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,          '')
      .trim();

    return { content, usage: data.usage, model: data.model };
  } catch (e) {
    return { error: e.message };
  }
}

ipcMain.handle('openai:chat',       (_e, messages) => groqChat(messages));
ipcMain.handle('openai:chatStream', (_e, messages) => groqChat(messages));
