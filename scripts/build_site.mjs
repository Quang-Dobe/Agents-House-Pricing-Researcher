#!/usr/bin/env node
// Static dark-theme site generator v2 for the VN real-estate report.
// Reads data/*.json (schema.json excluded), cross-region dedups, emits site/.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'data');
const SITE = path.join(ROOT, 'site');
const REGIONS_DIR = path.join(SITE, 'regions');
fs.mkdirSync(REGIONS_DIR, { recursive: true });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const fmtVnd = (n) => {
  if (n == null || isNaN(n)) return '—';
  const ty = Math.floor(n / 1e9), tr = Math.round((n % 1e9) / 1e6);
  if (ty > 0) return tr > 0 ? `${ty} tỷ ${tr} triệu` : `${ty} tỷ`;
  return `${Math.round(n / 1e6)} triệu`;
};
const cls = (s) => s >= 7 ? 'good' : s >= 5 ? 'mid' : 'bad';
const fx = (n) => (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toFixed(1);
const median = (arr) => {
  const a = arr.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const fitClass = (fit) => {
  const f = (fit || '').toLowerCase();
  if (f.includes('bất thường')) return 'fit-sus';
  if (f.includes('tốt') || f.includes('dưới')) return 'fit-good';
  if (f.includes('cao hơn')) return 'fit-high';
  return 'fit-ok';
};
const REGION_LABELS = { 'hcm-trung-tam': 'TP.HCM — quận trung tâm', 'hcm-ven': 'TP.HCM — ven & Thủ Đức' };
const shortRegion = (r) => (r || '').split(' (')[0];
const labelFor = (slug, region) => REGION_LABELS[slug] || shortRegion(region);

// ---------- load ----------
let datasets = [];
for (const f of fs.readdirSync(DATA)) {
  if (!f.endsWith('.json') || f === 'schema.json') continue;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
    if (d && Array.isArray(d.listings)) { d.__file = f; datasets.push(d); }
    else console.warn(`skip ${f}: no listings[]`);
  } catch (e) { console.warn(`skip ${f}: ${e.message}`); }
}
datasets.sort((a, b) => (a.region || '').localeCompare(b.region || '', 'vi'));

// ---------- cross-region dedup ----------
const seen = new Map();
let crossDupes = 0;
for (const d of datasets) {
  for (const l of d.listings) {
    l.__region = d.region; l.__slug = d.region_slug;
    const k = (l.dedup_key || `${l.district}|${l.area_m2}|${l.total_price_vnd}`).toLowerCase();
    if (seen.has(k)) {
      crossDupes++;
      const prev = seen.get(k);
      prev.duplicate_count = (prev.duplicate_count || 1) + (l.duplicate_count || 1);
      l.__hidden = true;
    } else seen.set(k, l);
  }
}
const all = [...seen.values()];
const totalListings = all.length;
const directCount = all.filter(l => l.link_type === 'direct').length;
const avgSuit = totalListings ? all.reduce((s, l) => s + (l.suitability_score || 0), 0) / totalListings : 0;
const withLegal = all.filter(l => l.legal_status && /sổ (đỏ|hồng)? ?riêng|thổ cư|shr|sổ riêng/i.test(l.legal_status)).length;
const topPicks = [...all].sort((a, b) => (b.suitability_score || 0) - (a.suitability_score || 0)).slice(0, 15);

// ---------- shared shell ----------
const shell = (title, bodyHtml, depth = 0) => {
  const base = depth === 0 ? '.' : '..';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${base}/assets/style.css">
</head><body>${bodyHtml}
<footer class="site"><div class="wrap">
Báo cáo tạo tự động từ dữ liệu tìm kiếm web (mức snippet — xem <a href="${base}/methodology.html">phương pháp luận</a>).
Đây <b>không phải</b> lời khuyên đầu tư. Trước khi xuống tiền: luôn xem nhà/đất trực tiếp, kiểm tra sổ tại văn phòng đăng ký đất đai, và kiểm tra quy hoạch tại UBND địa phương.
</div></footer>
</body></html>`;
};

const dataBanner = `<div class="banner"><span class="ic">⚠️</span><div>
<strong>Giới hạn dữ liệu:</strong> môi trường chạy báo cáo bị chặn truy cập trực tiếp các trang BĐS, nên dữ liệu lấy từ <strong>kết quả tìm kiếm web</strong> (đoạn mô tả ngắn), <strong>không tải được ảnh</strong> (sổ đỏ, ảnh nhà). Tin có nhãn <strong>“Xem bài đăng gốc”</strong> màu xanh là link trỏ thẳng vào bài đăng; nhãn xám là mới tìm được trang danh mục chứa tin. Điểm số chỉ để <strong>tham khảo ban đầu</strong>.</div></div>`;

// ---------- listing card v2 ----------
const listingCard = (l) => {
  const suit = l.suitability_score || 0, rel = l.reliability_score || 0;
  const det = l.details || {};
  const facts = [];
  if (det.floors) facts.push(`<span class="f">🏠 Kết cấu: <b>${esc(det.floors)}</b></span>`);
  if (det.bedrooms != null) facts.push(`<span class="f">🛏 Phòng ngủ: <b>${esc(det.bedrooms)}</b></span>`);
  if (det.frontage_m != null) facts.push(`<span class="f">↔️ Ngang: <b>${esc(det.frontage_m)} m</b></span>`);
  if (det.road_access) facts.push(`<span class="f">🛣 Đường vào: <b>${esc(det.road_access)}</b></span>`);
  if (det.direction) facts.push(`<span class="f">🧭 Hướng: <b>${esc(det.direction)}</b></span>`);
  for (const ex of (det.extras || []).slice(0, 2)) facts.push(`<span class="f">✨ ${esc(ex)}</span>`);
  const confKey = l.assessment_confidence === 'Cao' ? 'Cao' : l.assessment_confidence === 'Thấp' ? 'Thap' : 'TB';
  const dupChip = (l.duplicate_count || 1) >= 3 ? `<span class="chip dup">⚠ Rao lại ${l.duplicate_count} lần</span>` : '';
  const isDirect = l.link_type === 'direct';
  const searchText = [l.title, l.district, l.ward_or_street, l.plain_summary].join(' ').toLowerCase();
  return `<div class="lcard" data-suit="${suit}" data-rel="${rel}" data-price="${l.total_price_vnd||0}"
    data-area="${l.area_m2||0}" data-type="${esc(l.property_type||'')}" data-link="${isDirect?'direct':'category'}"
    data-district="${esc(l.district||'')}" data-search="${esc(searchText)}">
  <p class="lt">${esc(l.title || 'Tin đăng')}</p>
  ${l.plain_summary ? `<p class="lsummary">${esc(l.plain_summary)}</p>` : ''}
  <div class="pricebar">
    <span class="p">${esc(l.total_price_label || fmtVnd(l.total_price_vnd))}</span>
    <span class="pm">Diện tích <b>${esc(l.area_m2)} m²</b></span>
    <span class="pm">≈ <b>${l.price_per_m2_million != null ? fx(l.price_per_m2_million) + ' triệu/m²' : '—'}</b></span>
  </div>
  <div class="locrow">📍 <b>${esc(l.district || '')}</b>${l.ward_or_street ? ' · ' + esc(l.ward_or_street) : ''} <span style="color:var(--faint)">(${esc(labelFor(l.__slug, l.__region))})</span></div>
  ${facts.length ? `<div class="facts">${facts.join('')}</div>` : ''}
  <div class="chips">
    <span class="chip type">${l.property_type === 'dat_tho_cu' ? '🌍 Đất thổ cư' : '🏡 Nhà ở'}</span>
    ${l.legal_status ? `<span class="chip legal">📜 ${esc(l.legal_status)}</span>` : ''}
    ${l.posted_period ? `<span class="chip">🗓 Đăng ${esc(l.posted_period)}</span>` : ''}
    <span class="chip ${fitClass(l.price_fit)}">💰 ${esc(l.price_fit || 'chưa so được giá')}</span>
    ${dupChip}
  </div>
  <div class="meters">
    <div class="meter"><span class="mk">Đáng mua</span><div class="track"><div class="fill ${cls(suit)}" style="width:${suit*10}%"></div></div><span class="mv ${cls(suit)}">${fx(suit)}</span></div>
    <div class="meter"><span class="mk">Tin đăng uy tín</span><div class="track"><div class="fill ${cls(rel)}" style="width:${rel*10}%"></div></div><span class="mv ${cls(rel)}">${fx(rel)}</span></div>
    <div class="conf-line">Dữ liệu để chấm điểm: <span class="conf conf-${confKey}">${esc(l.assessment_confidence || 'Trung bình')}</span></div>
  </div>
  ${l.suitability_reason ? `<div class="reason"><span class="rk">Vì sao điểm này</span>${esc(l.suitability_reason)}</div>` : ''}
  ${l.description_snippet ? `<details class="desc"><summary>Xem mô tả gốc</summary><div class="body">${esc(l.description_snippet)}</div></details>` : ''}
  <div class="srcline">
    <span class="site">Nguồn: <b>${esc(l.source_site || '')}</b></span>
    <a class="linkbtn ${isDirect ? '' : 'cat'}" href="${esc(l.source_url || '#')}" target="_blank" rel="noopener">
      ${isDirect ? '🔗 Xem bài đăng gốc' : '📂 Trang danh mục chứa tin'} ↗</a>
  </div>
  ${isDirect ? '' : '<div class="link-note">Chưa tìm được link thẳng vào bài — link trên mở trang danh sách của khu vực này.</div>'}
</div>`;
};

// ---------- horizontal bar chart (single measure, one hue, direct labels) ----------
const hbarChart = (title, subtitle, rows /* [{name, value, href}] */, unit) => {
  const max = Math.max(...rows.map(r => r.value || 0), 1);
  return `<div class="chart-card">
  <p class="c-title">${esc(title)}</p>
  <p class="c-sub">${esc(subtitle)}</p>
  ${rows.map(r => `<div class="hbar-row" title="${esc(r.name)}: ${fx(r.value)} ${esc(unit)}">
    <span class="name">${r.href ? `<a href="${esc(r.href)}">${esc(r.name)}</a>` : esc(r.name)}</span>
    <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(2, (r.value / max) * 100)}%"></div></div>
    <span class="val">${fx(r.value)} ${esc(unit)}</span>
  </div>`).join('')}
</div>`;
};

// ---------- region pages ----------
for (const d of datasets) {
  const visible = d.listings.filter(l => !l.__hidden);
  const nDirect = visible.filter(l => l.link_type === 'direct').length;

  // group by district, districts sorted by best suitability desc
  const byDistrict = new Map();
  for (const l of visible) {
    const k = l.district || 'Khác';
    if (!byDistrict.has(k)) byDistrict.set(k, []);
    byDistrict.get(k).push(l);
  }
  const districts = [...byDistrict.entries()].map(([name, ls]) => {
    ls.sort((a, b) => (b.suitability_score || 0) - (a.suitability_score || 0));
    return { name, ls, best: Math.max(...ls.map(l => l.suitability_score || 0)) };
  }).sort((a, b) => b.best - a.best);

  const cardsHtml = districts.map(g =>
    `<div class="district-h" data-districth="${esc(g.name)}">📍 ${esc(g.name)} <span class="count-pill">${g.ls.length} tin</span></div>\n` +
    g.ls.map(listingCard).join('\n')
  ).join('\n');

  const bands = (d.market_bands || []).map(b => `<tr>
    <td>${esc(b.area_name)}</td>
    <td class="num">${b.price_per_m2_low != null ? esc(b.price_per_m2_low) : '—'}${b.price_per_m2_high != null ? ' – ' + esc(b.price_per_m2_high) : ''}${b.price_per_m2_low != null ? ' triệu/m²' : ''}</td>
    <td style="white-space:normal;min-width:260px">${esc(b.price_per_m2_note || '')}</td>
    <td style="white-space:normal;min-width:220px">${esc(b.commentary || '')}</td>
    <td><a href="${esc(b.source_url||'#')}" target="_blank" rel="noopener">nguồn ↗</a></td></tr>`).join('');

  // per-district median đơn giá chart
  const chartRows = districts
    .map(g => ({ name: g.name, value: median(g.ls.map(l => l.price_per_m2_million)) }))
    .filter(r => r.value != null)
    .sort((a, b) => b.value - a.value);

  const body = `<header class="hero"><div class="wrap">
    <div class="crumbs"><a href="../index.html">← Trang tổng quan</a></div>
    <div class="eyebrow">Khu vực</div>
    <h1>${esc(d.region)}</h1>
    <p class="sub">${visible.length} tin dưới 2 tỷ (đã lọc nhà ở / đất thổ cư và loại tin trùng) · ${nDirect}/${visible.length} tin có link thẳng vào bài đăng gốc.</p>
  </div></header>
  <div class="wrap">
    ${dataBanner}
    ${chartRows.length >= 2 ? hbarChart('Đơn giá trung vị theo quận/khu vực', 'Tính từ chính các tin trong báo cáo này — chỉ mang tính so sánh tương đối', chartRows, 'tr/m²') : ''}
    ${bands ? `<h2>Mặt bằng giá khu vực</h2><p class="sec-sub">Dải giá thị trường thu thập từ các bài báo cáo giá — dùng làm mốc so sánh cho từng tin bên dưới.</p>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>Khu vực / trục đường</th><th>Đơn giá</th><th>Ghi chú</th><th>Nhận định</th><th>Nguồn</th></tr></thead>
      <tbody>${bands}</tbody></table></div>` : ''}
    <h2>Danh sách tin <span class="count-pill">${visible.length}</span></h2>
    <p class="sec-sub">Nhóm theo quận/khu vực, trong mỗi nhóm xếp theo điểm “đáng mua” giảm dần. Dùng ô tìm kiếm hoặc đổi cách sắp xếp bên dưới.</p>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Tìm theo đường, phường, quận…" oninput="applyView()">
      <label>Sắp xếp
      <select id="sort" onchange="applyView()">
        <option value="group">Theo quận (mặc định)</option>
        <option value="suit">Điểm đáng mua ↓</option>
        <option value="rel">Độ uy tín ↓</option>
        <option value="price">Giá thấp → cao</option>
        <option value="area">Diện tích lớn → nhỏ</option>
      </select></label>
      <label>Loại
      <select id="ftype" onchange="applyView()">
        <option value="">Tất cả</option><option value="nha_o">Nhà ở</option><option value="dat_tho_cu">Đất thổ cư</option>
      </select></label>
      <label>Link
      <select id="flink" onchange="applyView()">
        <option value="">Tất cả</option><option value="direct">Chỉ tin có link bài gốc</option>
      </select></label>
    </div>
    <div class="lgrid" id="cards">${cardsHtml}</div>
  </div>
  <script>
  function applyView(){
    const q=(document.getElementById('q').value||'').toLowerCase().trim();
    const sort=document.getElementById('sort').value;
    const ft=document.getElementById('ftype').value, fl=document.getElementById('flink').value;
    const g=document.getElementById('cards');
    const cards=[...g.querySelectorAll('.lcard')], heads=[...g.querySelectorAll('.district-h')];
    const grouped = sort==='group' && !q && !ft && !fl;
    heads.forEach(h=>h.style.display=grouped?'':'none');
    cards.forEach(c=>{
      const ok=(!q||c.dataset.search.includes(q))&&(!ft||c.dataset.type===ft)&&(!fl||c.dataset.link===fl);
      c.style.display=ok?'':'none';
    });
    if(!grouped){
      const key=sort==='group'?'suit':sort, asc=sort==='price';
      cards.sort((a,b)=>{const av=+a.dataset[key],bv=+b.dataset[key];return asc?av-bv:bv-av;});
      cards.forEach(c=>g.appendChild(c));
    } else {
      heads.forEach(h=>{ g.appendChild(h); cards.filter(c=>c.dataset.district===h.dataset.districth).forEach(c=>g.appendChild(c)); });
    }
  }
  </script>`;
  fs.writeFileSync(path.join(REGIONS_DIR, `${d.region_slug}.html`), shell(`${shortRegion(d.region)} — Nhà đất dưới 2 tỷ`, body, 1));
}

// ---------- index ----------
const regionCards = datasets.map(d => {
  const vis = d.listings.filter(l => !l.__hidden);
  const avg = vis.length ? vis.reduce((s, l) => s + (l.suitability_score || 0), 0) / vis.length : 0;
  const nd = vis.filter(l => l.link_type === 'direct').length;
  return `<a class="rcard" href="regions/${esc(d.region_slug)}.html">
    <div class="rc-t">${esc(labelFor(d.region_slug, d.region))}</div>
    <div class="rc-m">${vis.length} tin · ${nd} link bài gốc · ${(d.market_bands||[]).length} dải giá tham chiếu</div>
    <div class="rc-bar"><span>Đáng mua TB</span><div class="hbar-track"><div class="hbar-fill" style="width:${avg*10}%"></div></div><span class="sc ${cls(avg)}">${fx(avg)}</span></div>
  </a>`;
}).join('\n');

const regionChartRows = datasets.map(d => {
  const vis = d.listings.filter(l => !l.__hidden);
  return { name: labelFor(d.region_slug, d.region), value: median(vis.map(l => l.price_per_m2_million)), href: `regions/${d.region_slug}.html` };
}).filter(r => r.value != null).sort((a, b) => b.value - a.value);

const topRows = topPicks.map((l, i) => `<tr>
  <td class="num">${i + 1}</td>
  <td>${esc(l.district || '')}<br><span style="color:var(--faint);font-size:11.5px">${esc(labelFor(l.__slug, l.__region))}</span></td>
  <td>${l.property_type === 'dat_tho_cu' ? 'Đất thổ cư' : 'Nhà ở'}</td>
  <td class="num"><b>${esc(l.total_price_label || fmtVnd(l.total_price_vnd))}</b></td>
  <td class="num">${esc(l.area_m2)} m²</td>
  <td class="num">${l.price_per_m2_million != null ? fx(l.price_per_m2_million) + ' tr/m²' : '—'}</td>
  <td class="num sc ${cls(l.reliability_score||0)}">${fx(l.reliability_score)}</td>
  <td class="num sc ${cls(l.suitability_score||0)}">${fx(l.suitability_score)}</td>
  <td><span class="conf conf-${l.assessment_confidence === 'Cao' ? 'Cao' : l.assessment_confidence === 'Thấp' ? 'Thap' : 'TB'}">${esc(l.assessment_confidence||'—')}</span></td>
  <td><a href="${esc(l.source_url||'#')}" target="_blank" rel="noopener">${l.link_type === 'direct' ? 'bài gốc' : 'danh mục'} ↗</a></td>
</tr>`).join('');

const indexBody = `<header class="hero"><div class="wrap">
  <div class="eyebrow">🏠 Báo cáo khảo sát · cập nhật 07/2026</div>
  <h1>Nhà &amp; đất thổ cư dưới 2 tỷ — ${datasets.length} khu vực khảo sát</h1>
  <p class="sub">TP.HCM (tất cả các quận), Đà Nẵng, Khánh Hòa (gồm cả Ninh Thuận cũ sau sáp nhập), Lâm Đồng (Đà Lạt), Bình Dương, Bà Rịa–Vũng Tàu, Đồng Nai, Long An và Cần Thơ.
  Mỗi tin được chấm hai điểm dễ hiểu: <b>“đáng mua”</b> (tổng hợp giá, pháp lý, vị trí) và <b>“tin đăng uy tín”</b> (nguồn đăng, thông tin đầy đủ, giá có hợp lý không) — kèm mức
  <b>“dữ liệu để chấm điểm”</b> cho biết đánh giá chắc tay đến đâu. <a href="methodology.html">Xem cách chấm điểm →</a></p>
  <div class="stats">
    <div class="stat"><div class="n">${totalListings}</div><div class="l">Tin đã lọc &amp; khử trùng lặp</div></div>
    <div class="stat"><div class="n">${datasets.length}</div><div class="l">Khu vực khảo sát</div></div>
    <div class="stat"><div class="n">${directCount}</div><div class="l">Tin có link thẳng bài gốc</div></div>
    <div class="stat"><div class="n sc ${cls(avgSuit)}">${fx(avgSuit)}</div><div class="l">Điểm “đáng mua” trung bình /10</div></div>
    <div class="stat"><div class="n">${withLegal}</div><div class="l">Tin nêu sổ riêng / thổ cư</div></div>
  </div>
</div></header>
<div class="wrap">
  ${dataBanner}
  <div class="hint">
    <b>Cách đọc báo cáo (30 giây):</b>
    <div class="hrow"><span class="hk">Đáng mua /10</span><span>Tổng hợp: giá so với mặt bằng khu vực, pháp lý rõ không, vị trí thế nào, tin có bị rao đi rao lại không. Trên 7 = nên xem sớm; dưới 5 = cân nhắc kỹ.</span></div>
    <div class="hrow"><span class="hk">Tin đăng uy tín /10</span><span>Bản thân tin đăng đáng tin đến đâu: đăng ở trang lớn không, thông tin có đầy đủ không, giá có "rẻ bất thường" không.</span></div>
    <div class="hrow"><span class="hk">Dữ liệu để chấm</span><span>Cao / Trung bình / Thấp — dữ liệu thu được đủ chắc để tin điểm số chưa. Thấp nghĩa là thiếu thông tin, điểm chỉ là ước lượng.</span></div>
    <div class="hrow"><span class="hk">💰 Nhãn giá</span><span>"Rẻ bất thường" không phải tin vui — giá thấp hơn hẳn mặt bằng thường do vướng pháp lý, sổ chung, hoặc tin ảo. Luôn cảnh giác.</span></div>
  </div>
  ${regionChartRows.length >= 2 ? hbarChart('Đơn giá trung vị theo khu vực', 'Trung vị triệu/m² của các tin dưới 2 tỷ trong báo cáo — khu vực càng cao, cùng số tiền mua được càng ít m²', regionChartRows, 'tr/m²') : ''}
  <h2>Khám phá theo khu vực</h2>
  <p class="sec-sub">Mỗi trang khu vực có bảng mặt bằng giá riêng, biểu đồ đơn giá theo quận, và toàn bộ tin đã chấm điểm.</p>
  <div class="grid">${regionCards}</div>
  <h2>🏆 Top 15 tin đáng mua nhất</h2>
  <p class="sec-sub">Xếp theo điểm “đáng mua”. Bấm cột cuối để mở tin. Điểm cao ở đây vẫn cần đi xem trực tiếp trước khi quyết định.</p>
  <div class="tbl-scroll"><table class="tbl">
    <thead><tr><th>#</th><th>Khu vực</th><th>Loại</th><th>Giá</th><th>DT</th><th>Đơn giá</th><th>Uy tín</th><th>Đáng mua</th><th>Dữ liệu</th><th>Link</th></tr></thead>
    <tbody>${topRows || '<tr><td colspan="10">Chưa có dữ liệu.</td></tr>'}</tbody>
  </table></div>
</div>`;
fs.writeFileSync(path.join(SITE, 'index.html'), shell(`Nhà đất dưới 2 tỷ — báo cáo ${datasets.length} khu vực`, indexBody, 0));

// ---------- methodology page ----------
function mdToHtml(md) {
  const lines = md.split('\n'); let html = '', inTable = false, inUl = false, inCode = false, inOl = false;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (let raw of lines) {
    if (raw.startsWith('```')) { inCode = !inCode; html += inCode ? '<pre>' : '</pre>'; continue; }
    if (inCode) { html += esc(raw) + '\n'; continue; }
    if (/^\|/.test(raw)) {
      const cells = raw.split('|').slice(1, -1).map(c => c.trim());
      if (/^[\s|:-]+$/.test(raw)) continue;
      if (!inTable) { html += '<div class="tbl-scroll"><table class="tbl"><tbody>'; inTable = true; }
      html += '<tr>' + cells.map(c => `<td style="white-space:normal">${inline(c)}</td>`).join('') + '</tr>'; continue;
    } else if (inTable) { html += '</tbody></table></div>'; inTable = false; }
    if (/^\s*\d+\. /.test(raw)) { if (!inOl) { html += '<ol>'; inOl = true; } html += `<li>${inline(raw.replace(/^\s*\d+\. /, ''))}</li>`; continue; }
    else if (inOl && !/^\s{3,}/.test(raw)) { html += '</ol>'; inOl = false; }
    if (/^\s*[-*] /.test(raw)) { if (!inUl) { html += '<ul>'; inUl = true; } html += `<li>${inline(raw.replace(/^\s*[-*] /, ''))}</li>`; continue; }
    else if (inUl) { html += '</ul>'; inUl = false; }
    if (/^### /.test(raw)) html += `<h3>${inline(raw.slice(4))}</h3>`;
    else if (/^## /.test(raw)) html += `<h2>${inline(raw.slice(3))}</h2>`;
    else if (/^# /.test(raw)) html += '';
    else if (/^> /.test(raw)) html += `<div class="hint">${inline(raw.slice(2))}</div>`;
    else if (raw.trim() === '') html += '';
    else html += `<p>${inline(raw)}</p>`;
  }
  if (inTable) html += '</tbody></table></div>'; if (inUl) html += '</ul>'; if (inOl) html += '</ol>'; if (inCode) html += '</pre>';
  return html;
}
let methoBody = `<header class="hero"><div class="wrap"><div class="crumbs"><a href="index.html">← Trang tổng quan</a></div>
<div class="eyebrow">Phương pháp</div><h1>Cách thu thập &amp; chấm điểm</h1></div></header><div class="wrap">`;
try { methoBody += mdToHtml(fs.readFileSync(path.join(ROOT, 'docs', 'METHODOLOGY.md'), 'utf8')); }
catch { methoBody += '<p>Chưa có METHODOLOGY.md</p>'; }
methoBody += '</div>';
fs.writeFileSync(path.join(SITE, 'methodology.html'), shell('Phương pháp luận', methoBody, 0));

console.log(`Built v2: ${datasets.length} regions, ${totalListings} listings (${directCount} direct links), ${crossDupes} cross-region dupes merged.`);
