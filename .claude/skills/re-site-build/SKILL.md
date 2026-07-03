---
name: re-site-build
description: Load when rebuilding the static report site, QA-checking output, committing, pushing, or diagnosing GitHub Pages deploy failures for this repo.
---

# Build · QA · Deploy site báo cáo

## Build

```bash
cd <repo-root>
node scripts/build_site.mjs
# kỳ vọng: "Built v2: N regions, M listings (K direct links), X cross-region dupes merged."
```

Generator đọc `data/*.json` (bỏ schema.json), tự khử trùng lặp liên vùng, sinh
`site/index.html`, `site/methodology.html`, `site/regions/*.html`. KHÔNG sửa tay
các file HTML sinh ra — sửa generator hoặc data rồi build lại.
`site/how-it-works.html` là file tĩnh viết tay — build KHÔNG đụng vào.

## QA bắt buộc sau build

```bash
# 1. Leak check — phải rỗng
grep -o -E 'NaN|undefined|>null<' site/index.html site/regions/*.html | head
# 2. Đếm sanity
node -e "const fs=require('fs');let n=0;for(const f of fs.readdirSync('data')){if(f==='schema.json'||!f.endsWith('.json'))continue;n+=require('./data/'+f).listings.length}console.log('total listings:',n)"
```
Nếu có Playwright (`/opt/pw-browsers/chromium-*/chrome-linux/chrome`), chụp
screenshot `file://.../site/index.html` để soi mắt thường trước khi push.

## Commit & Push

- Commit message tiếng Anh, dòng đầu ngắn gọn nêu thay đổi + số liệu.
- Push thẳng `main` (repo này chủ cho phép): `git push origin main`.
- Push lên main → workflow `.github/workflows/deploy-pages.yml` tự build lại và
  deploy GitHub Pages: https://quang-dobe.github.io/Agents-House-Pricing-Researcher/

## Xử lý lỗi deploy đã biết

- **"Deployment failed, try again later"** ở bước deploy-pages = lỗi tạm thời của
  hạ tầng Pages (đã gặp nhiều lần). Fix: chờ 2-4 phút rồi push empty commit
  (`git commit --allow-empty -m "Retry Pages deploy (transient)"`) hoặc re-run
  workflow. KHÔNG phải lỗi code.
- **"Resource not accessible by integration"** khi enable Pages = phải bật Pages
  thủ công trong Settings (một lần duy nhất, đã làm).
- Token GitHub App không dispatch/rerun workflow được (403) → dùng empty commit.
