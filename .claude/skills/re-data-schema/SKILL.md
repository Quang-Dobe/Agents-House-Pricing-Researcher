---
name: re-data-schema
description: Load before reading or writing any data/<region>.json file. Defines the dataset contract, required fields, region file map, and the validation commands to run before finishing.
---

# Hợp đồng dữ liệu `data/<region>.json`

Schema chuẩn đầy đủ: `data/schema.json` (đọc trước khi ghi file).

## File map hiện tại (10 vùng)

| File | Vùng |
|---|---|
| hcm-trung-tam.json | TP.HCM quận trung tâm (Q1,3,4,5,6,8,10,11, Bình Thạnh, Phú Nhuận, Tân Bình) |
| hcm-ven.json | TP.HCM ven & Thủ Đức (Q7,12, Tân Phú, Gò Vấp, Bình Tân, Thủ Đức, Bình Chánh, Hóc Môn, Củ Chi, Nhà Bè) |
| da-nang.json | Đà Nẵng | 
| khanh-hoa.json | Khánh Hòa (gồm Ninh Thuận cũ — sáp nhập NQ 202/2025 từ 01/07/2025) |
| lam-dong.json | Lâm Đồng (Đà Lạt, Đức Trọng, Lâm Hà, Đơn Dương, Bảo Lộc, Di Linh) |
| binh-duong.json | Bình Dương |
| vung-tau.json | Bà Rịa–Vũng Tàu |
| dong-nai.json | Đồng Nai |
| long-an.json | Long An |
| can-tho.json | Cần Thơ |

## Trường bắt buộc mỗi listing

`id` (`<region_slug>-<số thứ tự tiếp theo>`), `title`, `property_type`
(`nha_o`|`dat_tho_cu`), `district`, `total_price_vnd` (**< 2e9**),
`total_price_label`, `area_m2`, `price_per_m2_million`, `source_site`,
`source_url`, `link_type` (`direct`|`category`), `plain_summary`,
`description_snippet`, `image_available` (**luôn false**), `dedup_key`,
`duplicate_count`, `reliability_score` + `reliability_breakdown{A,B,C,D}`,
`assessment_confidence` (`Cao`|`Trung bình`|`Thấp`), `price_fit`,
`suitability_score`, `suitability_reason`.

Tuỳ chọn: `ward_or_street`, `legal_status`, `posted_period`,
`posted_confidence`, `details{floors, bedrooms, frontage_m, road_access, direction, extras[]}`.

## Quy tắc sửa file

- **Mở rộng, không phá**: giữ nguyên listing/market_bands cũ trừ khi có bằng chứng sai.
- ID mới nối tiếp số lớn nhất hiện có.
- Cập nhật `generated_note` mô tả pass vừa chạy.
- Ghi chú giới hạn/gap vào `notes`.

## Validate TRƯỚC KHI kết thúc (bắt buộc)

```bash
node -e "
const d=require('./data/<region>.json');
const bad=d.listings.filter(l=>l.total_price_vnd>=2e9 || !l.plain_summary || !l.link_type);
console.log('listings:', d.listings.length, '| violations:', bad.length, bad.map(l=>l.id));
const ids=new Set(); d.listings.forEach(l=>{ if(ids.has(l.id)) throw 'dup id '+l.id; ids.add(l.id); });
console.log('OK');"
```
JSON không parse được hoặc có violation → sửa xong mới được kết thúc.
