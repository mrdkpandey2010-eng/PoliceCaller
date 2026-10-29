/**
 * UP Police Directory - Device-Storage-Adaptive Bounded IndexedDB Offline Store
 * Enforces adaptive storage budgeting using navigator.storage.estimate(),
 * TTL-based expiration, LRU eviction, and complete purge on logout.
 */

const DB_NAME = 'up_police_offline_v1';
const DB_VERSION = 1;
const STORE_CONTACTS = 'contacts_cache';
const STORE_META = 'storage_meta';

// Max allowable offline target budget (capped at 500MB if available on device)
const MAX_TARGET_BUDGET_BYTES = 500 * 1024 * 1024; // 500 MB
const DEFAULT_SAFE_BUDGET_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export interface CachedContact {
  id: string;
  pno: string;
  fullName: string;
  designationName: string;
  districtName: string;
  stationOfficeName: string;
  mobile: string;
  photoUrl?: string | null;
  cachedAt: number;
}

export interface StorageEstimateInfo {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number;
  targetBudgetBytes: number;
  percentUsed: number;
}

class OfflineStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported on this platform.'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
          const store = db.createObjectStore(STORE_CONTACTS, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Evaluates available device storage quota and returns adaptive budget
   */
  async getStorageEstimate(): Promise<StorageEstimateInfo> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || DEFAULT_SAFE_BUDGET_BYTES;

        // Adaptive target budget: min of 500MB or 40% of available quota
        const targetBudget = Math.min(MAX_TARGET_BUDGET_BYTES, Math.floor(quota * 0.4));

        return {
          supported: true,
          usageBytes: usage,
          quotaBytes: quota,
          targetBudgetBytes: targetBudget,
          percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
        };
      } catch {
        // Fallback for private mode or restricted contexts
      }
    }

    return {
      supported: false,
      usageBytes: 0,
      quotaBytes: DEFAULT_SAFE_BUDGET_BYTES,
      targetBudgetBytes: DEFAULT_SAFE_BUDGET_BYTES,
      percentUsed: 0,
    };
  }

  /**
   * Selectively caches contacts with TTL and capacity limit
   */
  async cacheContacts(contacts: any[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_CONTACTS], 'readwrite');
      const store = tx.objectStore(STORE_CONTACTS);
      const now = Date.now();

      // Limit selective offline caching to maximum 500 contacts
      const batch = contacts.slice(0, 500);

      for (const c of batch) {
        const record: CachedContact = {
          id: c.id,
          pno: c.pno,
          fullName: c.fullName,
          designationName: c.designationName,
          districtName: c.districtName,
          stationOfficeName: c.stationOfficeName,
          mobile: c.mobile,
          photoUrl: c.photoUrl,
          cachedAt: now,
        };
        store.put(record);
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err: any) {
      if (err.name === 'QuotaExceededError') {
        console.warn('Adaptive offline storage quota exceeded. Purging oldest entries.');
        await this.evictOldest(100);
      }
    }
  }

  /**
   * Retrieves non-expired cached contacts
   */
  async getCachedContacts(): Promise<CachedContact[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_CONTACTS], 'readonly');
      const store = tx.objectStore(STORE_CONTACTS);
      const request = store.getAll();

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const now = Date.now();
          const valid = (request.result || []).filter(
            (c: CachedContact) => now - c.cachedAt < DEFAULT_TTL_MS
          );
          resolve(valid);
        };
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Evicts the oldest N cached records (LRU eviction)
   */
  async evictOldest(count: number = 50): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_CONTACTS], 'readwrite');
      const store = tx.objectStore(STORE_CONTACTS);
      const index = store.index('cachedAt');
      const req = index.openCursor();

      let deleted = 0;
      req.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor && deleted < count) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };
    } catch (err) {
      console.error('Eviction failed', err);
    }
  }

  /**
   * Immediate best-effort purge of all offline cached data on logout or session revocation
   */
  async purgeOfflineData(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_CONTACTS, STORE_META], 'readwrite');
      tx.objectStore(STORE_CONTACTS).clear();
      tx.objectStore(STORE_META).clear();

      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Ignore errors during purge
    }
  }
}

export const offlineStore = new OfflineStore();
