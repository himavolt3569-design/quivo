"use client";

/**
 * Offline POS queue (IndexedDB).
 *
 * When the till has no network, completePOSSale calls enqueue() to stash the
 * sale locally. The dispatcher on `online` event replays each item in FIFO
 * order against the real server action; on success the entry is removed,
 * on failure attempt_count is bumped and the error stored.
 *
 * The receipt itself is fully renderable from the queued payload, so the
 * cashier can still print while offline.
 */

import type { POSSaleInput } from "@/app/actions/owner";

const DB_NAME = "quivo-offline";
const DB_VERSION = 1;
const STORE = "pos_queue";

export interface QueuedSale {
  id?: number;
  tempId: string;
  shopId: string;
  input: POSSaleInput;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("open failed"));
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  const t = db.transaction(STORE, mode);
  return { store: t.objectStore(STORE), tx: t };
}

export async function enqueue(item: Omit<QueuedSale, "id" | "queuedAt" | "attempts">): Promise<number> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const { store, tx } = (function getTx() {
      const t = db.transaction(STORE, "readwrite");
      return { store: t.objectStore(STORE), tx: t };
    })();
    const row: QueuedSale = { ...item, queuedAt: Date.now(), attempts: 0 };
    const req = store.add(row);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error ?? new Error("enqueue failed"));
    tx.oncomplete = () => db.close();
  });
}

export async function list(): Promise<QueuedSale[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const { store, tx: t } = tx(db, "readonly");
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as QueuedSale[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error("list failed"));
    t.oncomplete = () => db.close();
  });
}

export async function remove(id: number): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const { store, tx: t } = tx(db, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("remove failed"));
    t.oncomplete = () => db.close();
  });
}

export async function update(id: number, patch: Partial<QueuedSale>): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const { store, tx: t } = tx(db, "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = getReq.result as QueuedSale | undefined;
      if (!current) { resolve(); return; }
      const next: QueuedSale = { ...current, ...patch };
      const putReq = store.put(next);
      putReq.onerror = () => reject(putReq.error ?? new Error("update failed"));
      putReq.onsuccess = () => resolve();
    };
    getReq.onerror = () => reject(getReq.error ?? new Error("update read failed"));
    t.oncomplete = () => db.close();
  });
}

export async function clear(): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const { store, tx: t } = tx(db, "readwrite");
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("clear failed"));
    t.oncomplete = () => db.close();
  });
}

/**
 * Replay the queue against the live server action. Returns counts.
 * The caller passes the action so this module stays UI-agnostic.
 */
export async function replayQueue(
  submit: (input: POSSaleInput) => Promise<{ success?: true; error?: string }>
): Promise<{ flushed: number; failed: number }> {
  const items = await list();
  let flushed = 0;
  let failed = 0;
  // FIFO by insertion id.
  items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  for (const item of items) {
    try {
      const res = await submit(item.input);
      if (res.error) {
        await update(item.id!, {
          attempts: (item.attempts ?? 0) + 1,
          lastError: res.error,
        });
        failed += 1;
        continue;
      }
      await remove(item.id!);
      flushed += 1;
    } catch (err) {
      await update(item.id!, {
        attempts: (item.attempts ?? 0) + 1,
        lastError: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }
  return { flushed, failed };
}

const STORAGE_EVENT = "quivo:pos-queue-changed";

/** Subscribe to queue mutations from within the same tab. */
export function onQueueChanged(handler: () => void): () => void {
  const fn = () => handler();
  window.addEventListener(STORAGE_EVENT, fn);
  return () => window.removeEventListener(STORAGE_EVENT, fn);
}

export function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }
}
