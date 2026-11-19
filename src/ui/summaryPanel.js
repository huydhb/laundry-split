import { ROUNDING_MODES, ROUNDING_STEPS } from '../config/pricing.js';
import { fmtVND } from '../core/format.js';
import { supportsVietQr } from '../core/vietqr.js';
import { buildZaloMessage } from '../core/zaloFormatter.js';
import { escapeHtml } from './domUtils.js';

/**
 * Renders the right-hand summary panel, payout cards, proportion bar, and Zalo message.
 */
export function renderSummaryPanel(state, calc) {
  for (const step of ROUNDING_STEPS) {
    const btn = document.getElementById(`roundStepBtn-${step}`);
    if (!btn) continue;
    btn.className = state.roundingStep === step
      ? 'px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-900 text-white transition cursor-pointer'
      : 'px-2.5 py-1 rounded-md text-xs font-mono font-semibold text-muted hover:text-ink transition cursor-pointer';
  }

  const modeNearestBtn = document.getElementById('roundModeNearestBtn');
  const modeCeilBtn = document.getElementById('roundModeCeilBtn');
  if (modeNearestBtn && modeCeilBtn) {
    const isCeil = state.roundingMode === ROUNDING_MODES.ceil;
    modeNearestBtn.className = !isCeil
      ? 'px-2 py-0.5 rounded text-[11px] font-bold bg-white text-ink shadow-2xs transition cursor-pointer'
      : 'px-2 py-0.5 rounded text-[11px] font-semibold text-muted hover:text-ink transition cursor-pointer';
    modeCeilBtn.className = isCeil
      ? 'px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white shadow-2xs transition cursor-pointer'
      : 'px-2 py-0.5 rounded text-[11px] font-semibold text-muted hover:text-ink transition cursor-pointer';
  }

  const headerTotal = document.getElementById('outHeaderTotalMoney');
  const summaryItems = document.getElementById('outSummaryItems');
  const summaryKg = document.getElementById('outSummaryKg');
  const summaryCollected = document.getElementById('outSummaryCollected');

  if (headerTotal) headerTotal.textContent = fmtVND(calc.billMoney);
  if (summaryItems) summaryItems.textContent = `${calc.totalItems} cái`;
  if (summaryKg) summaryKg.textContent = `${calc.billKg.toFixed(2)} kg`;
  if (summaryCollected) summaryCollected.textContent = fmtVND(calc.targetCollected);

  const bar = document.getElementById('proportionBar');
  if (bar) {
    if (!calc.hasItems) {
      bar.innerHTML = '<div class="w-full h-full bg-slate-200"></div>';
    } else {
      bar.innerHTML = calc.results
        .filter((r) => r.grams > 0)
        .map(
          (r) =>
            `<div style="width:${r.pct}%;background-color:${r.color}" class="h-full transition-all duration-300" title="${escapeHtml(r.name)}: ${r.pct.toFixed(1)}%"></div>`
        )
        .join('');
    }
  }

  const listEl = document.getElementById('payoutCardsList');
  const hasBank = Boolean(state.bank.code && state.bank.accountNo);
  const canVietQr = hasBank && supportsVietQr(state.bank.code);

  if (listEl) {
    listEl.innerHTML = calc.results
      .map((r) => {
        const qrBtn = canVietQr && r.finalMoney > 0
          ? `<button type="button" data-action="open-qr" data-member-id="${escapeHtml(r.id)}"
               class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-bold transition cursor-pointer">
               Mã QR
             </button>`
          : '';

        return `
          <div class="p-3 rounded-xl border border-line bg-slate-50/60 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color:${r.color}"></span>
                <span class="font-extrabold text-sm text-ink truncate">${escapeHtml(r.name)}</span>
                <span class="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-white border border-line text-muted">
                  ${r.pct.toFixed(1)}%
                </span>
              </div>
              <div class="text-xs text-muted mt-1 pl-4">
                ${r.items} cái (${escapeHtml(r.detailsText)}) • ~${r.allocatedKg.toFixed(2)} kg
              </div>
            </div>

            <div class="text-right shrink-0 flex flex-col items-end gap-1">
              <div class="font-mono text-base sm:text-lg font-extrabold text-emerald-700 tabular-nums">
                ${fmtVND(r.finalMoney)}
              </div>
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-[10px] text-muted">Tỷ lệ: ${fmtVND(r.exactMoney)}</span>
                ${qrBtn}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  const momoNotice = document.getElementById('momoQrNotice');
  if (momoNotice) {
    momoNotice.classList.toggle('hidden', state.bank.code !== 'MOMO');
  }

  const bankPreview = document.getElementById('bankPreviewLabel');
  if (bankPreview) {
    bankPreview.textContent = hasBank
      ? `${state.bank.code} • ${state.bank.accountNo}`
      : 'Chưa cài STK (bấm để nhập)';
  }

  const footnote = document.getElementById('roundingFootnote');
  if (footnote) {
    if (!calc.hasItems) {
      footnote.innerHTML = 'Nhập số lượng quần áo từng bạn ở cột trái để bắt đầu chia tỷ lệ tiền.';
    } else {
      const diffBill = calc.targetCollected - calc.billMoney;
      if (diffBill !== 0 && calc.billMoney > 0) {
        const sign = diffBill > 0 ? '+' : '';
        footnote.innerHTML = `Bill gốc <strong>${fmtVND(calc.billMoney)}</strong> chia chẵn thành <strong>${fmtVND(calc.targetCollected)}</strong> (${sign}${fmtVND(diffBill)}). Tổng từng bạn cộng lại khớp 100% mục tiêu thu.`;
      } else {
        footnote.innerHTML = `Tổng tiền các thành viên cộng lại khớp đúng <strong>${fmtVND(calc.targetCollected)}</strong> (100% hóa đơn).`;
      }
    }
  }

  const zaloBox = document.getElementById('zaloTextBox');
  if (zaloBox) {
    zaloBox.value = buildZaloMessage(calc, state.bank);
  }

  const stickyTotal = document.getElementById('mobileStickyTotal');
  const stickyMeta = document.getElementById('mobileStickyMeta');
  if (stickyTotal) stickyTotal.textContent = fmtVND(calc.billMoney);
  if (stickyMeta) stickyMeta.textContent = `${calc.totalItems} cái • ${calc.billKg.toFixed(2)} kg`;
}

/**
 * Syncs bank input fields once on startup or external reset without disturbing typing.
 */
export function syncBankInputs(state) {
  const codeEl = document.getElementById('bankCodeSelect');
  const accEl = document.getElementById('bankAccountNo');
  const ownerEl = document.getElementById('bankOwnerName');

  if (codeEl && document.activeElement !== codeEl) codeEl.value = state.bank.code || '';
  if (accEl && document.activeElement !== accEl) accEl.value = state.bank.accountNo || '';
  if (ownerEl && document.activeElement !== ownerEl) ownerEl.value = state.bank.ownerName || '';
}
