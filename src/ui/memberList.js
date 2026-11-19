import { CLOTHING_CATEGORIES } from '../config/categories.js';
import { fmtVND } from '../core/format.js';
import { escapeHtml } from './domUtils.js';

export function getDisplayedCategories(state) {
  return CLOTHING_CATEGORIES.filter((cat) => cat.isPrimary || state.showOtherCategory);
}

/**
 * Renders the editable gram calibration drawer inputs.
 */
export function renderGramInputs(state) {
  const grid = document.getElementById('gramInputsGrid');
  if (!grid) return;

  const visibleCats = getDisplayedCategories(state);
  grid.innerHTML = visibleCats
    .map(
      (cat) => `
      <div class="bg-white p-2 rounded-lg border border-line">
        <div class="flex items-center justify-between gap-1">
          <span class="text-[11px] font-bold text-ink truncate" title="${escapeHtml(cat.hint)}">${escapeHtml(cat.name)}</span>
          <span class="text-[10px] font-mono text-muted">≥${cat.minGram}</span>
        </div>
        <div class="mt-1 flex items-center gap-1">
          <input type="number" min="10" max="3000" step="5"
            data-action="gram-input" data-cat-id="${cat.id}"
            value="${state.grams[cat.id]}"
            class="w-full px-1.5 py-1 rounded border border-line font-mono text-xs font-bold text-right text-ink focus:outline-none focus:ring-1 focus:ring-emerald-600" />
          <span class="font-mono text-[10px] text-muted">g</span>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * Renders the room-wide category totals strip so users can cross-check against the paper receipt.
 */
export function renderRoomTotalsStrip(calc) {
  const strip = document.getElementById('roomTotalsStrip');
  if (!strip) return;

  if (!calc.hasItems) {
    strip.innerHTML =
      '<span class="text-muted">Tổng đồ cả phòng: <strong class="text-ink">0 cái</strong> — bấm + hoặc gõ số để nhập đồ từng bạn.</span>';
    return;
  }

  const chips = CLOTHING_CATEGORIES.filter((cat) => (calc.categoryTotals[cat.id] || 0) > 0)
    .map(
      (cat) =>
        `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-line font-mono text-[11px] font-bold text-ink">${calc.categoryTotals[cat.id]} <span class="font-sans font-semibold text-muted">${escapeHtml(cat.short)}</span></span>`
    )
    .join('');

  strip.innerHTML = `
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="font-bold text-ink mr-0.5">Đối chiếu cả phòng:</span>
      ${chips}
    </div>
    <span class="font-mono text-[11px] font-extrabold text-emerald-700 shrink-0">
      Tổng: ${calc.totalItems} cái (~${calc.estimatedKg.toFixed(2)} kg)
    </span>
  `;
}

/**
 * Full structural render of all member cards (used when adding/removing members or stepping counts).
 */
