import { describe, expect, it } from 'vitest';
import { CLOTHING_CATEGORIES, getDefaultGrams } from '../src/config/categories.js';
import { trainWeights } from '../src/core/weightLearner.js';

// Deterministic PRNG for reproducible synthetic laundry experiments
function createRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('weightLearner (bounded robust regression + LOOCV)', () => {
  it('converges toward true hidden weights and beats skewed priors on noisy bills with an outlier', () => {
    const rng = createRng(12345);
    const trueWeights = {
      military: 360,
      sport: 190,
      tshirt: 235,
      sleepwear: 135,
      longPants: 670,
      towel: 245,
      other: 250
    };

    const bills = [];
    for (let i = 0; i < 24; i++) {
      // Deliberately induce partial collinearity between military & sport while varying others
      const military = 2 + Math.floor(rng() * 5) * 2;
      const sport = Math.max(0, Math.round(military / 2 + (rng() - 0.5) * 2));
      const tshirt = Math.floor(rng() * 5);
      const sleepwear = Math.floor(rng() * 4);
      const longPants = Math.floor(rng() * 3);
      const towel = rng() > 0.35 ? 1 + Math.floor(rng() * 2) : 0;

      const counts = { military, sport, tshirt, sleepwear, longPants, towel, other: 0 };
      const trueGrams =
        military * trueWeights.military +
        sport * trueWeights.sport +
        tshirt * trueWeights.tshirt +
        sleepwear * trueWeights.sleepwear +
        longPants * trueWeights.longPants +
        towel * trueWeights.towel;

      // +/- 60g scale & fabric noise, rounded to 0.1kg like real KTX scales
      const noisyGrams = trueGrams + (rng() - 0.5) * 120;
      const actualKg = Number((Math.round(noisyGrams / 100) * 0.1).toFixed(1));
      bills.push({ id: `syn_${i}`, actualKg, counts });
    }

    // Inject 1 wet/miscounted outlier (+900g) to verify Huber robustness
    bills[7].actualKg = Number((bills[7].actualKg + 0.9).toFixed(1));

    const start = performance.now();
    const result = trainWeights(bills);
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(500);
    expect(result.validBillsCount).toBe(24);
    expect(result.improved).toBe(true);
    expect(result.learnedMaeGrams).toBeLessThan(result.defaultMaeGrams);
    expect(result.learnedMaeGrams).toBeLessThan(120);

    // Towel must move up from 200g prior toward 245g and stay >= 150g physical floor
    expect(result.weights.towel).toBeGreaterThan(210);
    expect(result.weights.towel).toBeGreaterThanOrEqual(150);
    // Military & longPants should track upward toward true weights
    expect(Math.abs(result.weights.military - trueWeights.military)).toBeLessThan(35);
    expect(Math.abs(result.weights.longPants - trueWeights.longPants)).toBeLessThan(45);
    // Outlier bill should be flagged
    expect(result.billDiagnostics[7].isOutlier).toBe(true);
  });

  it('strictly respects physical bounds even on adversarial extreme bills', () => {
    const bills = Array.from({ length: 10 }, (_, idx) => ({
      id: `adv_${idx}`,
      actualKg: 0.5, // Unrealistically low weight trying to drag towel below 150g
      counts: { military: 0, sport: 0, tshirt: 0, sleepwear: 0, longPants: 0, towel: 5, other: 0 }
    }));

    const result = trainWeights(bills);

    for (const cat of CLOTHING_CATEGORIES) {
      expect(result.weights[cat.id]).toBeGreaterThanOrEqual(cat.minGram);
      expect(result.weights[cat.id]).toBeLessThanOrEqual(cat.maxGram);
    }
    expect(result.weights.towel).toBe(150);
  });

  it('respects excludeFromTrain flag and does not recommend applying when fewer than 6 valid bills', () => {
    const bills = [
      { id: 'b1', actualKg: 3.3, counts: { military: 6, sport: 2, tshirt: 2, longPants: 1 } },
      { id: 'b2', actualKg: 4.5, counts: { military: 8, sport: 2, towel: 2 }, excludeFromTrain: true },
      { id: 'b3', actualKg: 0, counts: { military: 4 } }
    ];

    const result = trainWeights(bills);

    expect(result.validBillsCount).toBe(1);
    expect(result.excludedCount).toBe(2);
    expect(result.improved).toBe(false);
  });

  it('getDefaultGrams merges learned overrides safely clamped inside physical bounds', () => {
    const merged = getDefaultGrams({
      towel: 90, // below minGram 150 -> should clamp to 150
      military: 350,
      longPants: 1200 // above maxGram 850 -> should clamp to 850
    });

    expect(merged.towel).toBe(150);
    expect(merged.military).toBe(350);
    expect(merged.longPants).toBe(850);
    expect(merged.sport).toBe(175);
  });
});
