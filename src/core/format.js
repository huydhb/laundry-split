/**
 * Formats an integer/float number into Vietnamese currency string (e.g. 56.100đ).
 * @param {number} value
 * @returns {string}
 */
export function fmtVND(value) {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `${safe.toLocaleString('vi-VN')}đ`;
}

/**
 * Strips Vietnamese diacritics for ASCII-safe banking transfer descriptions.
 * @param {string} text
 * @returns {string}
 */
export function removeDiacritics(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim();
}
