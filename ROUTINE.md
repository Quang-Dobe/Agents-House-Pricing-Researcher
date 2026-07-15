# ROUTINE.md — Hướng dẫn cho Claude Routine (bản tự hành)

> **Đây là nguồn chân lý duy nhất cho lượt chạy tự hành cuối tuần.**
> Prompt của Routine chỉ làm nhiệm vụ: lấy repo về rồi mở file này và **làm theo
> đúng từng bước**. Nếu prompt và ROUTINE.md mâu thuẫn, **ROUTINE.md thắng**.

Repo: `quang-dobe/agents-house-pricing-researcher` ·
Site: <https://quang-dobe.github.io/Agents-House-Pricing-Researcher/>

---

## 0. Bối cảnh

Hệ thống multi-agent quét tin **nhà ở / đất thổ cư giá < 2 tỷ** ở nhiều vùng, chấm
điểm theo rubric thống nhất, kiểm toán rồi xuất bản lên GitHub Pages. Chạy tự hành
sáng **Thứ 7 (batch A)** và **Chủ nhật (batch B)**, ~8h giờ Việt Nam.

---

## 1. Chuẩn bị repo (nếu chưa có trong session)

Session do Routine spawn thường trống. Trước khi làm gì khác:

1. `add_repo` repo `quang-dobe/agents-house-pricing-researcher` vào session.
2. Clone tới `/workspace/agents-house-pricing-researcher` theo hướng dẫn của `add_repo`.
3. Gọi `register_repo_root` để `.claude/` (agents/skills/commands/workflows) được nạp.
4. Đảm bảo working tree **sạch** và đang ở **`main` mới nhất**:
   ```bash
   cd /workspace/agents-house-pricing-researcher
   git checkout main && git pull origin main
   ```

---

## 2. Xác định batch theo ngày (giờ Việt Nam)

```bash
TZ=Asia/Ho_Chi_Minh date '+%u %Y-%m-%d %H:%M'   # 6 = Thứ 7, 7 = Chủ nhật
```

| Ngày | Batch | Vùng |
|------|-------|------|
| Thứ 7 (`6`) | **A** — miền Trung / gần Nha Trang | hcm-trung-tam, hcm-ven, da-nang, khanh-hoa, lam-dong, dak-lak, gia-lai |
| Chủ nhật (`7`) | **B** — miền Nam / gần TP.HCM | binh-duong, vung-tau, dong-nai, long-an, can-tho, tay-ninh, dong-thap |
| Ngày khác (chạy tay) | — | Hỏi người dùng muốn batch nào; không có người dùng thì mặc định **A**. |

---

## 3. Chạy scan

Đọc `.claude/commands/weekly-market-scan.md` và thực thi **đúng như viết**. Cụ thể:

1. Chạy workflow `weekend-market-scan` (định nghĩa tại
   `.claude/workflows/weekend-market-scan.js`) với `args: {"batch": "<A|B>"}`.
2. Workflow tự lo 4 phase, dùng đúng agent definitions của repo:
   **Refresh** (region-collector) → **Enrich** (listing-enricher) →
   **Audit** (data-auditor) → **Publish** (report-publisher).
3. **KHÔNG** spawn agent thủ công song song với workflow.

### Nếu workflow bị đứt giữa chừng (session limit…)

Resume bằng `resumeFromRunId` thay vì chạy lại từ đầu — kết quả agent đã xong được
cache; chạy lại từ đầu sẽ lãng phí token và ghi đè công việc đã hoàn tất.

---

## 4. Ràng buộc cứng (KHÔNG được vi phạm)

- **Model cố định theo agent definitions** — Sonnet cho collector / enricher /
  publisher, **Opus** cho auditor. KHÔNG override, **KHÔNG bao giờ dùng Fable**.
- **Chỉ WebSearch** ra ngoài được. `WebFetch` và HTTP trực tiếp bị network policy
  chặn (đã xác minh) — đừng thử.
- **Không bịa** listing, giá, hay URL. Trung thực > số lượng: **0 tin mới kèm ghi
  chú rõ ràng vẫn là kết quả hợp lệ.**
- **Dữ liệu luôn mới, GHI ĐÈ không tích luỹ**: mỗi lượt collector thay toàn bộ
  `listings[]` của file vùng bằng tin thu thập TRONG LƯỢT NÀY — không merge tin cũ.
  Tổng số tin có thể giảm; đó là kết quả đúng, không phải lỗi.
- Publish đẩy lên `main` → tự động deploy GitHub Pages.

---

## 5. Báo cáo cuối (tiếng Việt, ngắn gọn)

- Batch nào, vùng nào, bao nhiêu tin (toàn bộ đều mới — file đã ghi đè) / bao nhiêu
  link direct / audit sửa gì.
- Verdict của auditor; nếu `CAN_CHAY_LAI` → nói rõ vùng nào cần chạy lại và vì sao.
- Trạng thái publish + link site.
- Mọi gap trung thực (vùng không có tin mới là bình thường — không ép số).

---

## 6. Ghi chú về Pull Request & auto-merge

Nếu lượt chạy tạo Pull Request (thay vì đẩy thẳng `main`):

- Mở PR ở trạng thái **sẵn sàng review (không phải draft)** khi muốn nó được gộp.
- Workflow `.github/workflows/auto-merge.yml` sẽ **tự gộp** PR non-draft một khi
  nó mergeable và mọi check đã pass. PR còn ở draft sẽ **không** bị gộp.
- Cần chặn auto-merge một PR cụ thể? Gắn nhãn `no-auto-merge` (hoặc `do-not-merge`
  / `wip` / `hold`).
