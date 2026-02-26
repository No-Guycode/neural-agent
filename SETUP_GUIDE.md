# 🛠 Neural Agent — Windows Setup Guide (Step by Step)

---

## OVERVIEW

You'll be setting up 3 things:
1. **Node.js + npm** — to run Electron
2. **The Neural Agent app** — the files you downloaded
3. **A1111 with `--api` flag** — so the app can talk to it

Total time: ~10–15 minutes (not counting downloads)

---

## STEP 1 — Install Node.js

1. Go to: **https://nodejs.org**
2. Click **"LTS"** (the left green button — do NOT pick "Current")
3. Download the `.msi` installer and run it
4. Click **Next** through all screens, leave all defaults as-is
5. ✅ On the screen that says *"Tools for Native Modules"* — you can **leave it unchecked**
6. Click **Install**, then **Finish**

**Verify it worked — open a new Command Prompt (`Win + R` → type `cmd` → Enter):**

```
node --version
npm --version
```

You should see version numbers like `v20.x.x` and `10.x.x`. If you do, Node is installed.

---

## STEP 2 — Place the Project Files

1. Create a folder somewhere on your PC. For example:
   ```
   C:\Projects\neural-agent\
   ```
   *(You can put it anywhere — Desktop, D drive, wherever. Just remember the path.)*

2. Copy all 6 project files into that folder:
   ```
   neural-agent\
   ├── main.js
   ├── preload.js
   ├── index.html
   ├── renderer.js
   ├── package.json
   └── README.md
   ```

---

## STEP 3 — Open the Project in Command Prompt

1. Open **File Explorer** and navigate to your `neural-agent` folder
2. Click in the **address bar** at the top (where it shows the path)
3. Type `cmd` and press **Enter** — this opens Command Prompt directly in that folder
4. You should see something like:
   ```
   C:\Projects\neural-agent>
   ```

---

## STEP 4 — Install Dependencies

In that Command Prompt window, type this exactly and press Enter:

```
npm install
```

You'll see a lot of text scroll by — this is normal. It's downloading Electron and the other packages. This may take **2–5 minutes** depending on your internet speed.

When it finishes, you'll see your cursor back at the prompt. You should now have a `node_modules` folder in your project directory.

> **If you see errors in red:** The most common fix is to run Command Prompt as Administrator. Right-click the Start menu → "Terminal (Admin)" or "Command Prompt (Admin)", then navigate back to your folder with `cd C:\Projects\neural-agent` and try `npm install` again.

---

## STEP 5 — Add Your Model Notes Files

The app only uses models that have a matching `.txt` notes file. You need to create these manually.

1. Go to your models directory:
   ```
   F:\AI\A1111\stable-diffusion-webui-amdgpu\models\Stable-diffusion\
   ```

2. For **each** `.safetensors` model you want to use, create a `.txt` file with the **exact same name**. Examples:

   If you have `meinamix_v12.safetensors`, create `meinamix_v12.txt`

3. Inside each `.txt` file, write notes about the model. The AI reads these to decide which model fits your request. Here's a good template:

   ```
   Model name: MeinaMix v12
   Type: Anime / semi-realistic hybrid
   Best for: anime characters, stylized portraits, fantasy art, vibrant colors
   Recommended CFG scale: 6-8
   Recommended steps: 25-35
   Recommended sampler: DPM++ 2M Karras
   Trigger words: (masterpiece), best quality, ultra-detailed, 8k
   Negative prompt: (worst quality:1.4), (low quality:1.4), bad anatomy, watermark, blurry
   Notes: Excellent LoRA compatibility. Great for character art. Handles both male and female subjects well.
   ```

   Another example for a realistic model (`realisticVision.txt`):

   ```
   Model name: Realistic Vision v6
   Type: Photorealistic
   Best for: realistic portraits, photography, real-world scenes, nature, architecture
   Recommended CFG scale: 4-7
   Recommended steps: 30-40
   Recommended sampler: DPM++ SDE Karras
   Trigger words: RAW photo, realistic, 8k uhd, dslr, sharp focus
   Negative prompt: cartoon, anime, illustration, painting, drawing, worst quality
   Notes: Less LoRA compatible than anime models. Best with low CFG. Use hires fix for portraits.
   ```

   **The more descriptive you are, the smarter the model selection will be.**

> ⚠️ Models WITHOUT a matching `.txt` file are completely ignored by the app.

---

## STEP 6 — Set Up A1111 to Accept API Calls

Your A1111 WebUI needs to run with the `--api` flag enabled. Here's how:

1. Go to your A1111 folder:
   ```
   F:\AI\A1111\stable-diffusion-webui-amdgpu\
   ```

2. Find your launch script — it's usually one of these:
   - `webui-user.bat`
   - `run.bat`
   - `launch.py`

3. Open `webui-user.bat` in Notepad (right-click → Edit)

4. Find the line that says:
   ```
   set COMMANDLINE_ARGS=
   ```

