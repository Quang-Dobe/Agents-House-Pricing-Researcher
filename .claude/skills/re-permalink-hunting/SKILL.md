---
name: re-permalink-hunting
description: Load when trying to find the DIRECT detail-page URL (permalink) of a real-estate listing via WebSearch, or when deciding link_type. Contains query techniques, per-site URL patterns, and the no-fabrication rules.
---

# Săn permalink bài đăng qua WebSearch

## Bối cảnh môi trường (đã kiểm chứng, đừng thử lại)

WebFetch và mọi HTTP trực tiếp bị **network policy chặn toàn bộ** (11/11 URL probe đều
403, kể cả Wikipedia làm control). **WebSearch là kênh duy nhất.** Không truy cập được
trang chi tiết → **không lấy được ảnh** (`image_available: false` mãi mãi) và mọi thông
tin chỉ ở mức snippet.

## Kỹ thuật query để search trả về đúng trang bài đăng

1. **Đường + diện tích + giá chính xác**: `"bán nhà Nguyễn Văn Quá 60m2 1 tỷ 880"` —
   hiệu quả nhất.
2. **Quote nguyên cụm tiêu đề tin** đã thấy trong lần search trước.
3. Thêm từ khoá phụ: `"chính chủ"`, `"sổ hồng riêng"`, tên phường/xã.
4. Mỗi tin thử **tối đa 2-3 query**; không ra thì chấp nhận `link_type: "category"`.

## Mẫu URL permalink hợp lệ (phải chứa ID bài đăng)

| Site | Mẫu |
|---|---|
| batdongsan.com.vn | `...-pr<số>` |
| nhatot.com | `...<8+ số>.htm` hoặc `...-<8+ số>` |
| alonhadat.com.vn | `...-<số≥6 chữ số>.html` |
| mogi.vn | `...-id<số>` |
| muaban.net | `...-id<số>` |
| homedy.com | `...es<số>` hoặc `...-<số>` |
| nhadat.cafeland.vn | `...-<số>.html` |
| thuviennhadat.vn | `...pst<số>.html` |
| cenhomes.vn | `...-<số≥7>` |
| nhabansg.vn | `...nb<số>.html` |
| site khác | chuỗi số ID ≥6 chữ số HOẶC slug riêng mô tả đúng 1 tin (không phải trang danh mục/lọc) |

## Quy tắc quyết định link_type

- `"direct"` — URL khớp mẫu trên VÀ tiêu đề/giá/diện tích trong kết quả **khớp với tin**
  (khớp giá ±5%, diện tích ±2m²). Khớp mẫu URL nhưng lệch giá/diện tích = **tin khác** → không dùng.
- `"category"` — sau ≥2 query chỉ ra trang danh mục: giữ URL danh mục, ghi chú rõ.
- **Tuyệt đối không bịa URL, không "đoán" ID, không lắp ID từ tin khác.**

## Kinh nghiệm thực chiến theo vùng

- Long An/Cần Thơ: thuviennhadat, homedy, alonhadat, các site địa phương
  (nhadatcantho, batdongsanvt…) lộ permalink tốt → tỷ lệ direct cao.
- Đà Nẵng/HCM: batdongsan & nhatot hầu như không cho search index trang tin lẻ →
  tỷ lệ direct thấp là bình thường, đừng ép.
- Tin mới đăng dễ tìm permalink hơn tin cũ.
