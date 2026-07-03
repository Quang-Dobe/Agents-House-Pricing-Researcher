---
name: re-source-tiers
description: Load when scoring the A (source reliability) group of the rubric, or choosing which sites to trust for listings and market-price bands. Ranks Vietnamese real-estate sites into tiers.
---

# Xếp hạng độ uy tín nguồn (điểm A của rubric)

## Tier 1 — A = 3 điểm

| Site | Ghi chú |
|---|---|
| batdongsan.com.vn | Lớn nhất VN, dữ liệu chuẩn hoá, có mục thống kê giá |
| nhatot.com | Thanh khoản cao, nhiều tin chính chủ |

## Tier 2 — A = 2 điểm

homedy.com · nhadat.cafeland.vn · rever.vn · alonhadat.com.vn · muaban.net ·
mogi.vn · nhadat24h.net · muonnha.com.vn · bds68.com.vn · cenhomes.vn ·
thuviennhadat.vn

## Tier 3 — A = 1 điểm

Site địa phương/nhỏ (batdongsanvt, nhadatcantho, datnenlamdong, i-nhadat,
nhabansg, phonhadat, 123nhadatviet, tongkhobds, kinhtebatdongsan…), diễn đàn,
trang môi giới cá nhân, trang tư vấn pháp luật có kèm tin rao.

Tier 3 dùng được (nhiều permalink tốt!) nhưng: A = 1 và cân nhắc hạ
`assessment_confidence` nếu site không có thông tin kiểm chứng chéo.

## Nguồn cho market_bands (dải giá thị trường)

Ưu tiên: mục thống kê/báo cáo giá của batdongsan.com.vn, cafeland, guland.vn,
báo chí kinh tế (cafef, vnexpress), quyết định giá đất nhà nước (chỉ dùng làm
mốc sàn — giá nhà nước thấp hơn thị trường nhiều lần, phải ghi chú rõ loại nguồn).
Mỗi dải giá bắt buộc có `source_url`.

## Cờ đỏ về nguồn

- Cùng 1 tin xuất hiện nhiều site với giá khác nhau → lấy bản có nguồn tier cao
  hơn, ghi chú mâu thuẫn, hạ confidence.
- Trang tổng hợp "giá từ X" theo bộ lọc ≠ tin thật — không dùng làm listing.
