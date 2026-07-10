export const meta = {
  name: 'weekend-market-scan',
  description: 'Autonomous weekend refresh: collect new sub-2-tỷ listings for one batch of regions, adversarially audit, then rebuild and publish the report site',
  whenToUse: 'Invoked by /weekly-market-scan (Routine, Sat/Sun 8AM VNT). Pass args {batch: "A"|"B"} — A = Sat regions, B = Sun regions. Optionally args {regions: [...slugs]} to override.',
  phases: [
    { title: 'Refresh', detail: 'region-collector per region (Sonnet)', model: 'sonnet' },
    { title: 'Enrich', detail: 'listing-enricher: permalink upgrades (Sonnet)', model: 'sonnet' },
    { title: 'Audit', detail: 'data-auditor adversarial gate (Opus)', model: 'opus' },
    { title: 'Publish', detail: 'report-publisher: build + push + Pages (Sonnet)', model: 'sonnet' },
  ],
}

// ---- region batches (rotation: Sat = A, Sun = B) ----
// khanh-hoa is a standing focus region (user request 2026-07): included in BOTH
// batches so it refreshes every weekend run instead of once every two weeks.
const BATCHES = {
  A: ['hcm-trung-tam', 'hcm-ven', 'da-nang', 'khanh-hoa', 'lam-dong'],
  B: ['binh-duong', 'vung-tau', 'dong-nai', 'long-an', 'can-tho', 'khanh-hoa'],
}
const batch = (args && args.batch) === 'B' ? 'B' : 'A'
const regions = (args && Array.isArray(args.regions) && args.regions.length) ? args.regions : BATCHES[batch]
const ROOT = '/workspace/agents-house-pricing-researcher'

// Per-region collection overrides — quota + extra focus note appended to the
// default region-collector prompt. Default quota stays "3-8" when a slug has no entry.
const FOCUS = {
  'khanh-hoa': {
    quota: '8-15',
    note: `Ưu tiên TUYỆT ĐỐI TP. Nha Trang (nội thành + các phường ven biển, khu dân cư
hiện hữu) trước — đây là khu vực người dùng quan tâm nhất trong tỉnh Khánh Hòa. Tìm đủ
tin Nha Trang trước khi mở rộng sang Cam Ranh, Diên Khánh, Ninh Hòa, Cam Lâm, Vạn Ninh,
Khánh Vĩnh, Khánh Sơn, hoặc khu vực Ninh Thuận cũ (Phan Rang-Tháp Chàm, Ninh Hải, Ninh Phước).`,
  },
}

const COLLECT_SUMMARY = {
  type: 'object',
  required: ['written', 'new_listings', 'notes'],
  properties: {
    written: { type: 'boolean' },
    new_listings: { type: 'integer', description: 'total listings in the file after this pass — the file was fully replaced, so this equals the fresh count' },
    new_direct: { type: 'integer' },
    notes: { type: 'string', description: 'gaps + honesty notes, max 3 sentences' },
  },
}
const ENRICH_SUMMARY = {
  type: 'object',
  required: ['written', 'upgraded_to_direct', 'notes'],
  properties: {
    written: { type: 'boolean' },
    upgraded_to_direct: { type: 'integer' },
    removed: { type: 'integer' },
    notes: { type: 'string' },
  },
}
const AUDIT_SUMMARY = {
  type: 'object',
  required: ['verdict', 'rescored', 'removed', 'notes'],
  properties: {
    verdict: { enum: ['DAT', 'DAT_CO_SUA', 'CAN_CHAY_LAI'] },
    rescored: { type: 'integer' },
    downgraded_links: { type: 'integer' },
    removed: { type: 'integer' },
    notes: { type: 'string', description: 'per-file findings, max 6 sentences' },
  },
}
const PUBLISH_SUMMARY = {
  type: 'object',
  required: ['pushed', 'build_line', 'notes'],
  properties: {
    pushed: { type: 'boolean' },
    build_line: { type: 'string' },
    commit: { type: 'string' },
    deploy_status: { type: 'string' },
    notes: { type: 'string' },
  },
}

log(`Weekend scan batch ${batch}: ${regions.join(', ')}`)

