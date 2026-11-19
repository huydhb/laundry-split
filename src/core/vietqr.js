import { removeDiacritics } from './format.js';

/**
 * Checks whether a bank code supports VietQR image generation.
 * @param {string} bankCode
 * @returns {boolean}
 */
export function supportsVietQr(bankCode) {
  return Boolean(bankCode && bankCode !== 'MOMO');
}

/**
 * Builds an ASCII-safe VietQR image URL for a member payout.
 * Returns null if bank info is incomplete or unsupported (e.g. MOMO).
 */
export function buildVietQrUrl({ bankCode, accountNo, ownerName, memberName, amount }) {
  const code = String(bankCode || '').trim();
  const acc = String(accountNo || '').trim();
  const safeAmount = Math.max(0, Math.round(Number(amount) || 0));

  if (!supportsVietQr(code) || !acc || safeAmount <= 0) {
    return null;
  }

  const cleanMember = removeDiacritics(memberName || 'Thanh vien').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Thanh vien';
  const addInfo = encodeURIComponent(`${cleanMember} tien giat say`);
  const cleanOwner = ownerName ? removeDiacritics(ownerName).toUpperCase() : '';
  const accNameParam = cleanOwner ? `&accountName=${encodeURIComponent(cleanOwner)}` : '';

  return `https://img.vietqr.io/image/${encodeURIComponent(code)}-${encodeURIComponent(acc)}-compact2.png?amount=${safeAmount}&addInfo=${addInfo}${accNameParam}`;
}
