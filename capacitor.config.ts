import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.indianmoneycode.app',
  appName: 'Indian Money Code',
  webDir: 'dist',
  server: {
    // The app is served from https://localhost inside the APK. The backend must allow this origin (it does by default).
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
