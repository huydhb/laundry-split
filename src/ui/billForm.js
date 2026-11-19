import { getWashModeConfig } from '../config/pricing.js';
import { fmtVND } from '../core/format.js';

/**
 * Syncs input field values in Section 1 from state without overwriting focused inputs.
 */
export function syncBillInputs(state) {
  const kgEl = document.getElementById('inputTotalKg');
  const moneyEl = document.getElementById('inputTotalMoney');

  if (kgEl && document.activeElement !== kgEl) {
    kgEl.value = state.totalKg;
  }
  if (moneyEl && document.activeElement !== moneyEl) {
    moneyEl.value = state.totalMoney;
  }
}

/**
 * Renders wash mode buttons, formula hint, and bill reconciliation status bar.
 */
export function renderBillForm(state, calc) {
  const btnNormal = document.getElementById('modeBtnNormal');
  const btnUrgent = document.getElementById('modeBtnUrgent');
  const chip = document.getElementById('priceRuleChip');

  const normalActive = state.washMode === 'normal';
  if (btnNormal && btnUrgent && chip) {
    btnNormal.className = normalActive
      ? 'p-3.5 rounded-xl border-2 border-emerald-600 bg-emerald-50/60 text-left transition flex items-center justify-between gap-2 cursor-pointer'
      : 'p-3.5 rounded-xl border border-line bg-white hover:bg-slate-50 opacity-85 text-left transition flex items-center justify-between gap-2 cursor-pointer';

    btnUrgent.className = !normalActive
      ? 'p-3.5 rounded-xl border-2 border-amber-500 bg-amber-50/70 text-left transition flex items-center justify-between gap-2 cursor-pointer'
      : 'p-3.5 rounded-xl border border-line bg-white hover:bg-slate-50 opacity-85 text-left transition flex items-center justify-between gap-2 cursor-pointer';

    const modeCfg = getWashModeConfig(state.washMode);
    chip.className = normalActive
      ? 'font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200';
    chip.textContent = modeCfg.ruleText;
  }

  const hintKgEl = document.getElementById('hintEstimatedKg');
  if (hintKgEl) hintKgEl.textContent = calc.estimatedKg.toFixed(2);

  const formulaHint = document.getElementById('moneyFormulaHint');
  if (formulaHint) {
    if (calc.billKg > 0 && calc.appliedFloor) {
      formulaHint.textContent = `${calc.billKg} kg → Áp mức sàn tối thiểu ${fmtVND(calc.minFloor)}`;
    } else {
      formulaHint.textContent = `${calc.billKg} kg × ${calc.ratePerKg.toLocaleString('vi-VN')}đ/kg = ${fmtVND(calc.expectedByRate)}`;
    }
  }

  const recLeft = document.getElementById('reconcileLeftText');
  const recRight = document.getElementById('reconcileRightText');
  const recBar = document.getElementById('billReconcileBar');
  const diffMoney = calc.billMoney - calc.effectiveByRule;

  if (recLeft && recBar) {
    if (Math.abs(diffMoney) <= 100) {
      recBar.className = 'mt-3.5 px-3.5 py-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs';
      recLeft.className = 'font-semibold text-emerald-900';
      recLeft.textContent = `✓ Khớp bảng giá: ${calc.billKg.toFixed(2)} kg → ${fmtVND(calc.billMoney)}`;
    } else {
      const sign = diffMoney > 0 ? '+' : '';
      recBar.className = 'mt-3.5 px-3.5 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs';
      recLeft.className = 'font-semibold text-amber-900';
      recLeft.textContent = `Bill thực tế: ${fmtVND(calc.billMoney)} (Chênh ${sign}${fmtVND(diffMoney)} so với ${fmtVND(calc.effectiveByRule)})`;
    }
  }

  if (recRight) {
    recRight.textContent = `Tổng đồ: ${calc.totalItems} cái (~${calc.estimatedKg.toFixed(2)} kg)`;
  }
}
