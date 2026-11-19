import './styles/main.css';
import { computeSplit } from './core/splitEngine.js';
import {
  addBillToHistory,
  createBillSnapshot,
  deleteBillFromHistory,
  exportAnonymizedHistoryJson,
  importAnonymizedHistoryJson,
  loadBillHistory,
  saveBillHistory,
  toggleExcludeBill
} from './state/billHistory.js';
import { loadState, saveState, stateActions } from './state/store.js';
import { renderBillForm, syncBillInputs } from './ui/billForm.js';
import {
  closeCalibrationModal,
  openCalibrationModal,
  renderCalibrationContent,
  renderHistoryBadge
} from './ui/calibrationModal.js';
import { copyToClipboard, showToast } from './ui/domUtils.js';
import { patchMemberCards, renderGramInputs, renderMemberCards } from './ui/memberList.js';
import { closeQrModal, openQrModal } from './ui/qrModal.js';
import { renderSummaryPanel, syncBankInputs } from './ui/summaryPanel.js';

let appState = loadState();
let billHistory = loadBillHistory();
let latestCalc = null;
let latestCalReport = null;

function renderAll({ fullMembers = true, syncInputs = false } = {}) {
  saveState(appState);
  latestCalc = computeSplit(appState);

  if (syncInputs) {
    syncBillInputs(appState);
    syncBankInputs(appState);
  }

  renderBillForm(appState, latestCalc);
  if (fullMembers) {
    renderMemberCards(appState, latestCalc);
  } else {
    patchMemberCards(appState, latestCalc);
  }
  renderSummaryPanel(appState, latestCalc);
}

function handleActionClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const { action, memberId, catId, delta, mode, step } = target.dataset;

  if (action === 'set-wash-mode') {
    stateActions.setWashMode(appState, mode);
    renderAll({ fullMembers: false, syncInputs: true });
    return;
  }

  if (action === 'step-count') {
    stateActions.stepMemberCount(appState, memberId, catId, Number(delta));
    renderAll({ fullMembers: true });
    return;
  }

  if (action === 'delete-member') {
    stateActions.deleteMember(appState, memberId);
    renderAll({ fullMembers: true });
    return;
  }

  if (action === 'set-round-step') {
    stateActions.setRoundingStep(appState, Number(step));
    renderAll({ fullMembers: false });
    return;
  }

  if (action === 'set-round-mode') {
    stateActions.setRoundingMode(appState, mode);
    renderAll({ fullMembers: false });
    return;
  }

  if (action === 'open-qr' && latestCalc) {
    const memberRes = latestCalc.results.find((r) => r.id === memberId);
    if (memberRes) openQrModal(appState, memberRes.name, memberRes.finalMoney);
    return;
  }

  if (action === 'close-qr') {
    closeQrModal();
    return;
  }

  if (action === 'close-calibration') {
    closeCalibrationModal();
    return;
  }

  if (action === 'toggle-bill-exclude') {
    billHistory = toggleExcludeBill(billHistory, target.dataset.billId);
    saveBillHistory(billHistory);
    latestCalReport = renderCalibrationContent(appState, billHistory);
    return;
  }

  if (action === 'delete-history-bill') {
    billHistory = deleteBillFromHistory(billHistory, target.dataset.billId);
    saveBillHistory(billHistory);
    latestCalReport = renderCalibrationContent(appState, billHistory);
  }
}

function handleMembersInput(event) {
  const target = event.target;
  const action = target.dataset?.action;
  if (!action) return;

  if (action === 'set-count') {
    stateActions.setMemberCount(appState, target.dataset.memberId, target.dataset.catId, target.value);
    renderAll({ fullMembers: false });
  } else if (action === 'rename-member') {
    stateActions.renameMember(appState, target.dataset.memberId, target.value);
    renderAll({ fullMembers: false });
  }
}

