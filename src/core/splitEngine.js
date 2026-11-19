import { BADGE_COLORS, CLOTHING_CATEGORIES } from '../config/categories.js';
import { calculateExpectedBillMoney, getWashModeConfig, ROUNDING_MODES } from '../config/pricing.js';

/**
 * Computes each member's fair share using estimated item grams and Largest Remainder rounding.
 * Pure function suitable for both browser UI and headless tests.
 */
export function computeSplit(state, categories = CLOTHING_CATEGORIES) {
  const modeCfg = getWashModeConfig(state.washMode);
  const step = [1000, 500, 100].includes(state.roundingStep) ? state.roundingStep : 1000;
  const roundingMode = state.roundingMode === ROUNDING_MODES.ceil ? ROUNDING_MODES.ceil : ROUNDING_MODES.nearest;

  const categoryTotals = Object.fromEntries(categories.map((cat) => [cat.id, 0]));
  let totalItems = 0;
  let totalEstimatedGrams = 0;

  const members = Array.isArray(state.members) ? state.members : [];
  const memberData = members.map((member, idx) => {
    let items = 0;
    let grams = 0;
    const details = [];

    for (const cat of categories) {
      const rawQty = member.counts?.[cat.id] ?? 0;
      const qty = Math.max(0, Number.parseInt(rawQty, 10) || 0);
      const unitGram = Math.max(10, Number.parseInt(state.grams?.[cat.id] ?? cat.defaultGram, 10) || cat.defaultGram);

      if (qty > 0) {
        items += qty;
        grams += qty * unitGram;
        categoryTotals[cat.id] += qty;
        details.push(`${qty} ${cat.short}`);
      }
    }

    totalItems += items;
    totalEstimatedGrams += grams;

    return {
      id: member.id,
      name: (member.name || '').trim() || `Bạn ${idx + 1}`,
      color: BADGE_COLORS[idx % BADGE_COLORS.length],
      items,
      grams,
      detailsText: details.length ? details.join(', ') : '0 đồ'
    };
  });

  const estimatedKg = totalEstimatedGrams / 1000;
  const billKg = Math.max(0, Number.parseFloat(state.totalKg) || 0);
  const billMoney = Math.max(0, Number.parseInt(state.totalMoney, 10) || 0);
  const hasItems = totalEstimatedGrams > 0;

  const { expectedByRate, effectiveByRule, appliedFloor } = calculateExpectedBillMoney(billKg, modeCfg.id);

  // If no clothes are entered yet, do not pretend money is split among zero-item members.
  let targetCollected = 0;
  if (hasItems && billMoney > 0) {
    targetCollected = roundingMode === ROUNDING_MODES.ceil
      ? Math.ceil(billMoney / step) * step
      : Math.round(billMoney / step) * step;
  }

  const totalUnits = targetCollected > 0 ? Math.round(targetCollected / step) : 0;
  let sumFloorUnits = 0;

  const results = memberData.map((member, index) => {
    const ratio = hasItems ? member.grams / totalEstimatedGrams : 0;
    const pct = ratio * 100;
    const allocatedKg = billKg * ratio;
    const exactMoney = billMoney * ratio;

    const exactUnits = totalUnits * ratio;
    const floorUnits = Math.floor(exactUnits);
    const remainder = exactUnits - floorUnits;
    sumFloorUnits += floorUnits;

    return {
      ...member,
      index,
      ratio,
      pct,
      allocatedKg,
      exactMoney,
      floorUnits,
      remainder,
      bonusUnit: 0,
      finalMoney: 0
    };
  });

  const leftoverUnits = totalUnits - sumFloorUnits;
  const ranked = results
    .filter((r) => r.grams > 0)
    .sort((a, b) => {
      const remDiff = b.remainder - a.remainder;
      if (Math.abs(remDiff) > 1e-9) return remDiff;
      if (b.grams !== a.grams) return b.grams - a.grams;
      return a.index - b.index;
    });

  for (let i = 0; i < leftoverUnits && i < ranked.length; i++) {
    ranked[i].bonusUnit = 1;
  }

  for (const r of results) {
    r.finalMoney = hasItems ? (r.floorUnits + r.bonusUnit) * step : 0;
  }

  return {
    washMode: modeCfg.id,
    ratePerKg: modeCfg.ratePerKg,
    minFloor: modeCfg.minFloor,
    expectedByRate,
    effectiveByRule,
    appliedFloor,
    roundingStep: step,
    roundingMode,
    hasItems,
    totalItems,
    totalEstimatedGrams,
    estimatedKg,
    categoryTotals,
    billKg,
    billMoney,
    targetCollected,
    results
  };
}
