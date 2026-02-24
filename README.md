# AXIOM — Neural Agent

A sharp, no-bullshit AI agent that lives on your desktop. Talk to it. It figures out whether you need a text answer or a generated image, picks the right model, refines the prompt into proper booru tags, and fires it at Stable Diffusion — all automatically.

Built with Electron + Groq (free) + A1111 WebUI backend.

---

## What it does

- **Routes automatically** — you just talk. AXIOM decides if you need text or an image.
- **Picks the best model** — scans your `.safetensors` files, reads their `.txt` notes, asks the LLM to choose the right one for your prompt.
- **Writes proper SD prompts** — converts your natural language into ordered booru-style tags automatically.
- **LoRA support** — optional LoRA tag + trigger words dialog before each generation.
- **Refines prompts per model** — uses each model's notes to tune the positive and negative prompts.
- **Live generation progress** — progress bar with ETA while A1111 generates.
- **Auto-launches WebUI** — cinematic boot screen streams A1111's log live, enters the app once it's ready.
- **Context memory** — full conversation history sent with each request, clearable anytime.
- **Encrypted gallery** — reads your output directory, compatible with the encrypted-gallery A1111 extension.
- **Persistent settings** — everything saves automatically across sessions.

---

## Stack

| Layer | What |
|---|---|
| Frontend | Electron (frameless, dark) |
| LLM | Groq API — Llama 3.3 70B Versatile (free) |
| Image gen | Stable Diffusion via A1111 WebUI REST API |
| GPU | AMD via DirectML (your setup) |
| Encryption | Compatible with your custom A1111 encrypted-gallery extension |

---

## Project structure

```
neural-agent/
├── main.js          — Electron main process. IPC, file system, API calls, WebUI spawning.
├── preload.js       — Secure context bridge between main and renderer.
├── loading.html     — Boot screen. Launches WebUI, streams log, waits for ready signal.
├── index.html       — Main app UI. Chat, settings, gallery, image viewer.
├── renderer.js      — All agent logic. Routing, model selection, generation pipeline.
├── package.json
├── SETUP_GUIDE.md
└── model-notes/     — Drop these .txt files next to your .safetensors models.
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

---

## Setup

See **SETUP_GUIDE.md** for the full step-by-step Windows walkthrough.

Short version:

```bash
# 1. Install Node.js LTS from nodejs.org

# 2. Drop all project files into a folder, e.g. D:\Projects\neural-agent\

# 3. Install dependencies
cd D:\Projects\neural-agent
npm install

# 4. Get a free Groq API key at console.groq.com
#    Paste it into Settings on first launch

# 5. Add --api and --nowebui to your A1111 webui-user.bat:
#    set COMMANDLINE_ARGS=--opt-sub-quad-attention --disable-nan-check --use-directml --lowvram --api --nowebui

# 6. Run
npm start
```

---

## Model notes

For AXIOM to use a model it needs a `.txt` notes file with the same name sitting next to the `.safetensors` in your models directory.

```
Stable-diffusion/
  meinamix.safetensors
  meinamix.txt          ← required
  dark.safetensors
  dark.txt              ← required
```

Models without a `.txt` are invisible to AXIOM. The notes tell the LLM what each model is good at so it can pick intelligently. Copy the files from the `model-notes/` folder in this repo into your models directory.

**Example notes file:**
```
Model name: Dark Sushi Mix 2.25D
Type: Anime / semi-realistic — dark, cinematic, moody
Best for: night scenes, dramatic lighting, neon, urban environments
Recommended CFG: 7-8
Recommended sampler: DPM++ SDE Karras
Trigger words: masterpiece, best quality, cinematic lighting, dramatic shadows
Negative: (worst quality:1.2), flat lighting, overexposed, watermark
```

---

## Settings reference

| Setting | Default | Notes |
|---|---|---|
| Groq API Key | — | From console.groq.com, free |
| Model | llama-3.3-70b-versatile | Best free model on Groq |
| Auto-launch WebUI | On | Spawns webui-user.bat on startup |
| WebUI .bat Path | — | Full path to your webui-user.bat |
| WebUI URL | http://127.0.0.1:7860 | Don't change unless you moved the port |
| Models Dir | F:/AI/A1111/.../Stable-diffusion | Where your .safetensors live |
| Output Dir | F:/AI/OwnAI/generated | Where generated images are saved |
| Encryption | On | Matches your A1111 extension setting |
| Key File | F:/AI/OwnAI/generated/.encryption_key | Shared with the A1111 extension |

**Image params (second tab):**

| Param | Default |
|---|---|
| Resolution | 512×512 |
| Steps | 30 |
| CFG Scale | 7 |
| Sampler | DPM++ 2M Karras |
| Hires. Fix | On |
| Upscaler | Lanczos |
| Hires Steps | 15 |
| Denoising | 0.45 |
| HR Scale | 2× |

---

## How generation works

```
You type a prompt
        │
        ▼
Groq/Llama decides: text or image?
        │
        ├── TEXT → answer displayed in chat
        │
        └── IMAGE
                │
                ▼
        Scan models dir for .safetensors + .txt pairs
                │
                ▼
        Groq picks the best model based on notes + your prompt
                │
                ▼
        Load model in A1111 via API
                │
                ▼
        LoRA dialog — add tag + trigger words, or skip
                │
                ▼
        Groq refines prompt into booru tags using model notes
        (subject → clothing → pose → setting → lighting → quality tags)
                │
                ▼
        POST to A1111 /sdapi/v1/txt2img
                │
                ▼
        Live progress bar (polls /sdapi/v1/progress every second)
                │
                ▼
        Image displayed in chat + saved to output dir
```

---

## AXIOM's personality

Sharp. Direct. No filler. Occasionally sarcastic. Swears when it feels right. Has opinions and shares them. Routes to image generation without fanfare — just one line and it's already working.

To change the personality, edit the System Prompt field in Settings.

---

## Known issues & fixes

| Issue | Fix |
|---|---|
| A1111 shows Offline | Make sure `--api` is in your COMMANDLINE_ARGS and A1111 has fully loaded |
| `unrecognized arguments: --no-browser` | Your AMD fork doesn't support it — use `--nowebui` instead |
| FastAPI middleware error | Run: `venv\Scripts\pip.exe install fastapi==0.100.0 starlette==0.27.0` |
| Git dubious ownership error | Run: `git config --global --add safe.directory *` |
| No models found | Create `.txt` notes files next to each `.safetensors` |
| Black images | Add `--no-half-vae` to your A1111 COMMANDLINE_ARGS |
| Generation very slow | Normal for AMD/DirectML — no fix, just patience |
| Groq API error | Check your key at console.groq.com — free tier has daily limits but they're generous |

---

## Development

```bash
npm run dev    # Opens with DevTools console visible
```

All Groq API calls happen in `main.js` — the API key never touches the renderer process.

---

## License

MIT. Do whatever you want with it.
