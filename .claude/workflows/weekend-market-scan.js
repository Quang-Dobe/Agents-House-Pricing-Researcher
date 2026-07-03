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
const BATCHES = {
  A: ['hcm-trung-tam', 'hcm-ven', 'da-nang', 'khanh-hoa', 'lam-dong'],
  B: ['binh-duong', 'vung-tau', 'dong-nai', 'long-an', 'can-tho'],
}
const batch = (args && args.batch) === 'B' ? 'B' : 'A'
const regions = (args && Array.isArray(args.regions) && args.regions.length) ? args.regions : BATCHES[batch]
const ROOT = '/workspace/agents-house-pricing-researcher'

const COLLECT_SUMMARY = {
  type: 'object',
  required: ['written', 'listings_total', 'new_listings', 'notes'],
  properties: {
    written: { type: 'boolean' },
    listings_total: { type: 'integer' },
    new_listings: { type: 'integer' },
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
  (slug) => agent(
    `Bạn được giao vùng có file ${ROOT}/data/${slug}.json. Làm đúng vai trò region-collector của bạn:
thu thập tin MỚI dưới 2 tỷ cho vùng này (tuần gần đây nếu xác định được), merge vào file,
chấm điểm đầy đủ, validate. Repo root: ${ROOT}. Mục tiêu 3-8 tin mới CHẤT LƯỢNG (ít hơn
cũng được nếu trung thực — không ép số).`,
    { agentType: 'region-collector', label: `collect:${slug}`, phase: 'Refresh', schema: COLLECT_SUMMARY }
  ),
  (collectResult, slug) => {
    if (!collectResult || !collectResult.written) { log(`skip enrich ${slug}: collect failed`); return { slug, collect: collectResult, enrich: null } }
    return agent(
      `File của bạn: ${ROOT}/data/${slug}.json. Làm đúng vai trò listing-enricher: ưu tiên
nâng link_type category→direct cho các tin MỚI THÊM hôm nay trước, sau đó tối đa 5 tin cũ
chưa direct. Đào thêm details{} nơi snippet cho phép. Validate trước khi kết thúc. Repo root: ${ROOT}.`,
      { agentType: 'listing-enricher', label: `enrich:${slug}`, phase: 'Enrich', schema: ENRICH_SUMMARY }
    ).then(e => ({ slug, collect: collectResult, enrich: e }))
  }
)

const okRegions = refreshed.filter(Boolean).filter(r => r.collect && r.collect.written)
const newCount = okRegions.reduce((s, r) => s + (r.collect.new_listings || 0), 0)
log(`Refresh done: ${okRegions.length}/${regions.length} regions, +${newCount} new listings`)

// ---- Phase 3: single adversarial audit over the whole batch (needs all files → barrier is correct) ----
const audit = await agent(
  `Kiểm toán các file sau (vừa qua pass thu thập + enrich hôm nay):
${okRegions.map(r => `${ROOT}/data/${r.slug}.json (+${r.collect.new_listings || 0} tin mới)`).join('\n')}
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
"Weekend scan batch ${batch}: +${newCount} listings across ${okRegions.length} regions",
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
