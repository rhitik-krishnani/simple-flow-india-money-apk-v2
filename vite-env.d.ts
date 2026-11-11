interface ImportMetaEnv {
    /** Public address of the old Gemini backend (no longer used by the AI features). */
    readonly VITE_API_BASE_URL?: string;
    /** DeepSeek API key baked into the build (POC only: it can be extracted from the APK). */
    readonly VITE_DEEPSEEK_API_KEY?: string;
    /** Optional proxy that holds the key; when set, no key is sent from the app. */
    readonly VITE_AI_PROXY_URL?: string;
    readonly VITE_DEEPSEEK_MODEL?: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
declare module '*?url' {
    const src: string;
    export default src;
}
