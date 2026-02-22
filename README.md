# 🧠 Neural Agent

A sleek Electron-based AI agent that routes your prompts to either **text** (via OpenAI) or **image generation** (via A1111 WebUI), with deep integration for your custom Encrypted Gallery extension.

---

## ✨ Features

- **Intelligent routing** — GPT decides automatically whether you need text or an image
- **A1111 integration** — Scans your `.safetensors` models, reads `.txt` notes, AI-picks the best one
- **LoRA support** — Optional LoRA tag + trigger word dialog before each generation
- **Prompt refinement** — AI refines your prompt using model notes before sending to A1111
- **Hires. Fix** — Enabled by default (Lanczos, 15 steps, 2× scale)
- **Encrypted Gallery** — Reads your encrypted output directory, compatible with your A1111 extension
- **Context memory** — Full conversation history sent with each request
- **Persistent settings** — Saved to `%AppData%/neural-agent/settings.json`
- **Thought process display** — See every step the agent takes in real time
- **Progress bar** — Live A1111 generation progress with ETA

---

## 📁 Project Structure

```
neural-agent/
├── main.js          ← Electron main process (IPC, file system, API calls)
├── preload.js       ← Secure context bridge
├── index.html       ← UI shell + styles
├── renderer.js      ← UI logic, agent orchestration
├── package.json
└── README.md
```

---

## 🚀 Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Electron](https://www.electronjs.org/) (installed via npm)
- A1111 WebUI running locally (`http://127.0.0.1:7860` by default)
- OpenAI API key

### Install

```bash
cd neural-agent
npm install
npm start
```

---

## ⚙️ Settings

Open the app → **Settings panel** (right side)

| Setting | Description |
|---|---|
| **API Key** | Your OpenAI key (`sk-…`) |
| **Model** | GPT-4o, GPT-4 Turbo, o3, o4-mini, etc. |
| **System Prompt** | Controls how the LLM decides text vs. image |
| **A1111 URL** | Default: `http://127.0.0.1:7860` |
| **Models Dir** | `F:/AI/A1111/stable-diffusion-webui-amdgpu/models/Stable-diffusion` |
| **Output Dir** | Where images are saved (and encrypted gallery reads from) |
| **Encryption** | Toggle to match your A1111 extension setting |
| **Key File** | Path to `.encryption_key` used by your A1111 extension |

### Image Params (second tab)

| Param | Default |
|---|---|
| Resolution | 512×512 |
| Steps | 30 |
| CFG Scale | 7 |
| Sampler | DPM++ 2M Karras |
| Hires. Fix | ✅ On |
| Upscaler | Lanczos |
| Hires Steps | 15 |
| Denoising | 0.45 |
| HR Scale | 2× |

---

## 🤖 How It Works

```
User prompt
    │
    ▼
OpenAI LLM (with system prompt + memory context)
    │
    ├─ type: "text"  → Response displayed in chat
    │
    └─ type: "image" → imagePrompt extracted
           │
           ▼
       Scan models dir for .safetensors + .txt pairs
           │
           ▼
       OpenAI picks best model based on notes + prompt
           │
           ▼
       Load model in A1111 (via /sdapi/v1/options)
           │
           ▼
       Show LoRA dialog (tag + trigger words, optional)
           │
           ▼
       OpenAI refines prompt using model notes
           │
           ▼
       POST /sdapi/v1/txt2img with full params
           │
           ▼
       Live progress bar (polls /sdapi/v1/progress)
           │
           ▼
       Image displayed + saved to output dir
```

---

## 🔒 Encrypted Gallery Integration

The app is designed to work alongside your `encrypted_gallery` A1111 extension:

- The **Output Dir** setting should match `CONFIG["custom_output_dir"]` in your extension
- The **Key File** setting should match `CONFIG["key_file"]`
- The Gallery view in the app shows all `.encrypted` files in the output dir
- Actual decryption/viewing of gallery images still happens in A1111's WebUI (the extension handles Fernet decryption)
- Generated images from the agent go to the same folder, where A1111 auto-encrypts them on save via the extension hook

---

## 📂 Model Notes Format

For the AI model selector to work, each `.safetensors` model needs a matching `.txt` file in the same directory:

```
F:/AI/OwnAI/models/
  meinamix.safetensors
  meinamix.txt          ← Model notes
  realisticVision.safetensors
  realisticVision.txt
```

**Example `meinamix.txt`:**
```
MeinaMix v12 - Anime/semi-realistic hybrid
Best for: anime characters, stylized portraits, fantasy scenes
Recommended CFG: 6-8
Recommended steps: 25-35
Trigger words: (masterpiece), best quality, ultra detailed
Negative: (worst quality:1.4), bad anatomy, watermark
Notes: Works well with Euler a sampler. Good LoRA compatibility.
```

Models without a `.txt` file are **ignored** by the agent.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| A1111 shows Offline | Start WebUI with `--api` flag: `python launch.py --api` |
| Model not found in A1111 | Ensure the model filename in your models dir matches what A1111 sees |
| OpenAI error: no key | Add API key in Settings |
| Generation fails | Check A1111 console for errors; try simpler prompt |
| Images not encrypting | Your A1111 extension handles this — make sure it's active |
| Fonts not loading | App requires internet connection on first launch for Google Fonts |

---

## 🛠 Development

```bash
npm run dev    # Opens with DevTools
```

All OpenAI API calls happen in `main.js` (secure, key never exposed to renderer).

---

## 📜 License

MIT