function bindEvents() {
  document.addEventListener('click', handleActionClick);

  document.getElementById('inputTotalKg')?.addEventListener('input', (e) => {
    stateActions.setTotalKg(appState, e.target.value);
    renderAll({ fullMembers: false, syncInputs: true });
  });

  document.getElementById('inputTotalMoney')?.addEventListener('input', (e) => {
    stateActions.setTotalMoney(appState, e.target.value);
    renderAll({ fullMembers: false });
  });

  document.getElementById('syncKgBtn')?.addEventListener('click', () => {
    if (!latestCalc) return;
    const est = Number(latestCalc.estimatedKg.toFixed(2));
    stateActions.setTotalKg(appState, est);
    renderAll({ fullMembers: false, syncInputs: true });
  });

  document.getElementById('syncMoneyBtn')?.addEventListener('click', () => {
    stateActions.setTotalKg(appState, appState.totalKg);
    renderAll({ fullMembers: false, syncInputs: true });
  });

  document.getElementById('loadSampleBtn')?.addEventListener('click', () => {
    stateActions.loadSampleBill(appState);
    renderGramInputs(appState);
    renderAll({ fullMembers: true, syncInputs: true });
    showToast('Đã nạp dữ liệu mẫu (3.3kg - 56.100đ)', { durationMs: 2500 });
  });

  document.getElementById('toggleOtherBtn')?.addEventListener('click', () => {
    stateActions.toggleOtherCategory(appState);
    renderGramInputs(appState);
    renderAll({ fullMembers: true });
  });

  document.getElementById('toggleGramBtn')?.addEventListener('click', () => {
    document.getElementById('gramSettingsDrawer')?.classList.toggle('hidden');
  });

  document.getElementById('resetDefaultGramsBtn')?.addEventListener('click', () => {
    stateActions.resetDefaultGrams(appState);
    renderGramInputs(appState);
    renderAll({ fullMembers: false });
  });

  document.getElementById('gramInputsGrid')?.addEventListener('input', (e) => {
    const target = e.target;
    if (target.dataset?.action === 'gram-input') {
      stateActions.updateGram(appState, target.dataset.catId, target.value);
      renderAll({ fullMembers: false });
    }
  });

  document.getElementById('membersContainer')?.addEventListener('input', handleMembersInput);

  document.getElementById('addMemberBtn')?.addEventListener('click', () => {
    stateActions.addMember(appState);
    renderAll({ fullMembers: true });
  });

  document.getElementById('resetCountsBtn')?.addEventListener('click', () => {
    const snapshot = stateActions.snapshotMemberCounts(appState);
    stateActions.resetAllCounts(appState);
    renderAll({ fullMembers: true });
    showToast('Đã xóa số đồ của mọi người về 0.', {
      actionLabel: 'Hoàn tác',
      onAction: () => {
        stateActions.restoreCountsSnapshot(appState, snapshot);
        renderAll({ fullMembers: true });
      }
    });
  });

  document.getElementById('toggleBankBtn')?.addEventListener('click', () => {
    const body = document.getElementById('bankDrawerBody');
    const arrow = document.getElementById('bankDrawerArrow');
    if (!body) return;
    const willOpen = body.classList.contains('hidden');
    body.classList.toggle('hidden', !willOpen);
    arrow?.classList.toggle('rotate-180', willOpen);
  });

  const handleBankChange = () => {
    stateActions.setBankSettings(appState, {
      code: document.getElementById('bankCodeSelect')?.value || '',
      accountNo: document.getElementById('bankAccountNo')?.value || '',
      ownerName: document.getElementById('bankOwnerName')?.value || ''
    });
    renderAll({ fullMembers: false });
  };

  document.getElementById('bankCodeSelect')?.addEventListener('change', handleBankChange);
  document.getElementById('bankAccountNo')?.addEventListener('input', handleBankChange);
  document.getElementById('bankOwnerName')?.addEventListener('input', handleBankChange);

  const triggerCopyZalo = async () => {
    const box = document.getElementById('zaloTextBox');
    if (!box) return;
    const copied = await copyToClipboard(box.value);
    if (copied) {
      const toast = document.getElementById('copiedToast');
      toast?.classList.remove('hidden');
      setTimeout(() => toast?.classList.add('hidden'), 2500);
      showToast('Đã copy tin nhắn báo tiền Zalo!', { durationMs: 2200 });
    }
  };

  document.getElementById('copyZaloBtn')?.addEventListener('click', triggerCopyZalo);
  document.getElementById('mobileCopyZaloBtn')?.addEventListener('click', triggerCopyZalo);
  document.getElementById('mobileJumpResultsBtn')?.addEventListener('click', () => {
    document.getElementById('resultsColumn')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('vietQrModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'vietQrModal') closeQrModal();
  });

  document.getElementById('calibrationModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'calibrationModal') closeCalibrationModal();
  });

  document.getElementById('openCalibrationBtn')?.addEventListener('click', () => {
    latestCalReport = openCalibrationModal(appState, billHistory);
  });

  document.getElementById('saveBillQuickBtn')?.addEventListener('click', () => {
    const excludeCheck = document.getElementById('excludeTrainCheckbox');
    const snap = createBillSnapshot(appState, latestCalc, {
      excludeFromTrain: Boolean(excludeCheck?.checked)
    });
    if (!snap) {
      showToast('Cần nhập Số Kg > 0 và ít nhất 1 món đồ để lưu bill.', { durationMs: 3000 });
      return;
    }
    billHistory = addBillToHistory(billHistory, snap);
    saveBillHistory(billHistory);
    renderHistoryBadge(billHistory);
    if (excludeCheck) excludeCheck.checked = false;
    showToast(`Đã lưu bill ${snap.actualKg.toFixed(2)}kg (${snap.totalItems} cái) vào lịch sử!`, { durationMs: 3000 });
  });

  document.getElementById('applyLearnedWeightsBtn')?.addEventListener('click', () => {
    if (!latestCalReport?.improved) return;
    stateActions.applyLearnedGrams(appState, latestCalReport.weights);
    renderGramInputs(appState);
    renderAll({ fullMembers: false });
    latestCalReport = renderCalibrationContent(appState, billHistory);
    showToast('Đã áp dụng định mức gram tối ưu mới!', { durationMs: 2800 });
  });

  document.getElementById('exportHistoryBtn')?.addEventListener('click', () => {
    if (billHistory.length === 0) {
      showToast('Chưa có hóa đơn nào để xuất.', { durationMs: 2500 });
      return;
    }
    const blob = new Blob([exportAnonymizedHistoryJson(billHistory)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laundry-bills-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${billHistory.length} hóa đơn ẩn danh.`, { durationMs: 2500 });
  });

  document.getElementById('importHistoryBtn')?.addEventListener('click', () => {
    document.getElementById('importHistoryFileInput')?.click();
  });

  document.getElementById('importHistoryFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { history, importedCount, skippedCount } = importAnonymizedHistoryJson(text, billHistory);
      billHistory = history;
      saveBillHistory(billHistory);
      latestCalReport = renderCalibrationContent(appState, billHistory);
      showToast(`Đã nhập ${importedCount} bill mới (bỏ qua ${skippedCount}).`, { durationMs: 3000 });
    } catch {
      showToast('File JSON không hợp lệ, không thể nhập.', { durationMs: 3000 });
    } finally {
      e.target.value = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeQrModal();
      closeCalibrationModal();
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  renderGramInputs(appState);
  renderHistoryBadge(billHistory);
  renderAll({ fullMembers: true, syncInputs: true });
  bindEvents();
});
