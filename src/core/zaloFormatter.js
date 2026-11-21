import { getWashModeConfig, ROUNDING_MODES } from '../config/pricing.js';
import { fmtVND } from './format.js';

/**
 * Formats a clean, copy-ready Zalo message summarizing the laundry split.
 */
export function buildZaloMessage(calc, bank) {
  const modeCfg = getWashModeConfig(calc.washMode);
  const hasCollectedDiff = calc.hasItems && calc.targetCollected !== calc.billMoney;
  const collectedSuffix = hasCollectedDiff ? ` (Thu chẵn: ${fmtVND(calc.targetCollected)})` : '';

  const lines = [
    '🧺 CHỐT TIỀN GIẶT SẤY KTX',
    `• Hình thức: ${modeCfg.shortLabel}`,
    `• Tổng đồ: ${calc.totalItems} cái | Tổng KG: ${calc.billKg.toFixed(2)} kg`,
    `• Tổng tiền bill: ${fmtVND(calc.billMoney)}${collectedSuffix}`
  ];

  if (calc.hasItems && calc.billMoney > 0) {
    const method = calc.roundingMode === ROUNDING_MODES.ceil
      ? 'Làm tròn lên từng người' : 'Chia theo tổng làm tròn gần nhất';
    lines.push(`• ${method}, bước ${fmtVND(calc.roundingStep)}`);
    if (hasCollectedDiff) {
      const label = calc.collectedDiff > 0 ? 'Thu dư' : 'Thu thiếu';
      lines.push(`• ${label} do làm tròn: ${fmtVND(Math.abs(calc.collectedDiff))} so với bill`);
    }
    if (calc.roundingMode === ROUNDING_MODES.nearest) {
      lines.push('• Phân bổ tiền lẻ để khớp tổng thu; cùng tỷ lệ có thể lệch một bước làm tròn.');
    }
  }
  lines.push('--------------------');

  const activeMembers = calc.results.filter((r) => r.items > 0);
  if (activeMembers.length === 0) {
    lines.push('(Chưa nhập số lượng đồ từng người)');
  } else {
    activeMembers.forEach((r, idx) => {
      lines.push(`${idx + 1}. ${r.name}: ${fmtVND(r.finalMoney)} (${r.items} cái - ${r.pct.toFixed(1)}%)`);
    });
  }

  if (bank?.code && bank?.accountNo) {
    lines.push('--------------------');
    const ownerStr = bank.ownerName ? ` - ${bank.ownerName.trim().toUpperCase()}` : '';
    lines.push(`💳 CK: ${bank.code} ${bank.accountNo.trim()}${ownerStr}`);
  }

  return lines.join('\n');
}
