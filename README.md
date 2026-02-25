<div align="center">

<br/>

```
 █████╗ ██╗  ██╗██╗ ██████╗ ███╗   ███╗
██╔══██╗╚██╗██╔╝██║██╔═══██╗████╗ ████║
███████║ ╚███╔╝ ██║██║   ██║██╔████╔██║
██╔══██║ ██╔██╗ ██║██║   ██║██║╚██╔╝██║
██║  ██║██╔╝ ██╗██║╚██████╔╝██║ ╚═╝ ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝     ╚═╝
```

**A sharp AI agent for your desktop. Talk to it. It figures out the rest.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)](https://electronjs.org)
[![Groq](https://img.shields.io/badge/LLM-Groq%20%28free%29-F55036)](https://console.groq.com)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js)](https://nodejs.org)

<br/>

</div>

---

AXIOM is a desktop AI agent that routes your requests automatically — you talk, it decides whether to answer in text or generate an image. It selects the right Stable Diffusion model on its own, writes a proper booru-tag prompt, and fires it at A1111 — all without you touching a single setting per generation.

It runs on **Groq** (free, no credit card, no expiring credits) for the LLM and your local **A1111 WebUI** for image generation. It has an opinion. It will tell you when your prompt is vague. It occasionally swears.

<br/>

## Screenshots

> *(Add your own — the app is dark, minimal, and looks good in screenshots)*

<br/>

## Features

- **Automatic routing** — says what you want, AXIOM decides text or image
- **Smart model selection** — reads your `.txt` notes files, picks the right `.safetensors` for the prompt
- **Booru-tag prompt engine** — converts natural language to ordered danbooru-style tags per model
- **Explicit param control** — tell it to use specific resolution, steps, sampler, seed, upscaler, hires settings
- **LoRA support** — optional LoRA dialog before each generation with tag + trigger word input
- **Live generation progress** — real-time progress bar with ETA while A1111 generates
- **Params panel** — click ⚙ under any image to see the full positive prompt, negative prompt, and every parameter used
- **Auto-launches A1111** — cinematic boot screen streams the WebUI log live, enters the app once ready
- **Output gallery** — browse generated images, open output folder directly
- **Context memory** — full conversation history sent with each request
- **Persistent settings** — everything saves across sessions
- **Single instance** — won't open two windows by accident

<br/>

## Stack

| | |
|---|---|
| **Shell** | Electron 28 (frameless, dark) |
| **LLM** | [Groq API](https://console.groq.com) — Llama 3.3 70B Versatile (free tier) |
| **Image generation** | Stable Diffusion via [A1111 WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) REST API |
| **GPU** | AMD (DirectML) — also works on NVIDIA |

<br/>

## Requirements

- **Windows 10/11** (primary target — Linux/macOS untested)
- **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
- **A1111 WebUI** with `--api` flag in `COMMANDLINE_ARGS`
- **Free Groq API key** — [console.groq.com](https://console.groq.com)
- At least one `.safetensors` model with a matching `.txt` notes file (see [Model Notes](#model-notes))

<br/>

## Quick Start

```bash
# 1. Clone
git clone https://github.com/yourusername/axiom-neural-agent
cd axiom-neural-agent

# 2. Install
npm install

# 3. Run
npm start
```

On first launch, hit **Skip** on the boot screen, go to **Settings**, and fill in:
- Your Groq API key (from [console.groq.com](https://console.groq.com))
- Path to your `webui-user.bat`
- Path to your models directory
- Path to your output directory

Save, restart. Done.

<br/>

## A1111 Setup

Add `--api` to your `webui-user.bat`:

```bat
set COMMANDLINE_ARGS=--api
```

For AMD GPUs (DirectML):
```bat
set COMMANDLINE_ARGS=--opt-sub-quad-attention --disable-nan-check --use-directml --lowvram --api
```

For NVIDIA:
```bat
set COMMANDLINE_ARGS=--xformers --api
```

AXIOM spawns A1111 automatically on startup — you don't need to start it manually.

<br/>

## Model Notes

AXIOM only sees models that have a matching `.txt` notes file. The notes tell it what each model is good at so it can pick intelligently.

```
models/Stable-diffusion/
  meinamix.safetensors
  meinamix.txt          ← required
  dark.safetensors
  dark.txt              ← required
```

**Example notes file (`meinamix.txt`):**
```
Model name: MeinaMix
Type: Anime / semi-realistic
Best for: detailed anime characters, fantasy scenes, cinematic compositions
Recommended CFG: 6-8
Recommended sampler: DPM++ 2M Karras
Trigger words: masterpiece, best quality, ultra-detailed
Negative: (worst quality, low quality:1.4), zombie, interlocked fingers
```

The more descriptive the notes, the better AXIOM's model selection gets. Models without a `.txt` are invisible to AXIOM.

Pre-written notes for 9 popular models are included in the [`model-notes/`](model-notes/) folder.

<br/>

## Controlling Generation

AXIOM uses your Settings defaults unless you explicitly tell it otherwise.

| You say | What happens |
|---|---|
| `draw me an anime girl` | Uses default params from Settings |
| `draw me a portrait at 512x768` | Overrides width + height only |
| `generate with 40 steps, Euler a` | Overrides steps + sampler only |
| `use dark sushi model` | Skips AI selection, loads `dark` directly |
| `seed 12345` | Uses that seed |
| `no hires fix` | Disables hires upscale |
| `use R-ESRGAN 4x+ Anime6B` | Overrides upscaler only |

Everything not explicitly specified stays at your Settings defaults. AXIOM does not infer or assume params from context.

**Supported params via chat:**

| Param | Description |
|---|---|
| `width` / `height` | Resolution in pixels |
| `steps` | Sampling steps (20–60) |
| `cfg_scale` | Prompt adherence (4–12) |
| `sampler_name` | DPM++ 2M Karras, Euler a, DDIM, etc. |
| `seed` | Specific seed, or -1 for random |
| `enable_hr` | Hires fix on/off |
| `hr_upscaler` | Lanczos, R-ESRGAN 4x+, R-ESRGAN 4x+ Anime6B, etc. |
| `hr_scale` | Upscale factor (1.5–4) |
| `hr_second_pass_steps` | Hires pass steps |
| `denoising_strength` | Hires denoising (0.3–0.7) |

<br/>

## Project Structure

```
axiom-neural-agent/
├── main.js          — Main process: IPC, settings, WebUI spawning, all API calls
├── preload.js       — Secure context bridge (main ↔ renderer)
├── loading.html     — Boot screen: launches WebUI, streams log, polls for ready
├── index.html       — Main UI: chat, settings, gallery, image viewer
├── renderer.js      — All agent logic: routing, model selection, generation pipeline
├── package.json
├── .gitignore
├── README.md
├── SETUP_GUIDE.md
└── model-notes/     — Copy these .txt files next to your .safetensors
    ├── anyniji.txt
    ├── cetusMix.txt
    ├── dark.txt
    ├── flat.txt
    ├── hassakuSD15_v13.txt
    ├── meinamix.txt
    ├── Pastel.txt
    ├── Realistic.txt
    └── sudachi.txt
```

<br/>

## Generation Pipeline

```
You type a message
      │
      ▼
Groq / Llama 3.3 70B decides: text or image?
      │
      ├─── TEXT ──► Answer displayed in chat
      │
      └─── IMAGE
              │
              ▼
        Scan models dir for .safetensors + .txt pairs
              │
              ▼
        AI picks best model based on notes + prompt
        (or uses model you specified directly)
              │
              ▼
        Load model in A1111 via /sdapi/v1/options
              │
              ▼
        LoRA dialog — add tag + trigger words, or skip
              │
              ▼
        AI refines prompt into booru tags using model notes
              │
              ▼
        POST to A1111 /sdapi/v1/txt2img
              │
              ▼
        Live progress bar (polls /sdapi/v1/progress)
              │
              ▼
        Image displayed in chat + saved to output dir
        Click ⚙ to see full params used
```

<br/>

## Troubleshooting

| Problem | Fix |
|---|---|
| A1111 shows Offline | Make sure `--api` is in `COMMANDLINE_ARGS` and A1111 has fully loaded |
| `unrecognized arguments: --no-browser` | Your A1111 fork doesn't support it — remove it |
| FastAPI middleware crash | `venv\Scripts\pip.exe install fastapi==0.100.0 starlette==0.27.0` |
| Git dubious ownership error | `git config --global --add safe.directory *` |
| No models found | Create `.txt` notes files next to each `.safetensors` |
| Black images | Add `--no-half-vae` to A1111 `COMMANDLINE_ARGS` |
| Groq API error | Check key at [console.groq.com](https://console.groq.com) — free tier is 14,400 req/day |
| Boot screen stuck | Click **Skip** and check A1111's console window for errors |

<br/>

## Development

```bash
npm run dev    # Opens with DevTools console
```

The Groq API key never touches the renderer process — all API calls happen in `main.js` behind the IPC bridge.

<br/>

## License

MIT — do whatever you want with it.

<br/>

---

<div align="center">
<sub>Built with Electron · Groq · Stable Diffusion · A1111</sub>
</div>
