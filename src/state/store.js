import { CLOTHING_CATEGORIES, clampGram, getDefaultGrams } from '../config/categories.js';
import { calculateExpectedBillMoney, ROUNDING_MODES, ROUNDING_STEPS, WASH_MODES } from '../config/pricing.js';

export const STORAGE_KEY = 'laundry_split_v4';
export const LEGACY_STORAGE_KEY_V3 = 'hcmue_laundry_direct_v3';

function buildEmptyCounts(overrides = {}) {
  const counts = {};
  for (const cat of CLOTHING_CATEGORIES) {
    const raw = overrides[cat.id] ?? 0;
    counts[cat.id] = Math.max(0, Number.parseInt(raw, 10) || 0);
  }
  return counts;
}

export function createSampleMembers() {
  return [
    {
      id: 'm1',
      name: 'Bạn 1',
      counts: buildEmptyCounts({ military: 2, sport: 1, tshirt: 2 })
    },
    {
      id: 'm2',
      name: 'Bạn 2',
      counts: buildEmptyCounts({ military: 2, sport: 1, longPants: 1 })
    },
    {
      id: 'm3',
      name: 'Bạn 3',
      counts: buildEmptyCounts({ military: 2 })
    }
  ];
}

export function createDefaultState() {
  return {
    schemaVersion: 4,
    washMode: 'urgent',
    totalKg: 3.3,
    totalMoney: 56100,
    roundingStep: 1000,
    roundingMode: ROUNDING_MODES.nearest,
    showOtherCategory: false,
    grams: getDefaultGrams(),
    bank: {
      code: '',
      accountNo: '',
      ownerName: ''
    },
    members: createSampleMembers()
  };
}

function migrateMemberCounts(rawCounts = {}, wasSplitCasual = true) {
  const hasNewKeys =
    rawCounts.tshirt !== undefined ||
    rawCounts.sleepwear !== undefined ||
    rawCounts.longPants !== undefined;

  if (hasNewKeys) {
    return buildEmptyCounts(rawCounts);
  }

  let tshirt = Number.parseInt(rawCounts.casualLight ?? 0, 10) || 0;
  let longPants = Number.parseInt(rawCounts.casualHeavy ?? 0, 10) || 0;

  if (!wasSplitCasual && tshirt + longPants === 0) {
    const casual = Math.max(0, Number.parseInt(rawCounts.casual ?? 0, 10) || 0);
    longPants = Math.floor(casual / 3);
    tshirt = casual - longPants;
  }

  return buildEmptyCounts({
    military: rawCounts.military ?? 0,
    sport: rawCounts.sport ?? 0,
    tshirt,
    sleepwear: 0,
    longPants,
    towel: rawCounts.towel ?? 0,
    other: rawCounts.other ?? 0
  });
}

/**
 * Normalizes and migrates saved state (both v4 and legacy v3 schema).
 */
export function migrateState(parsed) {
  const base = createDefaultState();
  if (!parsed || typeof parsed !== 'object') return base;

  const wasSplitCasual = parsed.splitCasual !== false;
  const rawGrams = parsed.grams && typeof parsed.grams === 'object' ? parsed.grams : {};
  const migratedGrams = getDefaultGrams();

  for (const cat of CLOTHING_CATEGORIES) {
    let candidate = rawGrams[cat.id];
    if (candidate === undefined && cat.id === 'tshirt') candidate = rawGrams.casualLight;
    if (candidate === undefined && cat.id === 'longPants') candidate = rawGrams.casualHeavy;
    if (candidate !== undefined) {
      migratedGrams[cat.id] = clampGram(cat.id, candidate);
    }
  }

  const rawMembers = Array.isArray(parsed.members) && parsed.members.length > 0
    ? parsed.members
    : base.members;

  const members = rawMembers.map((m, idx) => {
    const counts = migrateMemberCounts(m?.counts || {}, wasSplitCasual);
    return {
      id: typeof m?.id === 'string' && m.id.trim() ? m.id : `m_${idx + 1}`,
      name: typeof m?.name === 'string' ? m.name : `Bạn ${idx + 1}`,
      counts
    };
  });

  const washMode = WASH_MODES[parsed.washMode] ? parsed.washMode : base.washMode;
  const roundingStep = ROUNDING_STEPS.includes(parsed.roundingStep) ? parsed.roundingStep : base.roundingStep;
  const roundingMode = parsed.roundingMode === ROUNDING_MODES.ceil ? ROUNDING_MODES.ceil : ROUNDING_MODES.nearest;
  const hasOtherItems = members.some((m) => (m.counts.other || 0) > 0);

  return {
    schemaVersion: 4,
    washMode,
    totalKg: Math.max(0, Number.parseFloat(parsed.totalKg) || 0),
    totalMoney: Math.max(0, Number.parseInt(parsed.totalMoney, 10) || 0),
    roundingStep,
    roundingMode,
    showOtherCategory: Boolean(parsed.showOtherCategory || hasOtherItems),
    grams: migratedGrams,
    bank: {
      code: typeof parsed.bank?.code === 'string' ? parsed.bank.code.trim() : '',
      accountNo: typeof parsed.bank?.accountNo === 'string' ? parsed.bank.accountNo.trim() : '',
      ownerName: typeof parsed.bank?.ownerName === 'string' ? parsed.bank.ownerName.trim() : ''
    },
    members
  };
}

function getDefaultStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function loadState(storage = getDefaultStorage()) {
  if (!storage) return createDefaultState();
  try {
    const rawV4 = storage.getItem(STORAGE_KEY);
    if (rawV4) {
      return migrateState(JSON.parse(rawV4));
    }
    const rawV3 = storage.getItem(LEGACY_STORAGE_KEY_V3);
    if (rawV3) {
      return migrateState(JSON.parse(rawV3));
    }
  } catch (err) {
    console.warn('Không đọc được localStorage:', err);
  }
  return createDefaultState();
}

export function saveState(state, storage = getDefaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Không lưu được localStorage:', err);
  }
}

/**
 * Pure state transitions so both browser UI and tests share identical mutations.
 */
export const stateActions = {
  setWashMode(state, mode) {
    if (!WASH_MODES[mode]) return state;
    state.washMode = mode;
    if (state.totalKg > 0) {
      state.totalMoney = calculateExpectedBillMoney(state.totalKg, mode).effectiveByRule;
    }
    return state;
  },

  setTotalKg(state, rawKg) {
    const kg = Math.max(0, Number.parseFloat(rawKg) || 0);
    state.totalKg = kg;
    state.totalMoney = kg > 0 ? calculateExpectedBillMoney(kg, state.washMode).effectiveByRule : 0;
    return state;
  },

  setTotalMoney(state, rawMoney) {
    // Only updates bill money; never overwrites measured kg so real scale data stays intact.
    state.totalMoney = Math.max(0, Number.parseInt(rawMoney, 10) || 0);
    return state;
  },

  setRoundingStep(state, step) {
    if (ROUNDING_STEPS.includes(step)) {
      state.roundingStep = step;
    }
    return state;
  },

  setRoundingMode(state, mode) {
    state.roundingMode = mode === ROUNDING_MODES.ceil ? ROUNDING_MODES.ceil : ROUNDING_MODES.nearest;
    return state;
  },

  toggleOtherCategory(state, visible) {
    state.showOtherCategory = typeof visible === 'boolean' ? visible : !state.showOtherCategory;
    return state;
  },

  updateGram(state, catId, val) {
    state.grams[catId] = clampGram(catId, val);
    return state;
  },

  resetDefaultGrams(state) {
    state.grams = getDefaultGrams();
    return state;
  },

  applyLearnedGrams(state, learnedWeights) {
    for (const cat of CLOTHING_CATEGORIES) {
      if (learnedWeights?.[cat.id] !== undefined) {
        state.grams[cat.id] = clampGram(cat.id, Math.round(learnedWeights[cat.id]));
      }
    }
    return state;
  },

  stepMemberCount(state, memberId, catId, delta) {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return state;
    const prev = Math.max(0, Number.parseInt(member.counts[catId] ?? 0, 10) || 0);
    member.counts[catId] = Math.max(0, prev + delta);
    return state;
  },

  setMemberCount(state, memberId, catId, val) {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return state;
    member.counts[catId] = Math.max(0, Number.parseInt(val, 10) || 0);
    return state;
  },

  renameMember(state, memberId, newName) {
    const member = state.members.find((m) => m.id === memberId);
    if (member) member.name = String(newName ?? '');
    return state;
  },

  addMember(state) {
    const n = state.members.length + 1;
    state.members.push({
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Bạn ${n}`,
      counts: buildEmptyCounts({ military: 2, sport: 1, tshirt: 1 })
    });
    return state;
  },

  deleteMember(state, memberId) {
    if (state.members.length <= 1) return state;
    state.members = state.members.filter((m) => m.id !== memberId);
    return state;
  },

  snapshotMemberCounts(state) {
    return state.members.map((m) => ({ id: m.id, counts: { ...m.counts } }));
  },

  resetAllCounts(state) {
    for (const member of state.members) {
      member.counts = buildEmptyCounts();
    }
    return state;
  },

  restoreCountsSnapshot(state, snapshot) {
    if (!Array.isArray(snapshot)) return state;
    const byId = new Map(snapshot.map((item) => [item.id, item.counts]));
    for (const member of state.members) {
      const saved = byId.get(member.id);
      if (saved) {
        member.counts = buildEmptyCounts(saved);
      }
    }
    return state;
  },

  loadSampleBill(state) {
    state.washMode = 'urgent';
    state.totalKg = 3.3;
    state.totalMoney = 56100;
    state.showOtherCategory = false;
    state.members = createSampleMembers();
    return state;
  },

  setBankSettings(state, bank) {
    state.bank = {
      code: String(bank?.code || '').trim(),
      accountNo: String(bank?.accountNo || '').trim(),
      ownerName: String(bank?.ownerName || '').trim()
    };
    return state;
  }
};
