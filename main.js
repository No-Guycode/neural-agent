const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  openaiApiKey: '',
  openaiModel: 'llama-3.3-70b-versatile',
  systemPrompt: `You are AXIOM — a sharp, no-bullshit AI agent with a dark sense of humor. You're highly capable and you know it, but you're not insufferable about it. You speak directly, use short punchy sentences, and occasionally swear when it feels right. You give unsolicited opinions when you have something worth saying. You can be sarcastic — especially when the request is vague, obvious, or mildly stupid — but you always deliver the goods regardless.

You have two modes:
1. TEXT — answer the user's question or task. Be direct. No filler, no "Great question!", no corporate-speak. Just the answer, maybe a dry comment if warranted.
2. IMAGE — generate an image using the Stable Diffusion pipeline.

ROUTING RULES:
- If the user wants an image (draw, generate, make, create, show, paint, sketch, render, visualize, illustrate, design — or anything that implies a visual output), route to image mode.
- Everything else is text mode.
- When routing to image, one brief line acknowledging what you're doing is fine. No essays.

OUTPUT FORMAT — this is non-negotiable:
You must ALWAYS respond with raw JSON only. No markdown. No backticks. No prose outside the JSON. Start with { and end with }.

For text: {"type":"text","response":"<your response with personality>"}
For image: {"type":"image","imagePrompt":"<booru tags>","reason":"<one punchy line>","params":{"width":512,"height":768,"steps":35},"model":"<optional — only if user specifies a model by name>"}

The "model" field is OPTIONAL. Only set it if the user explicitly names a model. Use the exact baseName: "dark", "meinamix", "Realistic", "flat", "Pastel", "cetusMix", "hassakuSD15_v13", "anyniji", "sudachi". If omitted, the system picks automatically.

The imagePrompt must be booru-style comma-separated tags. No prose. Order: subject count, subject description, clothing, pose/action, setting, lighting, quality tags. Example: "1girl, silver hair, hair over one eye, laughing, ruffle blouse, pleated skirt, dancing, one foot raised, wildflower hill, cloudy sky, wind, masterpiece, best quality, very aesthetic".

The params object is OPTIONAL but you must use it when the user specifies or implies any of these. Include ONLY the ones relevant:
- "width" and "height" (integers) — if user says portrait use 512x768, landscape use 768x512, square use 512x512, HD use 768x768. If they say widescreen use 768x432.
- "steps" (integer) — if user specifies steps
- "cfg_scale" (number) — if user mentions CFG or guidance scale
- "sampler_name" (string) — if user mentions a sampler. Valid values: "DPM++ 2M Karras", "DPM++ SDE Karras", "Euler a", "Euler", "DDIM", "UniPC"
- "seed" (integer) — if user gives a seed. -1 means random.
- "enable_hr" (boolean) — if user says hires fix on or off
- "hr_upscaler" (string) — if user specifies upscaler. Anime: use "R-ESRGAN 4x+ Anime6B". Realistic: use "R-ESRGAN 4x+". Default: "Lanczos".
- "hr_second_pass_steps" (integer) — hires steps
- "denoising_strength" (number) — denoising for hires
- "hr_scale" (number) — upscale factor
- "model" (string) — if the user names a specific model, put the base name here exactly as it appears in the models directory. Examples: "meinamix", "dark", "Realistic", "Pastel", "flat", "sudachi", "hassakuSD15_v13", "cetusMix", "anyniji". Only set this if the user explicitly asks for a specific model by name. If they don't, omit it and let the system pick.
- "sampler_name" (string) — the sampler to use. Valid values: "DPM++ 2M Karras", "DPM++ SDE Karras", "DPM++ 2M SDE", "DPM++ 2M SDE Heun", "Euler a", "Euler", "DDIM", "UniPC", "LCM", "Heun", "DPM2", "DPM fast". If the user says "Euler" use "Euler", if they say "Euler a" use "Euler a", etc. Match exactly.

- "model" (string) — if the user specifies a model by name, include the base name here (without .safetensors). Example: "dark", "meinamix", "Realistic", "Pastel". If the user does not specify a model, omit this field entirely and the system will auto-select.

You can also specify which model to use with the "model" field. This is OPTIONAL — only include it if the user explicitly asks for a specific model by name, or if context strongly implies one.

Available models and their short names (use the baseName exactly):
- meinamix — semi-realistic anime, detailed characters, fantasy
- dark — dark sushi mix, moody cinematic, night scenes, neon
- Pastel — meina pastel, soft dreamy ethereal watercolor
- flat — flat 2D cel-shaded cartoon
- cetusMix — painterly anime backgrounds
- anyniji — vivid niji-style colorful anime
- hassakuSD15_v13 — bright clean general anime
- Realistic — photorealistic photos
- sudachi — high quality flat 2D illustration

If user says "use [model name]" or "with [model]" or "switch to [model]" → include "model": "<baseName>" in your JSON.
If no model is specified → omit the model field entirely and let the AI picker decide.

CRITICAL RULE — DO NOT change any params unless the user EXPLICITLY specifies them. If the user says "draw me a portrait" — do NOT change width/height/steps/sampler/anything. Leave params empty {}. Only add a param if the user directly states it. Examples:
- "draw me a portrait" → params:{} — NO resolution change, nothing
- "draw me a portrait in 512x768" → params:{"width":512,"height":768}
- "generate with 40 steps" → params:{"steps":40}
- "use Euler a sampler" → params:{"sampler_name":"Euler a"}
- "use Dark Sushi model" → model:"dark"
- "no hires fix" → params:{"enable_hr":false}
- "use seed 12345" → params:{"seed":12345}
Only set params the user explicitly asked for. Nothing else. Ever.

You also have a "model" field you can set when the user specifies a model by name. Match loosely — if they say "dark sushi" match it to "dark", if they say "realistic" match to "Realistic", etc.

Examples:
- User says "make it a portrait" → params: {"width":512,"height":768}
- User says "landscape, 40 steps, euler a" → params: {"width":768,"height":512,"steps":40,"sampler_name":"Euler a"}
- User says "use seed 12345" → params: {"seed":12345}
- User says "turn off hires fix" → params: {"enable_hr":false}
- User says "use dark sushi" → model: "dark"
- User says "generate with realistic model, portrait, euler" → model: "Realistic", params: {"width":512,"height":768,"sampler_name":"Euler"}
- User says "use Anime6B upscaler" → params: {"hr_upscaler":"R-ESRGAN 4x+ Anime6B"}

Full image JSON with model and params example:
{"type":"image","imagePrompt":"1girl, ...","reason":"portrait incoming","model":"dark","params":{"width":512,"height":768,"steps":35,"sampler_name":"DPM++ SDE Karras"}}
- User says "use Euler a" → params: {"sampler_name":"Euler a"}
- User says "use Dark Sushi" → model: "dark"
- User says "generate with MeinaMix" → model: "meinamix"

You can also specify a model directly using the "model" field (the base filename without .safetensors, case-insensitive). Only use this if the user explicitly asks for a specific model. Otherwise omit it and let the system pick automatically.
Image JSON with model override: {"type":"image","imagePrompt":"...","reason":"...","model":"dark","params":{...}}
- User says "high res widescreen" → params: {"width":768,"height":432,"enable_hr":true}

Don't be lazy with params — if the user implies a format, infer it.`,
  a1111Url: 'http://127.0.0.1:7860',
  webuiBat: 'F:/AI/A1111/stable-diffusion-webui-amdgpu/webui-user.bat',
  autoLaunchWebui: true,
  modelsDir: 'F:/AI/A1111/stable-diffusion-webui-amdgpu/models/Stable-diffusion',
  outputDir: 'F:/AI/OwnAI/generated',
  encryptionEnabled: true,
  encryptionKeyFile: 'F:/AI/OwnAI/generated/.encryption_key',
  imageParams: {
    width: 512,
    height: 512,
    steps: 30,
    cfg_scale: 7,
    sampler_name: 'DPM++ 2M Karras',
    enable_hr: true,
    hr_upscaler: 'Lanczos',
    hr_second_pass_steps: 15,
    denoising_strength: 0.45,
    hr_scale: 2
  }
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return deepMerge(DEFAULT_SETTINGS, JSON.parse(raw));
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf8');
}

