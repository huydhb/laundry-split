---
name: ingest-laundry-bill
description: >-
  Extracts and anonymizes laundry receipt data (from photos or text) into
  data/sample-bills.json, validates piece counts against total weight, and runs
  LOOCV weight calibration. Use when the user uploads laundry bill photos, asks
  to add new bill data, or wants to retrain clothing gram weights.
---

# Ingest Laundry Bill & Retrain Weights

Follow this workflow whenever adding new laundry receipts to `data/sample-bills.json` and updating calibrated weights for the deployed app.

## 1. Extract Fields from Receipt Image or Text

Read all available fields carefully:
- `date`: Format `YYYY-MM-DD` (convert `DD/MM/YYYY` or `DDMMYY` on the paper bill).
- `washMode`: `"normal"` (12k/kg, sàn 30k) or `"urgent"` (17k/kg, sàn 42k).
- `actualKg`: Exact measured weight in kg from the scale/bill. **Never** derive `actualKg` from `actualMoney / rate`.
- `actualMoney`: Total bill amount in VND (integer, no dots/commas).
- `counts`: Map using exact keys from [categories.js](../../../src/config/categories.js):
  - `military` (Quân phục — 1 bộ = 2 cái)
  - `sport` (Đồ thể dục)
  - `tshirt` (Áo phông)
  - `sleepwear` (Đồ ngủ — 1 bộ = 2 cái nếu tách áo & quần)
  - `longPants` (Quần dài / Jean)
  - `towel` (Khăn tắm nhỏ — dry min 150g)
  - `other` (Khác — áo khoác mỏng, vỏ gối...)

## 2. Clarify Merged Categories & Outliers Before Saving

1. Shop receipts often group everyday items into `"Đồ thường"`. **Never guess** how `"Đồ thường"` splits across `tshirt`, `sleepwear`, `longPants`, and `towel`.
2. Ask the user one concise question to break down any merged `"Đồ thường"` count (and check if any items were soaked/unusually wet or included blankets).
3. If the user cannot recall the split for an old receipt, either skip adding it to training or set `"excludeFromTrain": true` with `"note": "Chưa tách chi tiết đồ thường"`.
4. Verify `sum(Object.values(counts))` matches the total item count printed on the receipt.

## 3. Enforce Strict Anonymization (Public Repo)

Never write student names, room numbers, phone numbers, bank accounts, or real receipt IDs into `data/sample-bills.json`. Check with `git diff` that only anonymized numeric fields and generic notes (e.g. `"Lượt giặt thường"`, `"Đồ hơi ẩm"`) are added.

## 4. Append, Train, and Verify

1. Check `data/sample-bills.json` to avoid duplicate entries sharing the same `(date, actualKg, actualMoney, counts)`.
2. Append the sanitized object(s) to `data/sample-bills.json`.
3. Run offline training and inspect the output:
   ```bash
   npm run train
   ```
   - Inspect `CHẨN ĐOÁN TỪNG BILL`: if the new bill is flagged `Ngoại lai = Có`, warn the user to verify piece counts or mark `"excludeFromTrain": true` if wet.
4. When the user wants the updated weights live on GitHub Pages (and `Khuyến nghị` is `NÊN ÁP DỤNG`):
   ```bash
   npm run train -- --apply
   npm test
   npm run build
   ```
5. Commit only after `npm test` and `npm run build` pass cleanly.
