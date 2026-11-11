import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Transparent LocalStorage & SessionStorage Fail-Safe Polyfills for Iframe Sandbox environments
try {
  const testKey = "__sandbox_storage_test__";
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn("Native localStorage blocked or restricted. Polyfilling in-memory fallback.");
  const mockStore: Record<string, string> = {};
  const mockStorageObj = {
    getItem: (key: string): string | null => {
      return Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null;
    },
    setItem: (key: string, value: string): void => {
      mockStore[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete mockStore[key];
    },
    clear: (): void => {
      Object.keys(mockStore).forEach(key => delete mockStore[key]);
    },
    key: (index: number): string | null => {
      const keys = Object.keys(mockStore);
      return keys[index] || null;
    },
    get length(): number {
      return Object.keys(mockStore).length;
    }
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorageObj,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    try {
      Object.defineProperty(Window.prototype, 'localStorage', {
        get: () => mockStorageObj,
        configurable: true,
        enumerable: true
      });
    } catch (protoErr) {
      console.warn("Could not redefine window.localStorage directly or on Window.prototype:", protoErr);
    }
  }
}

try {
  const testKey = "__sandbox_storage_test__";
  window.sessionStorage.setItem(testKey, testKey);
  window.sessionStorage.removeItem(testKey);
} catch (e) {
  console.warn("Native sessionStorage blocked or restricted. Polyfilling in-memory fallback.");
  const mockStore: Record<string, string> = {};
  const mockStorageObj = {
    getItem: (key: string): string | null => {
      return Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null;
    },
    setItem: (key: string, value: string): void => {
      mockStore[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete mockStore[key];
    },
    clear: (): void => {
      Object.keys(mockStore).forEach(key => delete mockStore[key]);
    },
    key: (index: number): string | null => {
      const keys = Object.keys(mockStore);
      return keys[index] || null;
    },
    get length(): number {
      return Object.keys(mockStore).length;
    }
  };

  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorageObj,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    try {
      Object.defineProperty(Window.prototype, 'sessionStorage', {
        get: () => mockStorageObj,
        configurable: true,
        enumerable: true
      });
    } catch (protoErr) {
      console.warn("Could not redefine window.sessionStorage directly or on Window.prototype:", protoErr);
    }
  }
}

// Transparent IndexedDB Fail-Safe Polyfill for Iframe Sandbox environments
try {
  const testDB = window.indexedDB;
} catch (e) {
  console.warn("Native indexedDB blocked or restricted. Polyfilling with null fallback.");
  try {
    Object.defineProperty(window, 'indexedDB', {
      value: null,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    try {
      Object.defineProperty(Window.prototype, 'indexedDB', {
        get: () => null,
        configurable: true,
        enumerable: true
      });
    } catch (protoErr) {
      console.warn("Could not redefine window.indexedDB directly or on Window.prototype:", protoErr);
    }
  }
}

const mountApp = () => {
  const container = document.getElementById('root');
  if (!container) {
    console.warn("Root container not found yet. Retrying mount...");
    setTimeout(mountApp, 50);
    return;
  }
  
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("React application successfully mounted to DOM root");
  } catch (error) {
    console.error("Fatal error during React root rendering:", error);
  }
};

// Initiate mount safely
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

// Unregister any active Service Workers to bypass development caching issues and clear caches
try {
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        if (registration && typeof registration.unregister === 'function') {
          registration.unregister().then((success) => {
            if (success) {
              console.log('Successfully unregistered service worker for fresh application load');
            }
          }).catch(err => console.warn('Service worker unregister failed:', err));
        }
      }
    }).catch(err => {
      console.warn('SW unregistration failed: ', err);
    });
  }
} catch (e) {
  console.warn('Service worker access blocked or unsupported in this environment:', e);
}

try {
  if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
    window.caches.keys().then((keys) => {
      keys.forEach((key) => {
        window.caches.delete(key).catch(err => console.warn('Cache key deletion failed:', err));
      });
    }).catch(err => {
      console.warn('Cache clearing failed: ', err);
    });
  }
} catch (e) {
  console.warn('Caches access blocked or unsupported in this environment:', e);
}

