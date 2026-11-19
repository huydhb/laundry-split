import { LEARNED_WEIGHTS_META, LEARNED_WEIGHTS_OVERRIDES } from './learnedWeights.js';

/**
 * Clothing categories calibrated for KTX laundry bills (1 piece = 1 unit; 1 set = 2 pieces).
 * Bounds [minGram, maxGram] enforce physical constraints during weight calibration.
 */
export const CLOTHING_CATEGORIES = [
  {
    id: 'military',
    name: 'Quân phục',
    short: 'QP',
    defaultGram: 325,
    minGram: 240,
    maxGram: 430,
    priorStrength: 12,
    isPrimary: true,
    hint: '1 bộ áo + quần = 2 cái (~650g)'
  },
  {
    id: 'sport',
    name: 'Đồ thể dục',
    short: 'Thể dục',
    defaultGram: 175,
    minGram: 110,
    maxGram: 260,
    priorStrength: 10,
    isPrimary: true,
    hint: 'Áo hoặc quần thể dục rời (~175g)'
  },
  {
    id: 'tshirt',
    name: 'Áo phông',
    short: 'Áo phông',
    defaultGram: 200,
    minGram: 130,
    maxGram: 290,
    priorStrength: 6,
    isPrimary: true,
    hint: 'Áo thun cotton mặc hàng ngày (~200g)'
  },
  {
    id: 'sleepwear',
    name: 'Đồ ngủ',
    short: 'Đồ ngủ',
    defaultGram: 165,
    minGram: 100,
    maxGram: 250,
    priorStrength: 6,
    isPrimary: true,
    hint: 'Đồ mặc nhà/đồ ngủ mỏng (1 bộ = 2 cái)'
  },
  {
    id: 'longPants',
    name: 'Quần dài / Jean',
    short: 'Quần dài',
    defaultGram: 600,
    minGram: 400,
    maxGram: 850,
    priorStrength: 5,
    isPrimary: true,
    hint: 'Quần jean dài, kaki dày (~600g)'
  },
  {
    id: 'towel',
    name: 'Khăn tắm nhỏ',
    short: 'Khăn tắm',
    defaultGram: 200,
    minGram: 150,
    maxGram: 350,
    priorStrength: 6,
    isPrimary: true,
    hint: 'Khô tối thiểu 150g (chưa tính độ ẩm khi gửi)'
  },
  {
    id: 'other',
    name: 'Khác',
    short: 'Khác',
    defaultGram: 250,
    minGram: 80,
    maxGram: 700,
    priorStrength: 8,
    isPrimary: false,
    hint: 'Áo khoác mỏng, vỏ gối, đồ phát sinh'
  }
];

export const CATEGORY_MAP = Object.fromEntries(
  CLOTHING_CATEGORIES.map((cat) => [cat.id, cat])
);

export const BADGE_COLORS = [
  '#059669',
  '#D97706',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#0D9488',
  '#EA580C',
  '#4F46E5'
];

/**
 * Returns a fresh map of default gram weights keyed by category ID,
 * merging any deployed learned weight overrides clamped to physical bounds.
 * @param {Record<string, number>} [overrides]
 * @returns {Record<string, number>}
 */
export function getDefaultGrams(overrides = LEARNED_WEIGHTS_OVERRIDES) {
  const grams = {};
  for (const cat of CLOTHING_CATEGORIES) {
    const raw = overrides?.[cat.id];
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      grams[cat.id] = Math.max(cat.minGram, Math.min(cat.maxGram, parsed));
    } else {
      grams[cat.id] = cat.defaultGram;
    }
  }
  return grams;
}

export function getLearnedWeightsMeta() {
  return LEARNED_WEIGHTS_META;
}

/**
 * Clamps a gram value into the category's valid editable range.
 * @param {string} categoryId
 * @param {number|string} value
 * @returns {number}
 */
export function clampGram(categoryId, value) {
  const cat = CATEGORY_MAP[categoryId];
  const fallback = cat ? cat.defaultGram : 200;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  const minBound = cat ? Math.min(50, cat.minGram) : 10;
  return Math.max(minBound, Math.min(3000, parsed));
}
