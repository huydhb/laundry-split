import { describe, expect, it } from 'vitest';
import { clampGram, getDefaultGrams } from '../src/config/categories.js';
import { calculateExpectedBillMoney } from '../src/config/pricing.js';
import { computeSplit } from '../src/core/splitEngine.js';

describe('splitEngine', () => {
  it('splits a 3.3kg urgent bill evenly and sums strictly to targetCollected', () => {
    const state = {
      washMode: 'urgent',
      totalKg: 3.3,
      totalMoney: 56100,
      roundingStep: 1000,
      roundingMode: 'nearest',
      grams: getDefaultGrams(),
      members: [
        { id: 'm1', name: 'Bạn 1', counts: { military: 2, sport: 1, tshirt: 2 } },
        { id: 'm2', name: 'Bạn 2', counts: { military: 2, sport: 1, longPants: 1 } },
        { id: 'm3', name: 'Bạn 3', counts: { military: 2 } }
      ]
    };

    const res = computeSplit(state);

    expect(res.totalItems).toBe(11);
    expect(res.estimatedKg).toBeCloseTo(3.3, 2);
    expect(res.targetCollected).toBe(56000);
    expect(res.results.reduce((s, r) => s + r.finalMoney, 0)).toBe(56000);
    expect(res.results[0].finalMoney).toBe(21000);
    expect(res.results[1].finalMoney).toBe(24000);
    expect(res.results[2].finalMoney).toBe(11000);
  });

  it('rounds UP in ceil mode so bill payer never loses money', () => {
    const state = {
      washMode: 'urgent',
      totalKg: 3.3,
      totalMoney: 56100,
      roundingStep: 1000,
      roundingMode: 'ceil',
      grams: getDefaultGrams(),
      members: [
        { id: 'm1', name: 'Bạn 1', counts: { military: 2, sport: 1, tshirt: 2 } },
        { id: 'm2', name: 'Bạn 2', counts: { military: 2, sport: 1, longPants: 1 } },
        { id: 'm3', name: 'Bạn 3', counts: { military: 2 } }
      ]
    };

    const res = computeSplit(state);

    expect(res.targetCollected).toBe(57000);
    expect(res.results.reduce((s, r) => s + r.finalMoney, 0)).toBe(57000);
    expect(res.targetCollected).toBeGreaterThanOrEqual(res.billMoney);
  });

  it('returns targetCollected = 0 when all members have 0 items', () => {
    const state = {
      washMode: 'normal',
      totalKg: 3.0,
      totalMoney: 36000,
      roundingStep: 1000,
      roundingMode: 'nearest',
      grams: getDefaultGrams(),
      members: [
        { id: 'm1', name: 'Bạn 1', counts: {} },
        { id: 'm2', name: 'Bạn 2', counts: {} }
      ]
    };

    const res = computeSplit(state);

    expect(res.hasItems).toBe(false);
    expect(res.targetCollected).toBe(0);
    expect(res.results.every((r) => r.finalMoney === 0)).toBe(true);
  });

  it('supports 500đ and 100đ rounding steps accurately', () => {
    const baseState = {
      washMode: 'urgent',
      totalKg: 3.3,
      totalMoney: 56100,
      roundingMode: 'nearest',
      grams: getDefaultGrams(),
      members: [
        { id: 'm1', name: 'A', counts: { military: 2, towel: 1 } },
        { id: 'm2', name: 'B', counts: { longPants: 2, tshirt: 1 } }
      ]
    };

    const res500 = computeSplit({ ...baseState, roundingStep: 500 });
    expect(res500.targetCollected).toBe(56000);
    expect(res500.results.reduce((s, r) => s + r.finalMoney, 0)).toBe(56000);

    const res100 = computeSplit({ ...baseState, roundingStep: 100 });
    expect(res100.targetCollected).toBe(56100);
    expect(res100.results.reduce((s, r) => s + r.finalMoney, 0)).toBe(56100);
  });

  it('applies minimum floor pricing below 2.5kg and tracks categoryTotals', () => {
    const floorNormal = calculateExpectedBillMoney(1.8, 'normal');
    expect(floorNormal.appliedFloor).toBe(true);
    expect(floorNormal.effectiveByRule).toBe(30000);

    const floorUrgent = calculateExpectedBillMoney(2.0, 'urgent');
    expect(floorUrgent.appliedFloor).toBe(true);
    expect(floorUrgent.effectiveByRule).toBe(42000);

    const res = computeSplit({
      washMode: 'normal',
      totalKg: 1.8,
      totalMoney: 30000,
      roundingStep: 1000,
      grams: getDefaultGrams(),
      members: [
        { id: 'm1', name: 'A', counts: { military: 2, towel: 1 } },
        { id: 'm2', name: 'B', counts: { military: 2, sleepwear: 2 } }
      ]
    });

    expect(res.appliedFloor).toBe(true);
    expect(res.categoryTotals.military).toBe(4);
    expect(res.categoryTotals.towel).toBe(1);
    expect(res.categoryTotals.sleepwear).toBe(2);
    expect(clampGram('towel', 150)).toBe(150);
  });
});
