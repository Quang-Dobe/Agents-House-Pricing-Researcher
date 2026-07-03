---
name: re-methodology
description: Load whenever collecting, enriching, scoring, or auditing real-estate listings in this repo. Defines the filter rules (<2 tỷ, nhà ở/đất thổ cư), deduplication, the reliability/suitability scoring rubric, and the honesty rules every agent must follow.
---

# Phương pháp luận & Rubric chấm điểm

Nguồn chuẩn đầy đủ: `docs/METHODOLOGY.md` (đọc nếu cần chi tiết). Dưới đây là bản hành động.

## Luật trung thực (tuyệt đối)

- Mọi số liệu (giá, diện tích, địa chỉ, pháp lý, URL) phải đến từ **kết quả WebSearch thật**.
  Không suy đoán, không bịa, không "làm tròn cho đẹp".
- Search engine đôi khi **tự tổng hợp số liệu sai** trong phần tóm tắt — nếu một data point
  chỉ xuất hiện trong AI summary mà không có trong snippet/tiêu đề kết quả nào, phải
  re-query xác minh; không xác minh được thì bỏ.
- Ngày trên trang aggregator (vd "T7/2026") là ngày crawl, KHÔNG phải ngày đăng →
  `posted_confidence: "unknown"` trừ khi snippet nêu ngày cụ thể.
- Thiếu dữ liệu → để trống trường + hạ `assessment_confidence`, không đoán.

## Filter — tin chỉ được giữ nếu thoả TẤT CẢ

1. Nhà ở (nhà riêng/phố/cấp 4) HOẶC đất thổ cư (ONT/ODT). Loại: chung cư, đất nông nghiệp
   chưa thổ cư, kho xưởng, dự án.
2. Giá tổng **< 2.000.000.000 VND** rõ ràng. "Giá thoả thuận" → loại.
3. Thuộc đúng vùng được giao.
4. Đăng ≤ 1 năm nếu xác định được; không xác định được → giữ nhưng đánh dấu unknown.

## Dedup

`dedup_key` = chuẩn hoá(đường/khu + phường/quận + diện tích ±1m² + giá ±10tr), bỏ dấu,
lowercase. Trùng → giữ bản đầy đủ nhất, tăng `duplicate_count`. `duplicate_count ≥ 3`
= tín hiệu xấu (rao dai không bán được) → trừ điểm suitability.

## Điểm UY TÍN (reliability_score, 0-10) = A + B + C + D

| Nhóm | Max | Cách chấm |
|---|---|---|
| A. Nguồn | 3 | tier-1 = 3, tier-2 = 2, tier-3 = 1 (xem skill `re-source-tiers`) |
| B. Đầy đủ | 3 | +1 diện tích cụ thể; +1 địa chỉ tới đường/phường; +1 nêu pháp lý |
| C. Giá hợp lý | 2 | đơn giá trong dải market_bands = 2; lệch nhẹ = 1; lệch mạnh = 0 |
| D. Tươi & duy nhất | 2 | +1 xác định được đăng ≤12 tháng; +1 duplicate_count == 1 |

Ghi `reliability_breakdown` từng nhóm.

## Điểm ĐÁNG MUA (suitability_score, 0-10)

```
0.40*reliability + 0.25*price_fit(0-10) + 0.20*legal_clarity(sổ riêng=10, sổ chung=4, mù mờ=2)
+ 0.15*location(0-10, nêu lý do) − phạt_dup(≥3 lần: −1.0; ≥5: −2.0)
```
Bắt buộc kèm `suitability_reason` (1-2 câu giải thích).

## price_fit & cảnh báo "rẻ bất thường"

Đơn giá = giá/diện tích (triệu/m²), so với `market_bands` của khu. Thấp hơn ~40% dải
→ `"rẻ bất thường — cần cảnh giác"` (thường là sổ chung / vướng pháp lý / tin ảo) và
hạ suitability. Nhà trung tâm diện tích siêu nhỏ có thể tạo false positive — ghi chú rõ.

## assessment_confidence

- **Cao**: đủ diện tích + giá + địa chỉ + pháp lý + khớp dải giá.
- **Trung bình**: thiếu 1-2 yếu tố.
- **Thấp**: thiếu nhiều / mơ hồ / không rõ thời điểm.

## plain_summary

Mỗi tin PHẢI có 1 câu tiếng Việt đơn giản, không thuật ngữ: "nhà/đất gì, ở đâu, bao
nhiêu tiền, có gì đáng chú ý".