function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key in overrides) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = deepMerge(defaults[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

let mainWindow;
let settings = loadSettings();
let webuiProcess = null;

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile('loading.html');
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Kill webui process when app closes
  if (webuiProcess) {
    try {
      // On Windows, need to kill the whole process tree
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${webuiProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch (e) { /* ignore */ }
    webuiProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Window Controls ───────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window:close',    () => mainWindow.close());

// ── Settings ──────────────────────────────────────────────────────────────────
ipcMain.handle('settings:get',  () => settings);
ipcMain.handle('settings:save', (_e, newSettings) => {
  settings = deepMerge(DEFAULT_SETTINGS, newSettings);
  saveSettings(settings);
  return { ok: true };
});

// ── WebUI Launch ──────────────────────────────────────────────────────────────
ipcMain.handle('webui:launch', async () => {
  const batPath = settings.webuiBat;

  if (!batPath || !fs.existsSync(batPath.replace(/\//g, '\\'))) {
    return { error: `webui-user.bat not found at: ${batPath}` };
  }

  if (webuiProcess) {
    return { error: 'WebUI is already running.' };
  }

  try {
    const batNorm = batPath.replace(/\//g, '\\');
    const workDir = path.dirname(batNorm);

    // Spawn cmd.exe running the bat file, capture stdout/stderr
    webuiProcess = spawn('cmd.exe', ['/c', batNorm], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, // No console window popup
    });

    webuiProcess.stdout.setEncoding('utf8');
    webuiProcess.stderr.setEncoding('utf8');

    // Stream every line to renderer for the live log
    const sendLog = (line) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webui:log', line.trim());
      }
    };

    let buffer = '';
    const processChunk = (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer
      lines.forEach(line => {
        if (line.trim()) sendLog(line);

        // Detect successful startup
        if (line.includes('Running on local URL')) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webui:ready');
          }
        }

        // Detect fatal errors
        if (line.includes('Traceback') || line.includes('RuntimeError') || line.includes('Error:')) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webui:error', line.trim());
          }
        }
      });
    };

    webuiProcess.stdout.on('data', processChunk);
    webuiProcess.stderr.on('data', processChunk);

    webuiProcess.on('exit', (code) => {
      webuiProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webui:exited', code);
      }
    });

    return { ok: true, pid: webuiProcess.pid };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('webui:isRunning', () => ({ running: !!webuiProcess }));

ipcMain.handle('webui:kill', async () => {
  if (!webuiProcess) return { ok: true };
  try {
    const { execSync } = require('child_process');
    execSync(`taskkill /pid ${webuiProcess.pid} /T /F`, { stdio: 'ignore' });
    webuiProcess = null;
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

// ── Models scan ───────────────────────────────────────────────────────────────
ipcMain.handle('models:scan', async () => {
  const dir = settings.modelsDir;
  if (!fs.existsSync(dir)) return { error: `Models directory not found: ${dir}`, models: [] };
  const files = fs.readdirSync(dir);
  const models = files
    .filter(f => f.endsWith('.safetensors'))
    .map(filename => {
      const baseName = filename.replace('.safetensors', '');
      const txtPath  = path.join(dir, baseName + '.txt');
      const hasNotes = fs.existsSync(txtPath);
      const notes    = hasNotes ? fs.readFileSync(txtPath, 'utf8') : null;
      return { filename, baseName, hasNotes, notes };
    })
    .filter(m => m.hasNotes);
  return { models, dir };
});

// ── Encryption ────────────────────────────────────────────────────────────────
ipcMain.handle('encryption:loadKey', async () => {
  const keyFile = settings.encryptionKeyFile;
  if (!fs.existsSync(keyFile)) return { key: null, error: 'Key file not found' };
  try { return { key: fs.readFileSync(keyFile).toString().trim() }; }
  catch (e) { return { key: null, error: e.message }; }
});

ipcMain.handle('encryption:generateKey', async () => {
  const keyFile = settings.encryptionKeyFile;
  const dir = path.dirname(keyFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const key = crypto.randomBytes(32).toString('base64url').slice(0, 44) + '=';
  fs.writeFileSync(keyFile, key);
  return { key };
});

// ── Gallery ───────────────────────────────────────────────────────────────────
ipcMain.handle('gallery:list', async () => {
  const dir = settings.outputDir;
  if (!fs.existsSync(dir)) return { files: [] };
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.encrypted'))
    .map(f => ({ name: f, path: path.join(dir, f) }));
  return { files };
});

ipcMain.handle('gallery:readEncrypted', async (_e, filePath) => {
  try { return { data: fs.readFileSync(filePath).toString('base64') }; }
  catch (e) { return { error: e.message }; }
});

// ── Image save ────────────────────────────────────────────────────────────────
ipcMain.handle('image:save', async (_e, base64Data, filename) => {
  const dir = settings.outputDir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename || `generated_${Date.now()}.png`);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return { path: filePath };
});

ipcMain.handle('memory:clear', async () => ({ ok: true }));

// ── A1111 ─────────────────────────────────────────────────────────────────────
ipcMain.handle('a1111:ping', async () => {
  const fetch = require('node-fetch');
  try {
    const res = await fetch(`${settings.a1111Url}/sdapi/v1/samplers`, { timeout: 3000 });
    return { online: res.ok };
  } catch (e) { return { online: false, error: e.message }; }
});

ipcMain.handle('a1111:getModels', async () => {
  const fetch = require('node-fetch');
  try {
    const res = await fetch(`${settings.a1111Url}/sdapi/v1/sd-models`);
    if (!res.ok) return { error: `HTTP ${res.status}`, models: [] };
    return { models: await res.json() };
  } catch (e) { return { error: e.message, models: [] }; }
});

ipcMain.handle('a1111:setModel', async (_e, modelName) => {
  const fetch = require('node-fetch');
  try {
    const res = await fetch(`${settings.a1111Url}/sdapi/v1/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sd_model_checkpoint: modelName }),
      timeout: 30000,
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('a1111:getLoras', async () => {
  const fetch = require('node-fetch');
  try {
    const res = await fetch(`${settings.a1111Url}/sdapi/v1/loras`);
    if (!res.ok) return { error: `HTTP ${res.status}`, loras: [] };
    return { loras: await res.json() };
  } catch (e) { return { error: e.message, loras: [] }; }
});

ipcMain.handle('a1111:generate', async (_e, payload) => {
  const fetch = require('node-fetch');
  try {
    const res = await fetch(`${settings.a1111Url}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings.imageParams, ...payload }),
      timeout: 300000,
    });
    if (!res.ok) return { error: `A1111 HTTP ${res.status}: ${await res.text()}` };
    const data = await res.json();
    return { images: data.images, info: data.info, parameters: data.parameters };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('a1111:progress', async () => {
  const fetch = require('node-fetch');
  try {
    const res  = await fetch(`${settings.a1111Url}/sdapi/v1/progress`);
    if (!res.ok) return { progress: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { progress: data.progress, eta: data.eta_relative, state: data.state };
  } catch (e) { return { progress: 0, error: e.message }; }
});

// ── Groq Chat ─────────────────────────────────────────────────────────────────
async function groqChat(messages) {
  const fetch  = require('node-fetch');
  const apiKey = settings.openaiApiKey;
  const model  = settings.openaiModel;

  if (!apiKey) return { error: 'No Groq API key set. Go to Settings → paste your Groq key.' };

  const augmented = messages.map((m, i) =>
    (i === 0 && m.role === 'system')
      ? { ...m, content: m.content + '\n\nABSOLUTE RULE: Output ONLY raw JSON. No markdown, no backticks, no prose. Your response must start with { and end with }.' }
      : m
  );

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages: augmented, temperature: 0.7, max_tokens: 1500 }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.error?.message || `Groq HTTP ${res.status}` };
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return { content, usage: data.usage, model: data.model };
  } catch (e) {
    return { error: e.message };
  }
}

ipcMain.handle('openai:chat',       (_e, messages) => groqChat(messages));
ipcMain.handle('openai:chatStream', (_e, messages) => groqChat(messages));