export function renderMemberCards(state, calc) {
  renderRoomTotalsStrip(calc);
  const container = document.getElementById('membersContainer');
  if (!container) return;

  const visibleCats = getDisplayedCategories(state);
  const toggleOtherBtn = document.getElementById('toggleOtherBtn');
  if (toggleOtherBtn) {
    toggleOtherBtn.setAttribute('aria-pressed', String(Boolean(state.showOtherCategory)));
    toggleOtherBtn.className = state.showOtherCategory
      ? 'px-2.5 py-1.5 rounded-lg border border-emerald-500 bg-emerald-50 text-xs font-bold text-emerald-800 transition inline-flex items-center gap-1 cursor-pointer'
      : 'px-2.5 py-1.5 rounded-lg border border-line bg-white hover:bg-slate-50 text-xs font-semibold text-muted hover:text-ink transition inline-flex items-center gap-1 cursor-pointer';
  }

  container.innerHTML = state.members
    .map((member, idx) => {
      const res = calc.results[idx] || { items: 0, pct: 0, finalMoney: 0, color: '#059669' };

      const tilesHtml = visibleCats
        .map((cat) => {
          const count = member.counts[cat.id] || 0;
          const active = count > 0;
          const tileClass = active
            ? 'p-2 rounded-xl border border-emerald-500/60 bg-emerald-50/40 transition'
            : 'p-2 rounded-xl border border-line bg-slate-50/70 transition';

          return `
            <div class="${tileClass}" data-tile-member="${escapeHtml(member.id)}" data-tile-cat="${cat.id}">
              <div class="flex items-center justify-between gap-1 mb-1.5">
                <span class="text-[11px] font-bold text-ink truncate" title="${escapeHtml(cat.hint)}">${escapeHtml(cat.name)}</span>
                <span class="font-mono text-[10px] text-muted" data-gram-label="${cat.id}">${state.grams[cat.id]}g</span>
              </div>
              <div class="flex items-center justify-between">
                <button type="button" data-action="step-count" data-member-id="${escapeHtml(member.id)}" data-cat-id="${cat.id}" data-delta="-1"
                  aria-label="Giảm ${escapeHtml(cat.name)} cho ${escapeHtml(member.name)}"
                  class="w-7 h-7 rounded-lg border border-line bg-white hover:bg-slate-100 active:scale-95 font-mono font-bold text-sm text-ink flex items-center justify-center select-none cursor-pointer">
                  -
                </button>
                <input type="number" min="0" max="99"
                  data-action="set-count" data-member-id="${escapeHtml(member.id)}" data-cat-id="${cat.id}"
                  value="${count}"
                  aria-label="Số lượng ${escapeHtml(cat.name)} của ${escapeHtml(member.name)}"
                  class="w-9 text-center font-mono text-sm font-extrabold bg-transparent text-ink focus:outline-none tabular-nums" />
                <button type="button" data-action="step-count" data-member-id="${escapeHtml(member.id)}" data-cat-id="${cat.id}" data-delta="1"
                  aria-label="Tăng ${escapeHtml(cat.name)} cho ${escapeHtml(member.name)}"
                  class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 font-mono font-bold text-sm text-white flex items-center justify-center select-none cursor-pointer">
                  +
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      const deleteBtn = state.members.length > 1
        ? `<button type="button" data-action="delete-member" data-member-id="${escapeHtml(member.id)}"
             class="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Xóa người này">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
             </svg>
           </button>`
        : '';

      return `
        <div class="p-3.5 rounded-xl border border-line bg-white hover:border-slate-300 transition" data-member-card="${escapeHtml(member.id)}">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div class="flex items-center gap-2 flex-1 min-w-[160px]">
              <span class="w-2.5 h-6 rounded-full shrink-0" style="background-color: ${res.color}"></span>
              <input type="text"
                data-action="rename-member" data-member-id="${escapeHtml(member.id)}"
                value="${escapeHtml(member.name)}"
                placeholder="Nhập tên..."
                class="font-bold text-sm text-ink bg-transparent border-b border-transparent hover:border-line focus:border-emerald-600 focus:outline-none px-1 py-0.5 w-full max-w-[210px]" />
            </div>

            <div class="flex items-center gap-2">
              <div class="font-mono text-xs bg-slate-50 border border-line px-2.5 py-1 rounded-lg flex items-center gap-2">
                <span class="text-muted" data-member-items="${escapeHtml(member.id)}">${res.items} cái</span>
                <span class="font-bold text-emerald-700" data-member-pct="${escapeHtml(member.id)}">${res.pct.toFixed(1)}%</span>
                <span class="font-extrabold text-ink border-l border-line pl-2" data-member-money="${escapeHtml(member.id)}">${fmtVND(res.finalMoney)}</span>
              </div>
              ${deleteBtn}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            ${tilesHtml}
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Updates badges, active tile highlights, and gram labels in place without losing input focus.
 */
export function patchMemberCards(state, calc) {
  renderRoomTotalsStrip(calc);
  const visibleCats = getDisplayedCategories(state);

  state.members.forEach((member, idx) => {
    const res = calc.results[idx];
    if (!res) return;

    const itemsEl = document.querySelector(`[data-member-items="${CSS.escape(member.id)}"]`);
    const pctEl = document.querySelector(`[data-member-pct="${CSS.escape(member.id)}"]`);
    const moneyEl = document.querySelector(`[data-member-money="${CSS.escape(member.id)}"]`);

    if (itemsEl) itemsEl.textContent = `${res.items} cái`;
    if (pctEl) pctEl.textContent = `${res.pct.toFixed(1)}%`;
    if (moneyEl) moneyEl.textContent = fmtVND(res.finalMoney);

    for (const cat of visibleCats) {
      const tile = document.querySelector(
        `[data-tile-member="${CSS.escape(member.id)}"][data-tile-cat="${cat.id}"]`
      );
      if (tile) {
        const active = (member.counts[cat.id] || 0) > 0;
        tile.className = active
          ? 'p-2 rounded-xl border border-emerald-500/60 bg-emerald-50/40 transition'
          : 'p-2 rounded-xl border border-line bg-slate-50/70 transition';
      }
    }
  });

  for (const cat of visibleCats) {
    document.querySelectorAll(`[data-gram-label="${cat.id}"]`).forEach((el) => {
      el.textContent = `${state.grams[cat.id]}g`;
    });
  }
}
