import { describe, expect, it } from 'vitest';
import { getDefaultGrams } from '../src/config/categories.js';
import { fmtVND, removeDiacritics } from '../src/core/format.js';
import { computeSplit } from '../src/core/splitEngine.js';
import { buildVietQrUrl, supportsVietQr } from '../src/core/vietqr.js';
import { buildZaloMessage } from '../src/core/zaloFormatter.js';

describe('formatters & VietQR', () => {
  it('strips Vietnamese diacritics cleanly including đ/Đ', () => {
    expect(removeDiacritics('Đặng Hoàng Minh Đức')).toBe('Dang Hoang Minh Duc');
    expect(removeDiacritics('  Bạn   phòng 1  ')).toBe('Ban phong 1');
  });

  it('builds ASCII-safe VietQR URL and rejects MOMO/zero amount', () => {
    expect(supportsVietQr('MB')).toBe(true);
    expect(supportsVietQr('MOMO')).toBe(false);

    const url = buildVietQrUrl({
      bankCode: 'MB',
      accountNo: '0123456789',
      ownerName: 'Nguyễn Văn A',
      memberName: 'Bạn 1 (Đức)',
      amount: 21000
    });

    expect(url).toContain('https://img.vietqr.io/image/MB-0123456789-compact2.png?');
    expect(url).toContain('amount=21000');
    expect(url).toContain('addInfo=Ban%201%20Duc%20tien%20giat%20say');
    expect(url).toContain('accountName=NGUYEN%20VAN%20A');

    expect(
      buildVietQrUrl({ bankCode: 'MOMO', accountNo: '0909', memberName: 'A', amount: 20000 })
    ).toBeNull();
    expect(
      buildVietQrUrl({ bankCode: 'VCB', accountNo: '123', memberName: 'A', amount: 0 })
    ).toBeNull();
  });

  it('builds Zalo message with rounded target and bank line', () => {
    const calc = computeSplit({
      washMode: 'urgent',
      totalKg: 3.3,
      totalMoney: 56100,
      roundingStep: 1000,
      roundingMode: 'nearest',
      grams: getDefaultGrams(),
      members: [
        { id: 'm1', name: 'Bạn 1', counts: { military: 2, sport: 1, tshirt: 2 } },
        { id: 'm2', name: 'Bạn 2', counts: { military: 2, sport: 1, longPants: 1 } }
      ]
    });

    const msg = buildZaloMessage(calc, {
      code: 'VCB',
      accountNo: '99887766',
      ownerName: 'nguyen van a'
    });

    expect(msg).toContain('Giặt Khẩn Cấp (17k/kg)');
    expect(msg).toContain(`Tổng tiền bill: ${fmtVND(56100)} (Thu chẵn: ${fmtVND(56000)})`);
    expect(msg).toContain('1. Bạn 1:');
    expect(msg).toContain(`Thu thiếu do làm tròn: ${fmtVND(100)} so với bill`);
    expect(msg).toContain('💳 CK: VCB 99887766 - NGUYEN VAN A');
  });

  it('discloses surplus from per-person rounding and omits it for empty clothes', () => {
    const state = {
      washMode: 'normal', totalKg: 2.5, totalMoney: 30000,
      roundingStep: 1000, roundingMode: 'ceil',
      members: ['a', 'b', 'c', 'd'].map((id) => ({ id, counts: { military: 2 } }))
    };
    const msg = buildZaloMessage(computeSplit(state));
    expect(msg).toContain(`Thu chẵn: ${fmtVND(32000)}`);
    expect(msg).toContain('Làm tròn lên từng người');
    expect(msg).toContain(`Thu dư do làm tròn: ${fmtVND(2000)} so với bill`);
    expect(buildZaloMessage(computeSplit({ ...state, members: [] }))).not.toMatch(/Thu dư|Thu thiếu|Thu chẵn/);
  });
});
