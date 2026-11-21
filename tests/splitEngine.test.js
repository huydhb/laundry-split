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

    expect(res.results.map((r) => r.finalMoney)).toEqual([21000, 25000, 12000]);
    expect(res.targetCollected).toBe(58000);
    expect(res.results.reduce((s, r) => s + r.finalMoney, 0)).toBe(58000);
    expect(res.collectedDiff).toBe(1900);
    expect(res.targetCollected).toBeGreaterThanOrEqual(res.billMoney);
  });

  it('keeps identical uniform shares equal on the confirmed 14-piece bill', () => {
    const state = {
      washMode: 'normal', totalKg: 4.9, totalMoney: 58800, roundingStep: 1000,
      grams: { military: 325, sleepwear: 165, longPants: 600 },
      members: [
        { id: 'a', counts: { military: 2 } },
        { id: 'b', counts: { military: 2 } },
        { id: 'c', counts: { military: 2, sleepwear: 2, longPants: 1 } },
        { id: 'd', counts: { military: 2, sleepwear: 2, longPants: 1 } }
      ]
    };
    const balanced = computeSplit({ ...state, roundingMode: 'nearest' });
    expect(balanced.results.map((r) => r.finalMoney)).toEqual([9000, 8000, 21000, 21000]);
    const rounded = computeSplit({ ...state, roundingMode: 'ceil' });
    expect(rounded.totalItems).toBe(14);
    expect(rounded.results.map((r) => r.finalMoney)).toEqual([9000, 9000, 21000, 21000]);
    expect(rounded.targetCollected).toBe(60000);
    expect(rounded.collectedDiff).toBe(1200);
    const reversed = computeSplit({ ...state, roundingMode: 'ceil', members: [...state.members].reverse() });
    expect(reversed.results.map((r) => r.finalMoney)).toEqual([21000, 21000, 9000, 9000]);
  });

  it.each([
    [66000, [142, 142, 317, 258, 142], [10000, 10000, 21000, 18000, 10000], 3000]
  ])('rounds equal shares equally for a %i bill regardless of member order', (money, weights, expected, diff) => {
    // Synthetic weights reproduce the reported proportions, not receipt item counts.
    const categories = weights.map((weight, i) => ({ id: `c${i}`, defaultGram: weight }));
    const state = {
      totalMoney: money, roundingStep: 1000, roundingMode: 'ceil',
      members: categories.map((cat) => ({ id: cat.id, counts: { [cat.id]: 1 } }))
    };
    const res = computeSplit(state, categories);
    expect(res.results.map((r) => r.finalMoney)).toEqual(expected);
    expect(res.collectedDiff).toBe(diff);
    expect(res.targetCollected).toBe(money + diff);
    const reversed = computeSplit({ ...state, members: [...state.members].reverse() }, categories);
    expect(reversed.results.map((r) => r.finalMoney)).toEqual([...expected].reverse());
  });

  it.each([1000, 500, 100])('keeps exact multiples and zero-item members unchanged at step %i', (step) => {
    const res = computeSplit({
      totalMoney: 25000, roundingStep: step, roundingMode: 'ceil', grams: { other: 100 },
      members: [
        { id: 'a', counts: { other: 14 } },
        { id: 'b', counts: { other: 86 } },
        { id: 'empty', counts: {} }
      ]
    });
    expect(res.results.map((r) => r.finalMoney)).toEqual(step === 1000 ? [4000, 22000, 0] : [3500, 21500, 0]);
    expect(res.collectedDiff).toBe(step === 1000 ? 1000 : 0);
  });

  it.each(['ceil', 'nearest'])('collects nothing for empty clothes or a zero bill in %s mode', (roundingMode) => {
    const state = { totalMoney: 30000, roundingMode, members: [{ id: 'empty', counts: {} }] };
    expect(computeSplit(state).targetCollected).toBe(0);
    expect(computeSplit(state).collectedDiff).toBe(0);
    expect(computeSplit({ ...state, totalMoney: 0, members: [{ id: 'a', counts: { military: 2 } }] }).targetCollected).toBe(0);
  });

  it('charges 10000 for two of six uniform pieces on a 30000 minimum bill', () => {
    const res = computeSplit({
      washMode: 'normal', totalKg: 2, totalMoney: 30000, roundingMode: 'ceil',
      members: ['a', 'b', 'c'].map((id) => ({ id, counts: { military: 2 } }))
    });
    expect(res.expectedByRate).toBe(24000);
    expect(res.appliedFloor).toBe(true);
    expect(res.results.map((r) => r.finalMoney)).toEqual([10000, 10000, 10000]);
    expect(res.collectedDiff).toBe(0);
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
