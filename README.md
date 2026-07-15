# Vietnam Real-Estate Report (< 2 tỷ) — HCM · Đà Nẵng · Khánh Hòa · Bình Dương · Vũng Tàu

🌐 **Site trực tuyến:** <https://quang-dobe.github.io/Agents-House-Pricing-Researcher/>
(dark-theme, cập nhật tự động mỗi cuối tuần). Bản HTML tĩnh nằm trong `site/` — mở
`site/index.html` để xem offline.

Thu thập & đánh giá tin **nhà ở** và **đất thổ cư** giá **dưới 2 tỷ**, đăng trong
**vòng 1 năm**, tại 5 khu vực. Mỗi tin được chấm **độ uy tín**, **độ hợp lý giá** và
**độ phù hợp khi mua** theo một bộ tiêu chí thống nhất, trình bày trên site dark-theme.

## ⚠️ Giới hạn dữ liệu (quan trọng — trung thực)

Môi trường thực thi (Claude Code on the web) áp **network egress policy** chặn truy cập
trực tiếp mọi trang BĐS: `batdongsan.com.vn`, `nhatot.com`, `alonhadat.com.vn`… đều trả
`403` ở tầng CONNECT của proxy, và WebFetch cũng bị site chặn `403`. Kênh outbound **duy
nhất** được phép là **WebSearch**. Hệ quả:

- Dữ liệu ở **mức snippet** (kết quả tìm kiếm), không phải nội dung trang đầy đủ.
- **Không tải được ảnh** (sổ đỏ, ảnh nhà) ⇒ **không có phân tích ảnh** như mong muốn ban đầu.
- Một số trường (SĐT, mô tả đầy đủ) thường trống.

Điểm số vì thế mang tính **tham khảo**, phần lớn có `assessment_confidence` = *Trung bình/Thấp*.

**Dữ liệu luôn mới, không tích luỹ**: mỗi lượt collector chạy sẽ GHI ĐÈ toàn bộ
`listings[]` của file vùng bằng đúng tin thu thập được trong lượt đó, không giữ/merge
tin của lượt trước — nhà đất bán/gỡ tin rất nhanh nên dữ liệu cũ coi như hết giá trị
tham khảo. Tổng số tin vì vậy có thể dao động (kể cả giảm) giữa các lượt; đó là kết
quả đúng, không phải lỗi.

## Cấu trúc

```
vietnam-realestate-crawler/
├── docs/
│   ├── PLAN.md           # kế hoạch + kiến trúc multi-agent
│   ├── METHODOLOGY.md    # rubric chấm điểm (hợp đồng chung cho agents)
│   └── SOURCES.md        # xếp hạng độ uy tín các trang nguồn
├── data/
│   ├── schema.json       # JSON schema cho dataset mỗi vùng
│   └── <region>.json     # dữ liệu do agents thu thập
├── site/                 # OUTPUT: mở site/index.html
│   ├── index.html        # tổng quan + bảng xếp hạng + link các vùng
│   ├── methodology.html  # phương pháp luận
│   ├── regions/*.html    # trang chi tiết từng vùng
│   └── assets/style.css  # dark theme
└── scripts/build_site.mjs  # generator (thuần Node, không phụ thuộc)
```

## Kiến trúc thực thi (multi-agent, token-managed)

- **Orchestrator (Opus 4.8)** — viết methodology/rubric, spawn agents, tổng hợp, khử
  trùng lặp liên vùng, build site. **Không dùng Fable 5** vì không verify được hạn mức
  tuần ⇒ tránh phát sinh usage credits.
- **6 agents thu thập (Sonnet 5)** — song song, mỗi agent một vùng, dùng WebSearch,
  lọc + chấm điểm theo `METHODOLOGY.md`, ghi `data/<region>.json`.

## Chạy lại

```bash
node scripts/build_site.mjs   # đọc data/*.json → sinh lại site/
```

Mở `site/index.html` bằng trình duyệt. Thêm/cập nhật dữ liệu bằng cách sửa các file
`data/<region>.json` theo `data/schema.json` rồi build lại.

## Hệ thống tự động cuối tuần (`.claude/`)

Repo có sẵn cấu hình multi-agent chạy tự hành sáng T7 (batch A) & CN (batch B, 8h VNT):

- `.claude/commands/weekly-market-scan.md` — slash command `/weekly-market-scan` (Routine gọi lệnh này)
- `.claude/workflows/weekend-market-scan.js` — workflow 4 phase: Refresh → Enrich → Audit → Publish
- `.claude/agents/` — `region-collector` (Sonnet), `listing-enricher` (Sonnet), `data-auditor` (Opus), `report-publisher` (Sonnet)
- `.claude/skills/` — re-methodology, re-permalink-hunting, re-source-tiers, re-data-schema, re-site-build

**Vùng trọng điểm:** `khanh-hoa` (TP. Nha Trang) và `da-nang` (nội thành Đà Nẵng) nằm
trong **cả hai** batch nên được làm mới mỗi cuối tuần, với quota cao hơn và ghi chú ưu
tiên phường/khu nội thành (map `FOCUS` trong `weekend-market-scan.js`).

Mô tả dễ hiểu kèm diagram: `site/how-it-works.html` (link từ dashboard).
