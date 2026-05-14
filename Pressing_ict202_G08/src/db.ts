import type { AppSettings, Business, Garment } from './types';

const DB_NAME = 'pressing-groupe-8-db';
const DB_VERSION = 1;
const GARMENTS = 'garments';
const BUSINESSES = 'businesses';
const SETTINGS = 'settings';
const SETTINGS_ID = 'app-settings';

let cachedDb: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (cachedDb) return Promise.resolve(cachedDb);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(GARMENTS)) {
        const store = db.createObjectStore(GARMENTS, { keyPath: 'id' });
        store.createIndex('businessId', 'businessId');
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains(BUSINESSES)) {
        const store = db.createObjectStore(BUSINESSES, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: true });
      }

      if (!db.objectStoreNames.contains(SETTINGS)) {
        db.createObjectStore(SETTINGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      cachedDb = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name: string, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function getSettings(): Promise<AppSettings> {
  const objectStore = await store(SETTINGS, 'readonly');
  const record = await promisify<{ id: string; value: AppSettings } | undefined>(
    objectStore.get(SETTINGS_ID),
  );

  return record?.value ?? { language: 'fr', theme: 'light' };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const objectStore = await store(SETTINGS, 'readwrite');
  await promisify(objectStore.put({ id: SETTINGS_ID, value: settings }));
}

export async function getBusinesses(): Promise<Business[]> {
  const objectStore = await store(BUSINESSES, 'readonly');
  return promisify(objectStore.getAll());
}

export async function saveBusiness(business: Business): Promise<void> {
  const objectStore = await store(BUSINESSES, 'readwrite');
  await promisify(objectStore.put(business));
}

export async function getGarments(): Promise<Garment[]> {
  const objectStore = await store(GARMENTS, 'readonly');
  return promisify(objectStore.getAll());
}

export async function saveGarment(garment: Garment): Promise<void> {
  const objectStore = await store(GARMENTS, 'readwrite');
  await promisify(objectStore.put(garment));
}

export async function deleteGarment(id: string): Promise<void> {
  const objectStore = await store(GARMENTS, 'readwrite');
  await promisify(objectStore.delete(id));
}

export async function replaceGarments(garments: Garment[]): Promise<void> {
  const objectStore = await store(GARMENTS, 'readwrite');
  await Promise.all(garments.map((garment) => promisify(objectStore.put(garment))));
}
