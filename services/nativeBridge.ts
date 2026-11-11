import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { parseSmsLocal, looksLikeTransactionSms } from './ruleEngine';
import { Transaction } from '../types';
import { safeStorage } from './storage';

export const getDeviceInfo = async () => {
    const info = await Device.getInfo();
    return info;
};

export const triggerHaptic = async () => {
    await Haptics.impact({ style: ImpactStyle.Light });
};

interface SmsListener {
    onTransaction: (t: Partial<Transaction>) => void;
}

let activeSmsListener: SmsListener | null = null;
let isListening = false;

/**
 * Quick on-device check: true only for real debit/credit transaction SMS.
 * OTPs, promos and chats are rejected here, and nothing is sent to any server.
 */
export const isFinancialSms = (text: string): boolean => looksLikeTransactionSms(text);

/** Short non-reversible fingerprint so we never store raw SMS text (balances, account numbers). */
const fingerprint = (text: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36) + ':' + text.length;
};

/**
 * Mobile Bridge Strategy:
 * This function is called by the Android/iOS Native side 
 * when an SMS is intercepted.
 */
export const handleIncomingSms = async (body: string) => {
    console.log("Native Bridge: SMS Intercepted, analyzing...");
    if (!activeSmsListener) {
        console.warn("No active SMS listener registered in UI. SMS ignored.");
        return;
    }

    // Check if we've already seen/processed this specific message body
    const fp = fingerprint(body);
    let seenMessages: string[] = [];
    try { seenMessages = JSON.parse(safeStorage.getItem('sms_seen_messages') || '[]'); } catch { seenMessages = []; }
    if (seenMessages.includes(fp)) {
        console.log("Native Bridge: SMS already processed, skipping.");
        return;
    }

    try {
        // Parsed fully on-device. Returns null for OTPs, promos and non-transactions.
        const parsed = parseSmsLocal(body);
        if (parsed && parsed.amount) {
            console.log("Native Bridge: Valid transaction detected from SMS", parsed);
            
            // Mark as seen immediately so it doesn't re-trigger while processing
            const updatedSeen = [...seenMessages, fp].slice(-200); // Keep last 200 fingerprints
            safeStorage.setItem('sms_seen_messages', JSON.stringify(updatedSeen));

            activeSmsListener.onTransaction(parsed);
            await triggerHaptic();
            
            // Show a local notification for better UX
            const amountStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parsed.amount || 0);
            await scheduleLocalNotification(
                "Transaction Detected", 
                `Detected ${amountStr} at ${parsed.merchant || 'Merchant'}. Tap to review.`
            );
        }
    } catch (e) {
        console.error("Native Bridge: SMS Parsing error", e);
    }
};

export const registerSmsListener = (onTransaction: (t: Partial<Transaction>) => void) => {
    activeSmsListener = { onTransaction };
    console.log("Native Bridge: SMS Listener registered.");
};

export const startSmsBackgroundService = async (): Promise<boolean> => {
    if (isListening) return true;
    
    // In a real Android build, we would call a custom Capacitor plugin here
    // e.g. SmsReceiver.start()
    console.log("Native Bridge: Starting SMS Background Service (Mock)...");
    isListening = true;
    return true;
};

export const authenticateBiometrics = async () => {
    // In a real build, we'd use capacitor-native-biometric
    console.log("Biometric challenge triggered...");
    return true; 
};
import { LocalNotifications } from '@capacitor/local-notifications';

// Local notifications (no Firebase / FCM setup needed). On Android 13+ this triggers the system permission prompt.
export const requestNotificationPermission = async (): Promise<boolean> => {
    try {
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
            perm = await LocalNotifications.requestPermissions();
        }
        if (perm.display !== 'granted') {
            console.warn('Notification permission not granted');
            return false;
        }
        return true;
    } catch (e) {
        console.warn('Notifications are not available on this device', e);
        return false;
    }
};

export const scheduleLocalNotification = async (title: string, body: string): Promise<void> => {
    try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') return;
        await LocalNotifications.schedule({
            notifications: [{ id: Math.floor(Date.now() % 2147483647), title, body }]
        });
    } catch (e) {
        console.warn('Could not show notification', e);
    }
};
