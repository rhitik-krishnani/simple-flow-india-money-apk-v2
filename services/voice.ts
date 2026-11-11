/**
 * Speech-to-text. Android app: the phone's built-in speech recognizer (Google dialog).
 * Browser: Web Speech API where available (Chrome). The text is then parsed by the AI model.
 */
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

let webRec: any = null;

export const listenOnce = async (lang: string = 'en-IN'): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
        const { available } = await SpeechRecognition.available();
        if (!available) throw new Error('Speech recognition is not available on this phone.');
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission was denied.');
        const { matches } = await SpeechRecognition.start({ language: lang, maxResults: 1, popup: true, partialResults: false, prompt: 'Say e.g. "Spent 500 rupees on dinner"' });
        return matches?.[0] || '';
    }

    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Rec) throw new Error('Voice entry is not supported in this browser. Try Chrome or the Android app.');
    return new Promise((resolve, reject) => {
        webRec = new Rec();
        webRec.lang = lang;
        webRec.interimResults = false;
        webRec.maxAlternatives = 1;
        let text = '';
        webRec.onresult = (e: any) => { text = e.results?.[0]?.[0]?.transcript || ''; };
        webRec.onerror = (e: any) => reject(new Error(e?.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not hear you. Please try again.'));
        webRec.onend = () => { webRec = null; resolve(text); };
        webRec.start();
    });
};

export const stopListening = async () => {
    try {
        if (Capacitor.isNativePlatform()) await SpeechRecognition.stop();
        else webRec?.stop();
    } catch { /* already stopped */ }
};
