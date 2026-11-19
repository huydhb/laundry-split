import { CLOTHING_CATEGORIES } from '../config/categories.js';
import { fmtVND } from '../core/format.js';
import { trainWeights } from '../core/weightLearner.js';
import { escapeHtml } from './domUtils.js';

const CONFIDENCE_LABELS = {
  high: { text: 'Cao', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { text: 'Trung bình', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  low: { text: 'Ít mẫu', cls: 'bg-slate-100 text-muted border-line' }
};

function formatBillItemsSummary(counts = {}) {
  return CLOTHING_CATEGORIES.filter((cat) => (counts[cat.id] || 0) > 0)
    .map((cat) => `${counts[cat.id]} ${cat.short}`)
    .join(', ');
}

export function renderHistoryBadge(history) {
  const badge = document.getElementById('historyCountBadge');
  if (badge) {
    badge.textContent = String(history.length);
  }
}

export function openCalibrationModal(state, history) {
  const report = renderCalibrationContent(state, history);
  document.getElementById('calibrationModal')?.classList.remove('hidden');
  return report;
}

export function closeCalibrationModal() {
  document.getElementById('calibrationModal')?.classList.add('hidden');
}

/**
 * Computes LOOCV training report from history and renders the calibration modal UI.
 * Returns the computed report so the controller can apply learned weights on click.
 */
export function renderCalibrationContent(state, history) {
  renderHistoryBadge(history);
  const report = trainWeights(history);

  const validEl = document.getElementById('calValidCount');
  const defMaeEl = document.getElementById('calDefaultMae');
  const learnedMaeEl = document.getElementById('calLearnedMae');
  const bannerEl = document.getElementById('calRecommendationBanner');
  const applyBtn = document.getElementById('applyLearnedWeightsBtn');

  if (validEl) validEl.textContent = `${report.validBillsCount} bill`;
  if (defMaeEl) defMaeEl.textContent = `${report.defaultMaeGrams}g (${report.defaultMapePct}%)`;
  if (learnedMaeEl) learnedMaeEl.textContent = `${report.learnedMaeGrams}g (${report.learnedMapePct}%)`;

  if (bannerEl) {
    if (report.validBillsCount < report.minBillsToRecommend) {
      bannerEl.className = 'p-3 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900';
      bannerEl.innerHTML = `Hiện có <strong>${report.validBillsCount}/${report.minBillsToRecommend}</strong> bill hợp lệ. Hãy bấm <strong>"Lưu Bill này"</strong> sau mỗi lần giặt để đủ dữ liệu đánh giá chéo LOOCV (tránh học lệch từ ít mẫu).`;
    } else if (report.improved) {
      const savedGrams = report.defaultMaeGrams - report.learnedMaeGrams;
      bannerEl.className = 'p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-xs text-emerald-900';
      bannerEl.innerHTML = `✓ Kiểm định chéo LOOCV giảm sai số trung bình <strong>${savedGrams}g/bill</strong> (${report.defaultMaeGrams}g → ${report.learnedMaeGrams}g). Khuyến nghị áp dụng định mức mới!`;
    } else {
      bannerEl.className = 'p-3 rounded-xl border border-line bg-slate-50 text-xs text-muted';
      bannerEl.innerHTML = `Định mức mặc định hiện tại đã sát thực tế (LOOCV ${report.learnedMaeGrams}g vs Mặc định ${report.defaultMaeGrams}g). Chưa cần thay đổi trọng số.`;
    }
  }

  if (applyBtn) {
    applyBtn.disabled = !report.improved;
    applyBtn.className = report.improved
      ? 'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer'
      : 'px-4 py-2 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed';
  }

  const tableBody = document.getElementById('calWeightsTableBody');
  if (tableBody) {
    tableBody.innerHTML = report.categoryStats
      .map((row) => {
        const conf = CONFIDENCE_LABELS[row.confidence] || CONFIDENCE_LABELS.low;
        const deltaStr = row.deltaGram > 0 ? `+${row.deltaGram}g` : row.deltaGram < 0 ? `${row.deltaGram}g` : '0g';
        const deltaCls = row.deltaGram > 0 ? 'text-emerald-700' : row.deltaGram < 0 ? 'text-amber-700' : 'text-muted';
        const currentVal = state.grams[row.id] ?? row.priorGram;

        return `
          <tr class="border-t border-line">
            <td class="py-2 pr-2 font-semibold text-ink">${escapeHtml(row.name)}</td>
            <td class="py-2 px-2 text-center font-mono text-muted">${row.billAppearances}</td>
            <td class="py-2 px-2 text-right font-mono text-muted">${currentVal}g</td>
            <td class="py-2 px-2 text-right font-mono font-bold text-ink">
              ${row.learnedGram}g <span class="text-[10px] ${deltaCls}">(${deltaStr})</span>
            </td>
            <td class="py-2 pl-2 text-right">
              <span class="inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${conf.cls}">${conf.text}</span>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  const listEl = document.getElementById('calHistoryList');
  if (listEl) {
    if (history.length === 0) {
      listEl.innerHTML =
        '<div class="p-4 text-center text-xs text-muted border border-dashed border-line rounded-xl">Chưa có hóa đơn nào được lưu. Bấm "Lưu Bill này" ở khối Thông tin hóa đơn để bắt đầu tích lũy.</div>';
    } else {
      listEl.innerHTML = history
        .map((bill) => {
          const modeLabel = bill.washMode === 'normal' ? 'Thường' : 'Khẩn';
          const itemsStr = formatBillItemsSummary(bill.counts);
          const trainBadge = bill.excludeFromTrain
            ? '<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">Bỏ qua (ẩm/bất thường)</span>'
            : '<span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">Đưa vào train</span>';

          return `
            <div class="p-2.5 rounded-xl border border-line bg-white flex items-center justify-between gap-2 text-xs">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-mono font-bold text-ink">${bill.actualKg.toFixed(2)} kg</span>
                  <span class="text-muted">• ${fmtVND(bill.actualMoney)}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-muted font-semibold">${modeLabel}</span>
                  <span class="font-mono text-[10px] text-muted">${escapeHtml(bill.date)}</span>
                  ${trainBadge}
                </div>
                <div class="text-[11px] text-muted truncate mt-1">${bill.totalItems} cái (${escapeHtml(itemsStr)})</div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-action="toggle-bill-exclude" data-bill-id="${escapeHtml(bill.id)}"
                  class="px-2 py-1 rounded-lg border border-line hover:bg-slate-50 text-[11px] font-semibold text-ink cursor-pointer"
                  title="Bật/tắt đưa bill này vào tập train">
                  ${bill.excludeFromTrain ? 'Dùng train' : 'Loại trừ'}
                </button>
                <button type="button" data-action="delete-history-bill" data-bill-id="${escapeHtml(bill.id)}"
                  class="px-2 py-1 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                  title="Xóa bill khỏi lịch sử">
                  ×
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  return report;
}
