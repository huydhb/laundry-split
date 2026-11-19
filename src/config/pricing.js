/**
 * Single source of truth for KTX laundry pricing rules and rounding options.
 */
export const WASH_MODES = {
  normal: {
    id: 'normal',
    label: 'Giặt Thường',
    shortLabel: 'Giặt Thường (12k/kg)',
    ratePerKg: 12000,
    minFloor: 30000,
    badgeText: '12K',
    ruleText: '12.000đ/kg • Sàn 30k'
  },
  urgent: {
    id: 'urgent',
    label: '⚡ Giặt Khẩn Cấp',
    shortLabel: 'Giặt Khẩn Cấp (17k/kg)',
    ratePerKg: 17000,
    minFloor: 42000,
    badgeText: '17K',
    ruleText: '⚡ 17.000đ/kg • Sàn 42k'
  }
};

export const ROUNDING_STEPS = [1000, 500, 100];

export const ROUNDING_MODES = {
  nearest: 'nearest',
  ceil: 'ceil'
};

/**
 * Resolves pricing config for a wash mode with safe fallback to normal.
 * @param {string} modeId
 */
export function getWashModeConfig(modeId) {
  return WASH_MODES[modeId] || WASH_MODES.normal;
}

/**
 * Computes expected bill money based on measured kg and minimum floor rule.
 * @param {number} kg
 * @param {string} modeId
 */
export function calculateExpectedBillMoney(kg, modeId) {
  const safeKg = Math.max(0, Number(kg) || 0);
  if (safeKg <= 0) {
    return { expectedByRate: 0, effectiveByRule: 0, appliedFloor: false };
  }
  const { ratePerKg, minFloor } = getWashModeConfig(modeId);
  const expectedByRate = Math.round(safeKg * ratePerKg);
  const appliedFloor = expectedByRate < minFloor;
  const effectiveByRule = appliedFloor ? minFloor : expectedByRate;
  return { expectedByRate, effectiveByRule, appliedFloor };
}
