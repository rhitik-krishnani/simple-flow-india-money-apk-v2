// Safe Storage helper for sandboxed iframes and privacy modes
const checkStorageAvailable = (): boolean => {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

const isAvailable = checkStorageAvailable();
const memCache: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (isAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // Fallback to memCache
      }
    }
    return Object.prototype.hasOwnProperty.call(memCache, key) ? memCache[key] : null;
  },

  setItem: (key: string, value: string): void => {
    if (isAvailable) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback to memCache
      }
    }
    memCache[key] = String(value);
  },

  removeItem: (key: string): void => {
    if (isAvailable) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback to memCache
      }
    }
    delete memCache[key];
  },

  clear: (): void => {
    if (isAvailable) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        // Fallback to memCache
      }
    }
    Object.keys(memCache).forEach((key) => delete memCache[key]);
  }
};
