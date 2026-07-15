---
description: Quét thị trường nhà đất <2 tỷ cuối tuần — chạy workflow multi-agent (thu thập → kiểm toán → xuất bản) cho batch vùng theo ngày (T7 = A, CN = B)
---

# /weekly-market-scan

Chạy phiên quét thị trường tự hành cho repo Agents-House-Pricing-Researcher.

## Các bước (làm theo đúng thứ tự)

1. **Xác định batch theo ngày** (giờ Việt Nam):
   ```bash
   TZ=Asia/Ho_Chi_Minh date '+%u %Y-%m-%d %H:%M'   # 6 = Thứ 7, 7 = Chủ nhật
   ```
   - Thứ 7 (`6`) → batch **A** — miền Trung / gần Nha Trang (hcm-trung-tam, hcm-ven, da-nang, khanh-hoa, lam-dong, dak-lak, gia-lai)
   - Chủ nhật (`7`) → batch **B** — miền Nam / gần TP.HCM (binh-duong, vung-tau, dong-nai, long-an, can-tho, tay-ninh, dong-thap, **khanh-hoa**, **da-nang**)
   - Ngày khác (chạy tay) → hỏi người dùng muốn batch nào; không có người dùng thì mặc định A.
   - **Vùng trọng điểm (FOCUS)**: `khanh-hoa` (TP. Nha Trang) và `da-nang` (nội thành
     Đà Nẵng) nằm trong **CẢ HAI** batch nên được làm mới mỗi cuối tuần, với quota cao
     hơn (10-18) và ghi chú ưu tiên — cấu hình sẵn trong `weekend-market-scan.js` (map
     `FOCUS`). Đây là hai thị trường người dùng quan tâm nhất.

2. **Đảm bảo repo sẵn sàng**: working tree của
   `/workspace/agents-house-pricing-researcher` sạch và ở nhánh `main` mới nhất
   (`git pull origin main`). Nếu repo chưa có trong session (session mới do Routine
   spawn), clone nó trước qua add_repo/clone rồi mới tiếp tục.

3. **Chạy workflow** `weekend-market-scan` (định nghĩa tại
   `.claude/workflows/weekend-market-scan.js`) với `args: {"batch": "<A|B>"}`.
   Workflow tự lo 4 phase: Refresh (region-collector, Sonnet) → Enrich
   (listing-enricher, Sonnet) → Audit (data-auditor, Opus) → Publish
   (report-publisher, Sonnet). KHÔNG spawn agent thủ công song song với workflow.

4. **Nếu workflow bị đứt giữa chừng** (session limit…): resume bằng
   `resumeFromRunId` thay vì chạy lại từ đầu — kết quả agent đã xong được cache.

5. **Báo cáo cuối** (tiếng Việt, ngắn gọn):
   - Batch nào, vùng nào, bao nhiêu tin (toàn bộ đều mới — file đã ghi đè) / bao nhiêu link direct / audit sửa gì
   - Verdict của auditor; nếu `CAN_CHAY_LAI` thì nói rõ vùng nào cần chạy lại và vì sao
   - Trạng thái publish + link site https://quang-dobe.github.io/Agents-House-Pricing-Researcher/
   - Mọi gap trung thực (vùng không có tin mới là bình thường — không ép số)

## Nguyên tắc bао trùm

- Token: mọi agent con chạy Sonnet trừ auditor chạy Opus — đã cấu hình sẵn trong
  agent definitions, KHÔNG override model.
- **Dữ liệu luôn mới, GHI ĐÈ không tích luỹ**: mỗi lượt collector thay toàn bộ
  `listings[]` của file vùng bằng tin thu thập được TRONG LƯỢT NÀY — không giữ/merge
  tin của lượt trước (BĐS bán/gỡ tin rất nhanh, dữ liệu cũ hết giá trị tham khảo).
  Tổng số tin có thể nhỏ hơn hẳn lượt trước — đó là kết quả đúng, không phải lỗi.
- Trung thực > số lượng: 0 tin mới + ghi chú rõ ràng vẫn là kết quả tốt.
- Không bịa dữ liệu, không lấy ảnh (môi trường chặn — xem skill re-permalink-hunting).
