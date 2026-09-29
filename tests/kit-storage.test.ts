import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it} from 'vitest';
import {deleteDB} from 'idb';
import {cozyStarterKits, MAX_SAVED_KITS} from '../src/furnitureKits';
import {deleteFurnitureKit, listFurnitureKits, renameFurnitureKit, saveFurnitureKit} from '../src/kitStorage';

const copy = (id:string) => ({...structuredClone(cozyStarterKits[0]),id,name:`Kit ${id}`});
afterEach(async () => {await deleteDB('nook-furniture-kits');});

describe('device-private kit storage', () => {
  it('preserves concurrent additions and prevents duplicate identifiers from overwriting a saved kit', async () => {
    await Promise.all([saveFurnitureKit(copy('a')),saveFurnitureKit(copy('b'))]);
    await expect(saveFurnitureKit({...copy('a'),name:'Overwrite'})).rejects.toThrow();
    expect((await listFurnitureKits()).map(k=>k.name).sort()).toEqual(['Kit a','Kit b']);
  });
  it('renames only its target, validates before writing and never resurrects a deleted kit', async () => {
    await saveFurnitureKit(copy('a')); await saveFurnitureKit(copy('b'));
    await renameFurnitureKit('a','  Reading at home  '); await expect(renameFurnitureKit('b',' ')).rejects.toThrow();
    expect((await listFurnitureKits()).map(k=>k.name).sort()).toEqual(['Kit b','Reading at home']);
    await deleteFurnitureKit('a'); await expect(renameFurnitureKit('a','Bring it back')).rejects.toThrow('removed');
    expect((await listFurnitureKits()).map(k=>k.id)).toEqual(['b']);
  });
  it('enforces the collection bound atomically across competing saves and retains existing kits', async () => {
    for(let i=0;i<MAX_SAVED_KITS-1;i++) await saveFurnitureKit(copy(String(i)));
    const results = await Promise.allSettled([saveFurnitureKit(copy('last-a')),saveFurnitureKit(copy('last-b'))]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const saved = await listFurnitureKits(); expect(saved).toHaveLength(MAX_SAVED_KITS); expect(saved.some(k=>k.id==='0')).toBe(true);
  });
});
