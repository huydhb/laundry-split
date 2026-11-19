# Chia Tiền Giặt Sấy KTX (`laundry-split`)

Công cụ web nhẹ giúp phòng KTX chia tiền giặt sấy công bằng theo **số lượng từng loại quần áo**, **tổng số Kg thực tế trên cân**, và **tổng tiền hóa đơn**, đồng thời tự học hiệu chỉnh trọng lượng đồ theo lịch sử bill.

## Tính năng chính

- **Chia tiền chuẩn theo tỷ lệ trọng lượng & Largest Remainder Method**:
  - Hỗ trợ 2 chế độ giá: **Giặt Thường** (`12.000đ/kg`, sàn `30.000đ`) và **Giặt Khẩn Cấp** (`17.000đ/kg`, sàn `42.000đ`).
  - Lựa chọn bước làm tròn `1.000đ` / `500đ` / `100đ` và hướng làm tròn **Gần nhất** hoặc **Làm tròn lên (người ứng bill không lỗ)**.
- **6 nhóm đồ thực tế + nhóm phụ Khác**:
  - *Quân phục, Đồ thể dục, Áo phông, Đồ ngủ, Quần dài / Jean, Khăn tắm nhỏ* (`min = 150g` chưa tính nước/ẩm) và *Khác*.
  - Thanh đối chiếu tổng đồ cả phòng để kiểm tra nhanh với biên nhận tiệm.
- **Tự học trọng lượng đồ không cần cân từng món (`weightLearner`)**:
  - Lưu lịch sử hóa đơn ẩn danh ngay trên trình duyệt.
  - Dùng **Bounded Prior-Regularized Robust Regression (WLS + Huber IRLS + Projected Coordinate Descent)** kết hợp kiểm định chéo **LOOCV** để tinh chỉnh định mức gram từ chính dữ liệu cân tổng bill.
  - Cho phép đánh dấu các lượt đồ bị ẩm/ướt bất thường để không làm lệch mô hình, và Xuất/Nhập JSON ẩn danh.
- **Tiện ích KTX**:
  - Tạo tin nhắn tổng hợp copy nhanh gửi Zalo.
  - Tạo mã **VietQR** riêng theo từng người với nội dung chuyển khoản không dấu.
  - Thanh công cụ dính đáy cho điện thoại (`Mobile Sticky Bar`) và Hoàn tác (`Undo`) 5 giây khi reset số đồ.

## Chạy và kiểm thử local

```bash
npm install
npm run dev       # Chạy dev server (Vite)
npm test          # Chạy toàn bộ unit tests (Vitest)
npm run build     # Build production bundle vào dist/
```

## Huấn luyện định mức gram offline từ file JSON

1. Trên ứng dụng web, sau mỗi lần giặt bấm **"+ Lưu Bill vào lịch sử"**.
2. Mở **"📊 Lịch sử & Train"** → **"Xuất JSON ẩn danh"** để tải file `.json`.
3. Gộp các lượt giặt vào `data/sample-bills.json` (hoặc truyền đường dẫn file tùy chọn) và chạy:

```bash
npm run train
# hoặc: node scripts/train-weights.mjs path/to/bills.json
```

## Deploy lên GitHub Pages

Repo đã cấu hình sẵn workflow CI/CD tại `.github/workflows/deploy.yml`:

1. Đẩy code lên nhánh `main`.
2. Trên GitHub Repository: vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
3. Workflow sẽ tự động chạy `npm test` → `npm run build` (tự động set `BASE_PATH`) → xuất bản lên GitHub Pages.
