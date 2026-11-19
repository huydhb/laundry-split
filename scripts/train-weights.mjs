import fs from 'node:fs';
import path from 'node:path';
import { trainWeights } from '../src/core/weightLearner.js';

const inputArg = process.argv[2] || 'data/sample-bills.json';
const filePath = path.resolve(process.cwd(), inputArg);

if (!fs.existsSync(filePath)) {
  console.error(`Không tìm thấy file dữ liệu: ${filePath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const bills = Array.isArray(raw) ? raw : raw.bills || [];
const report = trainWeights(bills);

console.log('=== BÁO CÁO HUẤN LUYỆN ĐỊNH MỨC GRAM (BOUNDED ROBUST + LOOCV) ===');
console.log(`Nguồn dữ liệu     : ${inputArg}`);
console.log(`Bill hợp lệ       : ${report.validBillsCount} (Loại bỏ: ${report.excludedCount})`);
console.log(`MAE mặc định      : ${report.defaultMaeGrams}g (${report.defaultMapePct}%)`);
console.log(`MAE sau học LOOCV : ${report.learnedMaeGrams}g (${report.learnedMapePct}%)`);
console.log(
  `Khuyến nghị       : ${
    report.improved
      ? 'NÊN ÁP DỤNG trọng số mới (cải thiện rõ rệt out-of-sample)'
      : `CHƯA ÁP DỤNG (cần ≥ ${report.minBillsToRecommend} bill hợp lệ và LOOCV MAE giảm ≥ 5g)`
  }`
);
console.log('\n--- BẢNG TRỌNG SỐ TỪNG LOẠI ĐỒ ---');
console.table(
  report.categoryStats.map((s) => ({
    'Loại đồ': s.name,
    'Số bill': s.billAppearances,
    'Tổng cái': s.totalItems,
    'Mặc định (g)': s.priorGram,
    'Đề xuất (g)': s.learnedGram,
    'Chênh (g)': s.deltaGram >= 0 ? `+${s.deltaGram}` : `${s.deltaGram}`,
    'Biên [min,max]': `[${s.minGram}, ${s.maxGram}]`,
    'Độ tin cậy': s.confidence
  }))
);

if (report.billDiagnostics.length > 0) {
  console.log('--- CHẨN ĐOÁN TỪNG BILL ---');
  console.table(
    report.billDiagnostics.map((b) => ({
      Bill: b.id,
      Ngày: b.date || '-',
      'Cân thật (g)': b.actualGrams,
      'Dự đoán mặc định (g)': b.defaultPredGrams,
      'Dự đoán LOOCV (g)': b.loocvPredGrams,
      'Sai số LOOCV (g)': b.loocvErrorGrams >= 0 ? `+${b.loocvErrorGrams}` : `${b.loocvErrorGrams}`,
      'Ngoại lai': b.isOutlier ? 'Có (Huber giảm trọng số)' : 'Không'
    }))
  );
}
