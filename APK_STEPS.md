# Get the APK (GitHub only, DeepSeek AI) — POC

No server, no Android Studio. GitHub builds the APK for you.

## 1. Put the code on GitHub
1. Create a new **private** repository on github.com (e.g. `indian-money-code`). Don't add a README.
2. Upload the **contents of this `indian-money-code` folder** so that `package.json` and the `.github` folder sit at the top level of the repo
   (not inside a sub-folder, and not the .zip). Easiest: on the empty repo page click "uploading an existing file" and drag the folder contents in.
   Do **not** upload `node_modules` (it's huge and not needed).
   - Tip: the `.github` folder is hidden on some PCs. If drag-and-drop skips it, use Git instead:
     ```
     git init -b main
     git add .
     git commit -m "Initial commit"
     git remote add origin https://github.com/<you>/indian-money-code.git
     git push -u origin main
     ```

## 2. Add your DeepSeek key
Repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**
- Name: `DEEPSEEK_API_KEY`
- Value: your key (`sk-...`)

## 3. Build
Repo > **Actions** > "Build Android APK" > **Run workflow** (it also runs on every push to `main`).
Takes about 5-8 minutes.

## 4. Install
Open the finished run > **Artifacts** > download `indian-money-code-debug-apk` > unzip > copy `app-debug.apk` to the phone > tap it > allow "Install unknown apps".

## What the AI does in the APK
| Feature | Where | Works with |
|---|---|---|
| AI chat | chat bubble (bottom right) | any question |
| Voice expense | Budget > mic button | phone's speech recognizer (needs Google app / speech services), then DeepSeek |
| MF / portfolio statement import | Portfolio > import | PDF (incl. password-protected CAS), CSV, Excel. **Not photos** (DeepSeek is text-only) |

AI works in Guest Mode too; no sign-in needed.

## POC caveats
- The DeepSeek key is inside the APK. Anyone with the APK file could extract it. Share only with trusted people and keep a small balance on the DeepSeek account.
  Later fix: deploy a tiny proxy (e.g. Cloudflare Worker) that holds the key, set a repo **variable** `AI_PROXY_URL` to it and delete the secret. The app code already supports this.
- Scanned (image-only) PDFs have no text to read, so the import will say so.
- This is a debug APK: fine for demos, not for the Play Store.
