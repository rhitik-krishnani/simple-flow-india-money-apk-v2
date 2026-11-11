# Making the AI features work in the Android app

The app itself runs on the phone. Five features need your backend (`server.ts`), because the Gemini key must stay on a server:
voice expense entry, bank statement import, mutual fund statement import, PDF statement parsing and the AI chat.
Everything else (audits, calculators, SMS parsing) works with no server.

## 1. Deploy the backend
Any host that runs Node or Docker works (Google Cloud Run, Render, Railway, a VPS). With Docker:

    docker build -t imc-backend .
    docker run -p 8080:8080 --env-file .env imc-backend

Set these environment variables on the host (see `.env.example`):

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Gemini key (never put it in the app) |
| `FIREBASE_PROJECT_ID` | Lets the server verify your users' login tokens |
| `ALLOWED_ORIGINS` | Only if you also host the web app on another domain |
| `ADMIN_EMAILS` | Optional. Enables the internal video studio for these emails |

Check it is up: `https://YOUR-BACKEND/api/health` should return `{"ok":true,"ai":true}`. If `ai` is `false`, a key or project id is missing.

## 2. Build the app pointing at the backend

    VITE_API_BASE_URL=https://YOUR-BACKEND npm run android:build
    cd android && ./gradlew assembleDebug

`VITE_API_BASE_URL` is baked in at build time. Without it the app shows "AI is not available in this build yet".

## 3. What users will see
- Signed in: AI works (limited to 10 requests a minute and 100 a day per user by default).
- Guest Mode: AI features show "Sign in to use AI features" (guests have no login token, which keeps your Gemini bill safe).
- Offline or server down: a short message, and everything non-AI keeps working.

## Notes
- Rate limits are kept in memory. If you run several server instances, move them to a shared store such as Redis.
- Voice entry asks for the microphone permission the first time it is used.
- Deploy `firestore.rules` too (`firebase deploy --only firestore:rules`).

---

# Building the APK

## Option A: in the cloud (no Android Studio)
1. Put this project on GitHub.
2. Repo > Settings > Secrets and variables > Actions > Variables > add `API_BASE_URL` = your deployed backend (for example `https://api.yourdomain.com`).
3. Repo > Actions > "Build Android APK" > Run workflow.
4. When it finishes (about 5 to 8 minutes), download `indian-money-code-debug-apk` from the run page, unzip it and copy `app-debug.apk` to your phone.

## Option B: on your computer
Needs Node 22, Java 21 and the Android SDK (Android Studio installs the SDK).

    npm ci --legacy-peer-deps
    VITE_API_BASE_URL=https://YOUR-BACKEND npm run android:build
    cd android && ./gradlew assembleDebug

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Or run `npx cap open android` and use Build > Build APK(s) in Android Studio.

## Installing on a phone
Copy the APK over, tap it, and allow "Install unknown apps" when Android asks. This is a **debug** APK: fine for testing and sharing with friends, but not for the Play Store.

## Before publishing to Google Play
- Make a signed release bundle: Android Studio > Build > Generate Signed Bundle / APK > Android App Bundle. Keep the keystore file and its passwords safe. If you lose them you can never update the app.
- Replace the default app icon and splash screen (`android/app/src/main/res`). You can generate them from one image with `npx @capacitor/assets generate`.
- Google Play needs a privacy policy, the Data safety form, and in-app account deletion for apps with sign-up.
- The SMS auto-tracking is not wired to a real SMS permission yet, so leave it out of the store listing.
