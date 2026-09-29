import {openDB} from 'idb';
import {kitName, MAX_SAVED_KITS, parseFurnitureKit, type FurnitureKit} from './furnitureKits';

const database = () => openDB('nook-furniture-kits', 1, {upgrade(db) {db.createObjectStore('kits', {keyPath: 'id'});}});

export async function listFurnitureKits(): Promise<FurnitureKit[]> {
  const db = await database();
  try {return (await db.getAll('kits')).map(parseFurnitureKit).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));}
  finally {db.close();}
}

export async function saveFurnitureKit(value: FurnitureKit): Promise<void> {
  const kit = parseFurnitureKit(value), db = await database();
  try {
    const tx = db.transaction('kits', 'readwrite');
    try {
      if (await tx.store.count() >= MAX_SAVED_KITS) throw new Error(`Keep up to ${MAX_SAVED_KITS} private kits. Remove an unused kit first.`);
      await tx.store.add(kit); await tx.done;
    } catch (error) {try {tx.abort();} catch {} await tx.done.catch(() => {}); throw error;}
  } finally {db.close();}
}

export async function renameFurnitureKit(id: string, name: string): Promise<void> {
  const label = kitName(name), db = await database();
  try {
    const tx = db.transaction('kits', 'readwrite');
    try {
      const value = await tx.store.get(id); if (!value) throw new Error('This kit was removed. Refresh your collection.');
      const kit = parseFurnitureKit(value);
      await tx.store.put({...kit, name: label, updatedAt: new Date().toISOString()}); await tx.done;
    } catch (error) {try {tx.abort();} catch {} await tx.done.catch(() => {}); throw error;}
  } finally {db.close();}
}

export async function deleteFurnitureKit(id: string): Promise<void> {
  const db = await database();
  try {await db.delete('kits', id);} finally {db.close();}
}
