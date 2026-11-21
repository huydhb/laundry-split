import { describe, expect, it } from 'vitest';
import {
  createDefaultState,
  LEGACY_STORAGE_KEY_V3,
  loadState,
  migrateState,
  saveState,
  stateActions,
  STORAGE_KEY
} from '../src/state/store.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

describe('store & v3 migration', () => {
  it('defaults to per-person rounding while preserving an explicit saved choice', () => {
    expect(createDefaultState().roundingMode).toBe('ceil');
    expect(migrateState({}).roundingMode).toBe('ceil');
    expect(migrateState({ roundingMode: 'nearest' }).roundingMode).toBe('nearest');
    expect(migrateState({ roundingMode: 'ceil' }).roundingMode).toBe('ceil');
  });
  it('migrates legacy v3 state cleanly into 6+1 categories', () => {
    const legacyV3 = {
      washMode: 'normal',
      totalKg: 4.0,
      totalMoney: 48000,
      roundingStep: 500,
      splitCasual: true,
      grams: {
        military: 330,
        sport: 170,
        casualLight: 210,
        casualHeavy: 620,
        towel: 180
      },
      members: [
        {
          id: 'm1',
          name: 'Thành viên X',
          counts: { military: 2, sport: 1, casualLight: 3, casualHeavy: 1, towel: 1 }
        }
      ]
    };

    const storage = createMemoryStorage({
      [LEGACY_STORAGE_KEY_V3]: JSON.stringify(legacyV3)
    });

    const loaded = loadState(storage);

    expect(loaded.schemaVersion).toBe(4);
    expect(loaded.washMode).toBe('normal');
    expect(loaded.roundingStep).toBe(500);
    expect(loaded.grams.tshirt).toBe(210);
    expect(loaded.grams.longPants).toBe(620);
    expect(loaded.grams.towel).toBe(180);
    expect(loaded.members[0].counts.tshirt).toBe(3);
    expect(loaded.members[0].counts.longPants).toBe(1);
    expect(loaded.members[0].counts.sleepwear).toBe(0);
  });

  it('migrates unsplit casual counts when legacy splitCasual was false', () => {
    const migrated = migrateState({
      splitCasual: false,
      members: [{ id: 'm1', name: 'A', counts: { casual: 6 } }]
    });

    expect(migrated.members[0].counts.longPants).toBe(2);
    expect(migrated.members[0].counts.tshirt).toBe(4);
  });

  it('never overwrites measured totalKg when editing totalMoney', () => {
    const state = createDefaultState();
    stateActions.setTotalKg(state, 2.0);
    expect(state.totalMoney).toBe(42000);

    stateActions.setTotalMoney(state, 45000);
    expect(state.totalKg).toBe(2.0);
    expect(state.totalMoney).toBe(45000);
  });

  it('supports undo snapshot after resetting all counts and saves to v4 key', () => {
    const storage = createMemoryStorage();
    const state = createDefaultState();
    const snap = stateActions.snapshotMemberCounts(state);

    stateActions.resetAllCounts(state);
    expect(state.members.every((m) => m.counts.military === 0)).toBe(true);

    stateActions.restoreCountsSnapshot(state, snap);
    expect(state.members[0].counts.military).toBe(2);

    saveState(state, storage);
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('contains only anonymized default names and no personal data', () => {
    const state = createDefaultState();
    expect(state.members.map((m) => m.name)).toEqual(['Bạn 1', 'Bạn 2', 'Bạn 3']);
  });
});
