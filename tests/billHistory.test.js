import { describe, expect, it } from 'vitest';
import { getDefaultGrams } from '../src/config/categories.js';
import { computeSplit } from '../src/core/splitEngine.js';
import {
  addBillToHistory,
  createBillSnapshot,
  deleteBillFromHistory,
  exportAnonymizedHistoryJson,
  importAnonymizedHistoryJson,
  loadBillHistory,
  saveBillHistory,
  toggleExcludeBill
} from '../src/state/billHistory.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

describe('billHistory', () => {
  it('creates strictly anonymized snapshot without member names or bank fields', () => {
    const state = {
      washMode: 'urgent',
      totalKg: 3.3,
      totalMoney: 56100,
      roundingStep: 1000,
      grams: getDefaultGrams(),
      bank: { code: 'VCB', accountNo: '99999999', ownerName: 'SECRET NAME' },
      members: [
        { id: 'm1', name: 'Tên Riêng Tư', counts: { military: 4, sport: 2, tshirt: 2 } },
        { id: 'm2', name: 'Tên Khác', counts: { military: 2, longPants: 1 } }
      ]
    };

    const calc = computeSplit(state);
    const snap = createBillSnapshot(state, calc, { note: 'Đồ bình thường' });
    const serialized = JSON.stringify(snap);

    expect(snap).not.toBeNull();
    expect(snap.actualKg).toBe(3.3);
    expect(snap.totalItems).toBe(11);
    expect(snap.counts.military).toBe(6);
    expect(serialized).not.toContain('Tên Riêng Tư');
    expect(serialized).not.toContain('SECRET NAME');
    expect(serialized).not.toContain('99999999');
  });

  it('persists, toggles excludeFromTrain, exports, and deduplicates imports', () => {
    const storage = createMemoryStorage();
    const state = {
      washMode: 'normal',
      totalKg: 4.1,
      totalMoney: 49200,
      grams: getDefaultGrams(),
      members: [{ id: 'm1', name: 'A', counts: { military: 6, sport: 2, towel: 2, longPants: 2 } }]
    };

    const calc = computeSplit(state);
    const snap = createBillSnapshot(state, calc);
    let history = addBillToHistory([], snap);
    history = toggleExcludeBill(history, snap.id);
    expect(history[0].excludeFromTrain).toBe(true);

    saveBillHistory(history, storage);
    const reloaded = loadBillHistory(storage);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].excludeFromTrain).toBe(true);

    const exported = exportAnonymizedHistoryJson(reloaded);
    // Importing same record again should skip duplicate
    const dupResult = importAnonymizedHistoryJson(exported, reloaded);
    expect(dupResult.importedCount).toBe(0);
    expect(dupResult.skippedCount).toBe(1);

    // Deleting clears history
    const afterDelete = deleteBillFromHistory(reloaded, snap.id);
    expect(afterDelete).toHaveLength(0);
  });
});
