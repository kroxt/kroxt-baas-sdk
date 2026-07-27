import { StorageAdapter } from "../types";

/**
 * Transient in-memory storage adapter for server (Node.js) runtimes.
 */
export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }
}

/**
 * Persistent localStorage storage adapter for web/browser runtimes.
 */
export class BrowserStorage implements StorageAdapter {
  public getItem(key: string): string | null {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  }

  public setItem(key: string, value: string): void {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  }

  public removeItem(key: string): void {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
}

/**
 * Detects the runtime environment and returns the best storage adapter.
 */
export function getStorageAdapter(customStorage?: StorageAdapter): StorageAdapter {
  if (customStorage) {
    return customStorage;
  }

  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return new BrowserStorage();
  }

  return new MemoryStorage();
}
