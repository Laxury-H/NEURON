const DB_NAME = 'neuron_blobs_v1';
const STORE_NAME = 'blobs';

export type BlobData = Blob | ArrayBuffer | string;

export class BlobStorage {
  private static dbInstance: IDBDatabase | null = null;
  // In-memory Map fallback for Next.js SSR and Node.js automated test runner execution
  private static memoryFallback = new Map<string, BlobData>();

  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  private static async getDb(): Promise<IDBDatabase | null> {
    if (!this.isBrowser()) return null;
    if (this.dbInstance) return this.dbInstance;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => {
        this.dbInstance = req.result;
        this.dbInstance.onversionchange = () => {
          this.dbInstance?.close();
          this.dbInstance = null;
        };
        resolve(this.dbInstance);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async saveBlob(documentId: string, data: BlobData): Promise<void> {
    if (!this.isBrowser()) {
      this.memoryFallback.set(documentId, data);
      return;
    }
    const db = await this.getDb();
    if (!db) {
      this.memoryFallback.set(documentId, data);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, documentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getBlob(documentId: string): Promise<BlobData | null> {
    if (!this.isBrowser()) {
      return this.memoryFallback.get(documentId) || null;
    }
    const db = await this.getDb();
    if (!db) {
      return this.memoryFallback.get(documentId) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(documentId);
      req.onsuccess = () => resolve(req.result || this.memoryFallback.get(documentId) || null);
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteBlob(documentId: string): Promise<void> {
    if (!this.isBrowser()) {
      this.memoryFallback.delete(documentId);
      return;
    }
    const db = await this.getDb();
    if (!db) {
      this.memoryFallback.delete(documentId);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(documentId);
      tx.oncomplete = () => {
        this.memoryFallback.delete(documentId);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAllBlobs(): Promise<Map<string, BlobData>> {
    const map = new Map<string, BlobData>(this.memoryFallback);
    if (!this.isBrowser()) return map;
    const db = await this.getDb();
    if (!db) return map;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          map.set(cursor.key as string, cursor.value as BlobData);
          cursor.continue();
        } else {
          resolve(map);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async clear(): Promise<void> {
    this.memoryFallback.clear();
    if (!this.isBrowser()) return;
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
