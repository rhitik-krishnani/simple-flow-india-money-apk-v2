# Get the APK (GitHub only, OpenRouter AI) — POC

No server, no Android Studio. GitHub builds the APK for you.

## 1. Add your OpenRouter key
Repo > **Settings** > **Secrets and variables** > **Actions** > **Secrets** > **New repository secret**
- Name: `OPENROUTER_API_KEY`
- Value: your key (`sk-or-...`)

Optional: on the **Variables** tab add `AI_MODEL` to pick a specific model (for example `deepseek/deepseek-chat`).
Default is `openrouter/free`, which automatically uses an available free model.

## 2. Build
Repo > **Actions** > "Build Android APK" > **Run workflow** (it also runs on every push to `main`). About 5-8 minutes.

## 3. Install
Open the finished run > **Artifacts** > download `indian-money-code-debug-apk` > unzip > copy `app-debug.apk` to the phone > tap it > allow "Install unknown apps".

## What the AI does in the APK
| Feature | Where | Works with |
|---|---|---|
| AI chat | chat bubble (bottom right) | any question |
| Voice expense | Budget > mic button | phone's speech recognizer, then the AI |
| MF / portfolio statement import | Portfolio > import | PDF (incl. password-protected CAS), CSV, Excel. **Not photos** |

AI works in Guest Mode too; no sign-in needed.

## POC caveats
- The OpenRouter key is inside the APK. Anyone with the APK file could extract it. Keep the repo private and share the APK only with trusted people.
- Free models have daily request limits. If you hit them, add a few dollars of credit on OpenRouter or set `AI_MODEL` to a cheap paid model.
- Scanned (image-only) PDFs have no text to read, so the import will say so.
- This is a debug APK: fine for demos, not for the Play Store.
