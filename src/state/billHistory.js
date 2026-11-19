import { CLOTHING_CATEGORIES } from '../config/categories.js';

export const HISTORY_STORAGE_KEY = 'laundry_split_bill_history_v1';

function getDefaultStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function normalizeCounts(rawCounts = {}) {
  const counts = {};
  for (const cat of CLOTHING_CATEGORIES) {
    counts[cat.id] = Math.max(0, Number.parseInt(rawCounts[cat.id] ?? 0, 10) || 0);
  }
  // Support importing legacy v3 schema keys cleanly
  if (rawCounts.tshirt === undefined && rawCounts.casualLight !== undefined) {
    counts.tshirt = Math.max(0, Number.parseInt(rawCounts.casualLight, 10) || 0);
  }
  if (rawCounts.longPants === undefined && rawCounts.casualHeavy !== undefined) {
    counts.longPants = Math.max(0, Number.parseInt(rawCounts.casualHeavy, 10) || 0);
  }
  return counts;
}

function sanitizeBillRecord(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const actualKg = Number.parseFloat(raw.actualKg);
  if (!Number.isFinite(actualKg) || actualKg <= 0) return null;

  const counts = normalizeCounts(raw.counts || {});
  const totalItems = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (totalItems <= 0) return null;

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `bill_${Date.now()}_${idx}`,
    date: typeof raw.date === 'string' && raw.date.trim() ? raw.date.trim() : new Date().toISOString().slice(0, 10),
    washMode: raw.washMode === 'normal' ? 'normal' : 'urgent',
    actualKg: Number(actualKg.toFixed(2)),
    actualMoney: Math.max(0, Number.parseInt(raw.actualMoney ?? 0, 10) || 0),
    totalItems,
    counts,
    excludeFromTrain: Boolean(raw.excludeFromTrain),
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 120) : ''
  };
}

/**
 * Creates a strictly anonymized bill snapshot (no member names or bank details).
 */
export function createBillSnapshot(state, calc, { excludeFromTrain = false, note = '' } = {}) {
  const actualKg = Number.parseFloat(state.totalKg);
  if (!Number.isFinite(actualKg) || actualKg <= 0 || !calc?.hasItems) {
    return null;
  }

  return sanitizeBillRecord({
    id: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString().slice(0, 10),
    washMode: state.washMode,
    actualKg,
    actualMoney: state.totalMoney,
    counts: { ...calc.categoryTotals },
    excludeFromTrain,
    note
  });
}

export function loadBillHistory(storage = getDefaultStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, idx) => sanitizeBillRecord(item, idx)).filter(Boolean);
  } catch (err) {
    console.warn('Không đọc được lịch sử hóa đơn:', err);
    return [];
  }
}

export function saveBillHistory(history, storage = getDefaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn('Không lưu được lịch sử hóa đơn:', err);
  }
}

export function addBillToHistory(history, snapshot) {
  if (!snapshot) return history;
  return [snapshot, ...history];
}

export function toggleExcludeBill(history, billId) {
  return history.map((bill) =>
    bill.id === billId ? { ...bill, excludeFromTrain: !bill.excludeFromTrain } : bill
  );
}

export function deleteBillFromHistory(history, billId) {
  return history.filter((bill) => bill.id !== billId);
}

/**
 * Exports anonymized bill records suitable for sharing or offline training.
 */
export function exportAnonymizedHistoryJson(history) {
  const payload = history.map((bill) => ({
    date: bill.date,
    washMode: bill.washMode,
    actualKg: bill.actualKg,
    actualMoney: bill.actualMoney,
    counts: bill.counts,
    excludeFromTrain: bill.excludeFromTrain,
    ...(bill.note ? { note: bill.note } : {})
  }));
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports anonymized bill records from a JSON string, skipping invalid entries.
 */
export function importAnonymizedHistoryJson(jsonText, existingHistory = []) {
  const parsed = JSON.parse(jsonText);
  const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bills) ? parsed.bills : null;
  if (!rawList) {
    throw new Error('File JSON không đúng định dạng mảng hóa đơn.');
  }

  const existingKeys = new Set(
    existingHistory.map((b) => `${b.date}|${b.actualKg}|${b.actualMoney}|${JSON.stringify(b.counts)}`)
  );

  const merged = [...existingHistory];
  let importedCount = 0;
  let skippedCount = 0;

  rawList.forEach((item, idx) => {
    const clean = sanitizeBillRecord(item, idx);
    if (!clean) {
      skippedCount += 1;
      return;
    }
    const sig = `${clean.date}|${clean.actualKg}|${clean.actualMoney}|${JSON.stringify(clean.counts)}`;
    if (existingKeys.has(sig)) {
      skippedCount += 1;
      return;
    }
    existingKeys.add(sig);
    merged.push(clean);
    importedCount += 1;
  });

  return { history: merged, importedCount, skippedCount };
}