5. Change it to add `--api`:
   ```
   set COMMANDLINE_ARGS=--api
   ```
   If it already has other flags, just add `--api` to the end:
   ```
   set COMMANDLINE_ARGS=--xformers --api
   ```

6. Save the file and **close Notepad**

7. Launch A1111 normally by double-clicking your launch script

8. Wait for A1111 to fully load (you'll see "Running on local URL: http://127.0.0.1:7860" in the console)

**Test that the API works** by opening this URL in your browser:
```
http://127.0.0.1:7860/sdapi/v1/samplers
```
If you see a page with JSON data (a list of samplers), the API is working. ✅

---

## STEP 7 — Get Your OpenAI API Key

1. Go to: **https://platform.openai.com/api-keys**
2. Sign in (or create an account)
3. Click **"Create new secret key"**
4. Give it a name like "Neural Agent"
5. **Copy the key immediately** — you won't be able to see it again
6. It starts with `sk-proj-…` or `sk-…`

> 💡 Make sure your OpenAI account has a payment method added and some credit — the API requires a paid account.

---

## STEP 8 — Launch the App

Back in your Command Prompt (in the `neural-agent` folder), type:

```
npm start
```

The Neural Agent window will open. You should see the dark interface with the NEURALAGENT logo.

---

## STEP 9 — Configure the App

Once the app is open:

1. Look at the **right panel** — it should be showing the Settings tab

2. Fill in:
   - **API Key:** Paste your OpenAI key (`sk-…`)
   - **Model:** Start with `GPT-4o` (best balance of speed and quality)
   - **A1111 URL:** `http://127.0.0.1:7860` (leave as-is unless you changed A1111's port)

3. Check the **Models Dir** is set to:
   ```
   F:/AI/A1111/stable-diffusion-webui-amdgpu/models/Stable-diffusion
   ```
   *(Use forward slashes `/` even on Windows)*

4. Click **"Ping A1111"** — you should see **"✓ Online"** in green. If you see "✗ Offline", A1111 is not running or the `--api` flag wasn't added.

5. Click **"Save Settings"** — you'll see a green toast notification

6. Switch to the **Image Params** tab and verify the defaults look right, then click **Save Params**

---

## STEP 10 — First Test

1. Make sure A1111 is running with a model already loaded
2. Type something into the chat, for example:
   ```
   Write me a haiku about rain
   ```
   → The LLM should respond with a text answer

3. Now try:
   ```
   Draw me a cyberpunk anime girl with neon lights
   ```
   → The LLM should detect this needs an image, scan your models, pick the best one, ask if you want a LoRA, then generate

---

## 🔁 Daily Workflow

Every time you want to use the app:

1. **Start A1111 first** (double-click your launch script, wait for it to load)
2. **Then run the app:** open Command Prompt in the `neural-agent` folder and type `npm start`

Or create a shortcut — see the tip below.

---

## 💡 Optional: Create a Desktop Shortcut

So you don't have to open Command Prompt every time:

1. Right-click on your Desktop → **New → Shortcut**
2. In the location field, type:
   ```
   cmd /k "cd /d C:\Projects\neural-agent && npm start"
   ```
   *(Replace `C:\Projects\neural-agent` with your actual path)*
3. Click **Next**, name it `Neural Agent`, click **Finish**
4. Now you can double-click that shortcut to launch the app

---

## ❌ Common Errors & Fixes

| Error | What it means | Fix |
|---|---|---|
| `'npm' is not recognized` | Node.js not installed or not in PATH | Reinstall Node.js LTS, restart your PC |
| `Error: Cannot find module 'electron'` | `npm install` wasn't run | Run `npm install` in the project folder |
| A1111 shows **Offline** | A1111 not running or no `--api` flag | Start A1111 with `--api` in `webui-user.bat` |
| `No models found` | No `.txt` files next to your models | Create `.txt` notes files for each model |
| `OpenAI error: 401` | Invalid API key | Double-check your key in Settings |
| `OpenAI error: 429` | Rate limit or no credits | Add payment method at platform.openai.com |
| App window is black | Electron loading issue | Wait 5 seconds, or try `npm start` again |
| Generation fails immediately | A1111 model not loaded | In A1111 WebUI, manually load a model first |

---

## 📌 Quick Reference Paths

| Item | Path |
|---|---|
| Models directory | `F:\AI\A1111\stable-diffusion-webui-amdgpu\models\Stable-diffusion\` |
| A1111 launch script | `F:\AI\A1111\stable-diffusion-webui-amdgpu\webui-user.bat` |
| Output / Gallery | `F:\AI\OwnAI\generated\` |
| Encryption key | `F:\AI\OwnAI\generated\.encryption_key` |
| App settings (auto-saved) | `%AppData%\neural-agent\settings.json` |
| App logs | Open app → `npm run dev` to see DevTools console |

---

You're all set. If something doesn't work, the most useful debugging tool is running `npm run dev` instead of `npm start` — it opens the browser DevTools where you can see all errors in the Console tab.
