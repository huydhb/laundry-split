import { fmtVND } from '../core/format.js';
import { buildVietQrUrl } from '../core/vietqr.js';

/**
 * Opens the VietQR modal for a given member payout.
 */
export function openQrModal(state, memberName, amount) {
  const url = buildVietQrUrl({
    bankCode: state.bank.code,
    accountNo: state.bank.accountNo,
    ownerName: state.bank.ownerName,
    memberName,
    amount
  });
  if (!url) return;

  const modal = document.getElementById('vietQrModal');
  const imgEl = document.getElementById('qrImage');
  const statusEl = document.getElementById('qrImageStatus');

  document.getElementById('qrTitle').textContent = `QR Chuyển Khoản • ${memberName}`;
  document.getElementById('qrAmountText').textContent = fmtVND(amount);
  document.getElementById('qrBankSubtitle').textContent = `${state.bank.code} - ${state.bank.accountNo}`;

  if (statusEl) {
    statusEl.textContent = 'Đang tải mã VietQR...';
    statusEl.classList.remove('hidden', 'text-rose-600');
    statusEl.classList.add('text-muted');
  }

  if (imgEl) {
    imgEl.classList.remove('hidden');
    imgEl.onload = () => {
      if (statusEl) statusEl.classList.add('hidden');
    };
    imgEl.onerror = () => {
      imgEl.classList.add('hidden');
      if (statusEl) {
        statusEl.textContent = 'Không tải được ảnh QR (kiểm tra kết nối mạng hoặc mã ngân hàng / STK).';
        statusEl.classList.remove('hidden', 'text-muted');
        statusEl.classList.add('text-rose-600');
      }
    };
    imgEl.src = url;
  }

  if (modal) modal.classList.remove('hidden');
}

export function closeQrModal() {
  const modal = document.getElementById('vietQrModal');
  if (modal) modal.classList.add('hidden');
}
