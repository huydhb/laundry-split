import './styles/main.css';
import { computeSplit } from './core/splitEngine.js';
import { loadState, saveState, stateActions } from './state/store.js';
import { renderBillForm, syncBillInputs } from './ui/billForm.js';
import { copyToClipboard, showToast } from './ui/domUtils.js';
import { patchMemberCards, renderGramInputs, renderMemberCards } from './ui/memberList.js';
import { closeQrModal, openQrModal } from './ui/qrModal.js';
import { renderSummaryPanel, syncBankInputs } from './ui/summaryPanel.js';

let appState = loadState();
let latestCalc = null;

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

  document.getElementById('copyZaloBtn')?.addEventListener('click', async () => {
    const box = document.getElementById('zaloTextBox');
    if (!box) return;
    const copied = await copyToClipboard(box.value);
    if (copied) {
      const toast = document.getElementById('copiedToast');
      toast?.classList.remove('hidden');
      setTimeout(() => toast?.classList.add('hidden'), 2500);
    }
  });

  document.getElementById('vietQrModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'vietQrModal') closeQrModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQrModal();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  renderGramInputs(appState);
  renderAll({ fullMembers: true, syncInputs: true });
  bindEvents();
});