// ---- Phase 1+2 per region as a pipeline (collect → enrich), no barrier between regions ----
const refreshed = await pipeline(
  regions,
  (slug) => {
    const focus = FOCUS[slug]
    const quota = focus ? focus.quota : '3-8'
    const focusNote = focus ? `\n${focus.note}` : ''
    return agent(
      `Bạn được giao vùng có file ${ROOT}/data/${slug}.json. Làm đúng vai trò region-collector của bạn:
thu thập MỘT BỘ tin dưới 2 tỷ đang rao cho vùng này và GHI ĐÈ TOÀN BỘ file (không giữ/merge
tin của lượt trước — dữ liệu BĐS cũ không còn đảm bảo còn bán, xem skill re-methodology).
Chấm điểm đầy đủ, validate. Repo root: ${ROOT}. Mục tiêu ${quota} tin CHẤT LƯỢNG (ít hơn
cũng được nếu trung thực — không ép số).${focusNote}`,
      { agentType: 'region-collector', label: `collect:${slug}`, phase: 'Refresh', schema: COLLECT_SUMMARY }
    )
  },
  (collectResult, slug) => {
    if (!collectResult || !collectResult.written) { log(`skip enrich ${slug}: collect failed`); return { slug, collect: collectResult, enrich: null } }
    return agent(
      `File của bạn: ${ROOT}/data/${slug}.json. Làm đúng vai trò listing-enricher: ưu tiên
nâng link_type category→direct cho tất cả tin trong file (toàn bộ đều là tin region-collector
vừa thu thập trong lượt này — file đã được ghi đè, không có tin cũ). Đào thêm details{} nơi
snippet cho phép. Validate trước khi kết thúc. Repo root: ${ROOT}.`,
      { agentType: 'listing-enricher', label: `enrich:${slug}`, phase: 'Enrich', schema: ENRICH_SUMMARY }
    ).then(e => ({ slug, collect: collectResult, enrich: e }))
  }
)

const okRegions = refreshed.filter(Boolean).filter(r => r.collect && r.collect.written)
const freshCount = okRegions.reduce((s, r) => s + (r.collect.new_listings || 0), 0)
log(`Refresh done: ${okRegions.length}/${regions.length} regions, ${freshCount} fresh listings (old data replaced, not merged)`)

// ---- Phase 3: single adversarial audit over the whole batch (needs all files → barrier is correct) ----
const audit = await agent(
  `Kiểm toán các file sau (vừa qua pass thu thập + enrich hôm nay — mỗi file đã được
GHI ĐÈ toàn bộ nên toàn bộ tin trong đó đều thuộc lượt này, không có tin cũ):
${okRegions.map(r => `${ROOT}/data/${r.slug}.json (${r.collect.new_listings || 0} tin)`).join('\n')}
Làm đúng vai trò data-auditor: soát máy móc, rubric, URL, chống bịa, nhãn "rẻ bất thường",
trùng lặp liên vùng (so cả với các file vùng KHÔNG trong batch). Sửa trực tiếp khi có căn cứ,
ghi lý do vào notes của file. Repo root: ${ROOT}.`,
  { agentType: 'data-auditor', label: 'audit:batch', phase: 'Audit', schema: AUDIT_SUMMARY }
)

if (audit && audit.verdict === 'CAN_CHAY_LAI') {
  log('Audit verdict: CẦN CHẠY LẠI — không publish. Xem notes của auditor.')
  return { batch, regions, refreshed: okRegions.map(r => ({ slug: r.slug, ...r.collect })), audit, published: false }
}

// ---- Phase 4: publish ----
const publish = await agent(
  `Dữ liệu batch ${batch} đã qua audit (verdict: ${audit ? audit.verdict : 'unknown'}).
Làm đúng vai trò report-publisher: build, QA, commit với message
"Weekend scan batch ${batch}: ${freshCount} fresh listings across ${okRegions.length} regions",
push origin main, kiểm tra/retry deploy theo skill. Repo root: ${ROOT}.`,
  { agentType: 'report-publisher', label: 'publish', phase: 'Publish', schema: PUBLISH_SUMMARY }
)

return {
  batch,
  regions,
  refreshed: okRegions.map(r => ({ slug: r.slug, new: r.collect.new_listings || 0, direct: r.collect.new_direct || 0, upgraded: r.enrich ? r.enrich.upgraded_to_direct : 0 })),
  audit,
  publish,
  published: !!(publish && publish.pushed),
}
