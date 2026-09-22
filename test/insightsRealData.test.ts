import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { ShotRecord, PaginatedShots } from '../src/api/decaid/types.ts'
import { attachDetail, calendarParts, coversWindow, inWindow, matches, normalizeShot, reconcileHistory, reportingWindow, summarize, timeWindowCounts, validHistoryCache, type HistoryCache } from '../src/features/insights/historyData.ts'
import { HistoryRepository } from '../src/features/insights/historyRepository.ts'
import { historyGet } from '../src/features/insights/historyTransport.ts'
import { readInsightsRoute, writeInsightsRoute } from '../src/features/insights/insightsRoute.ts'

const now = new Date('2026-09-13T04:00:00Z')
const shot = (id = 'a', patch: Partial<ShotRecord> = {}): ShotRecord => ({ id, timestamp: '2026-09-12T07:00:00Z', workflow: { profile: { title: 'Adaptive', beverage_type: 'espresso', steps: [{ seconds: 60, pressure: 9 }] }, context: { targetDoseWeight: 18, targetYield: 40 } }, annotations: { actualYield: 36 }, ...patch })
const page = (items: ShotRecord[], total = items.length): PaginatedShots => ({ items, total, limit: 100, offset: 0 })
const cacheOf = (items: ShotRecord[], total = items.length) => reconcileHistory(page(items, total), null, 'source-a', 'Asia/Singapore', now)
const detail = (id: string) => ({ id, profileName: 'Adaptive', totalYield: '36', totalTime: '29', points: [{ elapsedMs: 0, weight: 0 }, { elapsedMs: 29000, weight: 36 }] })

test('real summary uses shot-time dose and actual yield, never target yield or planned duration', () => {
  const r = normalizeShot(shot(), 'Asia/Singapore')!
  assert.equal(r.dose, 18); assert.equal(r.yield, 36); assert.equal(r.duration, null)
  assert.equal(normalizeShot(shot('b', { annotations: { actualDoseWeight: 19.5, actualYield: 0 } }), 'UTC')!.dose, 19.5)
  assert.equal(normalizeShot(shot('b', { annotations: { actualYield: 0 } }), 'UTC')!.yield, 0)
  assert.equal(normalizeShot(shot('b', { annotations: null }), 'UTC')!.yield, null)
  assert.equal(normalizeShot(shot('b', { annotations: { actualYield: NaN }, workflow: {} }), 'UTC')!.dose, null)
})
test('history retains manual stops and separates pour-over, cleaning and unknown activities', () => {
  assert.equal(normalizeShot(shot('a', { stopReason: 'apiStop' }), 'UTC')!.beverage, 'espresso')
  for (const beverage_type of ['pourover', 'cleaning', 'calibrate', 'manual']) assert.equal(normalizeShot(shot('a', { workflow: { profile: { beverage_type } } }), 'UTC')!.beverage, beverage_type === 'pourover' ? 'pourover' : beverage_type === 'manual' ? 'other' : 'excluded')
  assert.equal(normalizeShot(shot('a', { annotations: { extras: { simulated: true } } }), 'UTC')!.beverage, 'excluded')
  assert.equal(normalizeShot(shot('a', { annotations: { extras: {} }, metadata: { simulated: true } }), 'UTC')!.beverage, 'excluded')
})
test('profile usage combines recipe adjustments under the same name but preserves named variants', () => {
  const a = normalizeShot(shot(), 'UTC')!
  const b = normalizeShot(shot('b', { workflow: { profile: { steps: [{ pressure: 9, seconds: 60 }], beverage_type: 'espresso', title: 'Adaptive' } } }), 'UTC')!
  const c = normalizeShot(shot('c', { workflow: { profile: { title: 'Adaptive', beverage_type: 'espresso', steps: [{ pressure: 6 }] } } }), 'UTC')!
  assert.equal(a.profileKey, b.profileKey); assert.equal(a.profileKey, c.profileKey)
  assert.notEqual(a.signature, c.signature)
  assert.deepEqual(summarize([a, b, c]).profileCounts.map(p => p.count), [3])
  const variant = normalizeShot(shot('d', { workflow: { profile: { title: 'Adaptive (x)', beverage_type: 'espresso' } } }), 'UTC')!
  const gentle = normalizeShot(shot('e', { workflow: { profile: { title: 'Adaptive Gentle', beverage_type: 'espresso' } } }), 'UTC')!
  const renamedCase = normalizeShot(shot('f', { workflow: { profile: { title: ' adaptive ', beverage_type: 'espresso' } } }), 'UTC')!
  const tea = normalizeShot(shot('g', { workflow: { profile: { title: 'Adaptive', beverage_type: 'pourover' } } }), 'UTC')!
  assert.equal(renamedCase.profileKey, a.profileKey)
  assert.equal(new Set([a, variant, gentle, tea].map(r => r.profileKey)).size, 4)
  assert.equal([a, b, c, variant].filter(r => matches(r, { kind: 'profile', value: a.profileKey })).length, 3)
})

test('old offline snapshot groups migrate without discarding cached graphs or shot revisions', async () => {
  const old = cacheOf([shot('a'), shot('b')])
  old.records.forEach((r, i) => { r.profileKey = `recipe-old-${i}` })
  old.details.a = detail('a')
  old.records.find(r => r.id === 'a')!.duration = 29
  let saved: HistoryCache | null = null
  const repo = new HistoryRepository('source-a', 'UTC', {
    storage: { read: async () => old, write: async cache => { saved = cache } },
    page: async () => { throw Error('offline') }, detail: async () => { throw Error('offline') }, toDetail: () => detail('a'),
  })
  await repo.refresh()
  assert.equal(repo.state.status, 'offline')
  assert.deepEqual(summarize(repo.state.cache!.records).profileCounts.map(p => p.count), [2])
  assert.equal((await repo.detail('a')).totalTime, '29')
  assert.ok(saved)
  assert.equal(repo.state.cache!.records[0].signature, old.records[0].signature)
})

test('offline cache reconciles graph duration before the first list snapshot without fetching', async () => {
  const old = cacheOf([shot('a'), shot('b')])
  old.details.a = detail('a')
  let requests = 0
  let persisted: HistoryCache | null = null
  const repo = new HistoryRepository('source-a', 'UTC', {
    storage: { read: async () => old, write: async value => { persisted = value } },
    page: async () => { requests++; throw Error('offline') },
    detail: async () => { requests++; throw Error('offline') }, toDetail: () => detail('a'),
  })
  const seen: (number | null | undefined)[] = []
  repo.subscribe(() => { seen.push(repo.state.cache?.records.find(r => r.id === 'a')?.duration) })
  await repo.load()
  assert.equal(seen[0], 29)
  assert.equal(repo.state.cache!.records.find(r => r.id === 'b')!.duration, null)
  assert.equal(requests, 0)
  assert.ok(persisted)
  assert.equal(old.records.find(r => r.id === 'a')!.duration, null)
})

test('known summary duration survives refresh without a graph but not a changed shot revision', () => {
  const initial = cacheOf([shot('a')])
  initial.records[0].duration = 29
  const refreshed = reconcileHistory(page([shot('a')]), initial, 'source-a', 'UTC', now)
  assert.equal(refreshed.records[0].duration, 29)
  assert.equal(refreshed.details.a, undefined)
  const edited = reconcileHistory(page([shot('a', { annotations: { actualYield: 45 } })]), initial, 'source-a', 'UTC', now)
  assert.equal(edited.records[0].duration, null)
})

test('cached duration reconciliation preserves zero and rejects missing or invalid graph time', async () => {
  for (const totalTime of ['0', '29', '—', '', '  ', 'NaN', '-1', 'Infinity']) {
    const old = cacheOf([shot('a')])
    old.details.a = { ...detail('a'), totalTime }
    const repo = new HistoryRepository('source-a', 'UTC', {
      storage: { read: async () => old, write: async () => {} },
      page: async () => page([]), detail: async () => shot(), toDetail: () => detail('a'),
    })
    await repo.load()
    assert.equal(repo.state.cache!.records[0].duration, totalTime === '0' ? 0 : totalTime === '29' ? 29 : null)
  }
})

test('home entry has full-width inner layouts and no routine status subtext', () => {
  const component = readFileSync(new URL('../src/features/insights/InsightsHome.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/features/insights/insights.css', import.meta.url), 'utf8')
  assert.doesNotMatch(component, /Espresso · completed days/)
  assert.match(component, /status && <span className="ins-entry-status"/)
  for (const selector of ['ins-entry-content', 'ins-entry-week', 'ins-entry-summary', 'ins-entry-latest-content']) assert.match(css, new RegExp(`\\.${selector} \\{[^}]*width:100%`))
})
test('home insight title stays compact and tablet bars retain top breathing room', () => {
  const css = readFileSync(new URL('../src/features/insights/insights.css', import.meta.url), 'utf8')
  const tabletCss = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /\.ins-entry-summary>strong \{ font-size:14px; line-height:18px/)
  assert.match(css, /\.ins-entry-content \{[^}]*padding:24px 24px 20px/)
  assert.match(tabletCss, /\.app-shell \.ins-entry-content \{padding:20px 20px 16px/)
  assert.match(tabletCss, /\.app-shell \.ins-entry-week \{min-height:22px;max-height:66px/)
  assert.match(tabletCss, /\.app-shell \.ins-entry-shot-caption \{padding:6px 20px 16px/)
  assert.match(css, /\.ins-entry-shot-caption \{[^}]*flex-shrink:0/)
  assert.match(css, /\.ins-entry-shot-chart \{[^}]*min-height:0;[^}]*padding:0/)
})
test('reporting windows use calendar dates across DST; 30-day comparison spans 60 days', () => {
  assert.deepEqual(reportingWindow(7, 'America/New_York', new Date('2026-03-09T12:00:00Z')), { start: '2026-03-02', end: '2026-03-09' })
  assert.deepEqual(reportingWindow(30, 'Asia/Singapore', now, true), { start: '2026-07-15', end: '2026-08-14' })
  assert.equal(calendarParts('2026-09-12T23:00:00Z', 'Asia/Singapore')!.date, '2026-09-13')
  assert.equal(calendarParts('2026-09-12T23:00:00.123456', 'Asia/Singapore')!.hour, 23)
})
test('record cutoff and stale offline calendar days cannot masquerade as a complete period', () => {
  const truncated = cacheOf([shot()], 150)
  const window = reportingWindow(7, 'Asia/Singapore', now)
  assert.equal(coversWindow(truncated, window), false)
  const older = cacheOf([shot('old', { timestamp: '2026-09-05T12:00:00Z' })], 150)
  assert.equal(coversWindow(older, window), true)
  assert.equal(coversWindow(cacheOf([shot()]), window), true)
  assert.equal(coversWindow(cacheOf([shot()]), { ...window, end: '2026-09-14' }), false)
})
test('bad summaries, duplicate IDs and malformed pages fail safely', () => {
  assert.equal(normalizeShot(shot('a', { timestamp: 'bad' }), 'UTC'), null)
  const badDate = cacheOf([shot('a', { timestamp: 'bad' })])
  assert.equal(badDate.omitted, 1); assert.equal(coversWindow(badDate, reportingWindow(7, 'UTC', now)), false)
  assert.throws(() => cacheOf([shot(), shot()]))
  assert.throws(() => cacheOf(Array.from({ length: 1001 }, (_, i) => shot(String(i)))))
  assert.throws(() => cacheOf([], 12))
})
test('reconciliation removes deleted/aged-out records and invalidates edited details', () => {
  let initial = cacheOf([shot('a'), shot('b')])
  initial = attachDetail(initial, 'a', initial.records[0].signature, detail('a'))
  const fresh = reconcileHistory(page([shot('a')]), initial, 'source-a', 'Asia/Singapore', now)
  assert.equal(fresh.records.length, 1); assert.equal(fresh.records[0].duration, 29)
  assert.equal(fresh.details.a.totalYield, '36')
  const edited = reconcileHistory(page([shot('a', { annotations: { actualYield: 42 } })]), fresh, 'source-a', 'Asia/Singapore', now)
  assert.equal(edited.records[0].yield, 42); assert.equal(edited.details.a, undefined)
  const switched = reconcileHistory(page([shot('a')]), fresh, 'source-b', 'Asia/Singapore', now)
  assert.equal(switched.details.a, undefined)
  assert.equal(attachDetail(edited, 'deleted-id', 'old', detail('deleted-id')), edited)
})
test('summaries, weekday/hour drilldown and yield coverage use the identical population', () => {
  const rows = cacheOf(Array.from({ length: 6 }, (_, i) => shot(String(i), { annotations: i === 0 ? null : { actualYield: i * 10 } }))).records
  const summary = summarize(rows)
  assert.equal(summary.count, 6); assert.equal(summary.yieldCoverage, 5); assert.equal(summary.typicalYield, 30)
  assert.equal(summary.weekdays.reduce((a, b) => a + b), 6)
  const byHour = timeWindowCounts(rows)
  for (let i = 0; i < 12; i++) assert.equal(rows.filter(r => matches(r, { kind: 'hours', value: String(i) })).length, byHour[i])
  assert.equal(summarize(rows.slice(0, 4)).typicalYield, null)
  assert.equal(rows.filter(r => inWindow(r, reportingWindow(7, 'Asia/Singapore', now))).length, 6)
})
test('repository persists summaries and previously opened curves through an offline restart', async () => {
  let persisted: HistoryCache | null = null
  let disconnected = false
  const deps = { storage: { read: async () => persisted, write: async (value: HistoryCache) => { persisted = structuredClone(value) } }, page: async () => { if (disconnected) throw Error('offline'); return page([shot()]) }, detail: async () => ({ ...shot(), measurements: [] }), toDetail: () => detail('a'), now: () => now }
  const repo = new HistoryRepository('source-a', 'UTC', deps)
  await repo.refresh(); await repo.detail('a')
  disconnected = true
  const restarted = new HistoryRepository('source-a', 'UTC', deps)
  await restarted.refresh()
  assert.equal(restarted.state.status, 'offline'); assert.equal(restarted.state.cache?.records.length, 1)
  assert.equal((await restarted.detail('a')).points!.length, 2)
  assert.equal(restarted.state.cache?.syncedAt, now.toISOString())
})
test('sync and detail requests deduplicate; storage failure preserves usable session data', async () => {
  let calls = 0
  const repo = new HistoryRepository('source-a', 'UTC', { storage: { read: async () => null, write: async () => { throw Error('quota') } }, page: async () => { calls++; return page([shot()]) }, detail: async () => { calls++; return { ...shot(), measurements: [] } }, toDetail: () => detail('a') })
  await Promise.all([repo.refresh(), repo.refresh()]); assert.equal(calls, 1)
  await Promise.all([repo.detail('a'), repo.detail('a')]); assert.equal(calls, 2)
  assert.equal(repo.state.storageWarning, true); assert.equal(repo.state.cache?.records.length, 1)
})
test('read-only transport uses bounded endpoint and propagates server errors', async () => {
  const request = (async (url: string | URL | Request, init?: RequestInit) => { assert.equal(String(url), 'http://example.test/api/v1/shots?limit=100'); assert.equal(init?.method, undefined); assert.equal(init?.cache, 'no-store'); return new Response(JSON.stringify(page([shot()])), { status: 200 }) }) as typeof fetch
  assert.equal((await historyGet<PaginatedShots>('http://example.test/api/v1', '/shots?limit=100', request)).total, 1)
  await assert.rejects(historyGet('http://example.test/api/v1', '/shots/a', (async () => new Response('', { status: 404 })) as typeof fetch), /no longer available/)
})
test('production routes preserve scope and selected shot without importing preview records', () => {
  const route = readInsightsRoute(new URLSearchParams('page=insights&insSection=history&insDays=0&insDrink=pourover&insSearch=tea&shotId=a'))
  assert.deepEqual(readInsightsRoute(writeInsightsRoute(new URL('http://localhost/'), route).searchParams), route)
  assert.equal(readInsightsRoute(new URLSearchParams('insKind=hours&insValue=42')).filter, null)
  assert.equal(readInsightsRoute(new URLSearchParams('insDrink=all')).beverage, 'espresso')
  for (const file of ['InsightsScreen.tsx', 'InsightsHome.tsx', 'useShotInsights.ts', 'historyRepository.ts']) assert.doesNotMatch(readFileSync(new URL(`../src/features/insights/${file}`, import.meta.url), 'utf8'), /brewingFixture|demoLiveBrewFixture|review\/brewing-insights/)
})

test('persistent cache rejects the wrong gateway, schema, duplicate identity and corrupt metrics', () => {
  const valid = cacheOf([shot()])
  assert.equal(validHistoryCache(valid, 'source-a'), true)
  assert.equal(validHistoryCache(valid, 'source-b'), false)
  assert.equal(validHistoryCache({ ...valid, version: 2 }, 'source-a'), false)
  assert.equal(validHistoryCache({ ...valid, timezone: 'not-a-timezone' }, 'source-a'), false)
  assert.equal(validHistoryCache({ ...valid, records: [valid.records[0], valid.records[0]], total: 2 }, 'source-a'), false)
  assert.equal(validHistoryCache({ ...valid, records: [{ ...valid.records[0], yield: NaN }] }, 'source-a'), false)
  assert.equal(validHistoryCache({ ...valid, details: { missing: detail('missing') } }, 'source-a'), false)
})

test('a detail arriving after deletion cannot restore a removed shot to the cache', async () => {
  let items = [shot()]
  let finish: (value: ShotRecord) => void = () => {}
  const repo = new HistoryRepository('source-a', 'UTC', {
    storage: { read: async () => null, write: async () => {} }, page: async () => page(items),
    detail: () => new Promise(resolve => { finish = resolve }), toDetail: () => detail('a'),
  })
  await repo.refresh()
  const pending = repo.detail('a')
  await Promise.resolve()
  items = []
  await repo.refresh()
  finish({ ...shot(), measurements: [] })
  await pending
  assert.equal(repo.state.cache?.records.length, 0)
  assert.deepEqual(Object.keys(repo.state.cache!.details), [])
})

test('a mismatched detail response is rejected instead of displaying another shot', async () => {
  const repo = new HistoryRepository('source-a', 'UTC', {
    storage: { read: async () => null, write: async () => {} }, page: async () => page([shot()]),
    detail: async () => ({ ...shot('wrong'), measurements: [] }), toDetail: () => detail('wrong'),
  })
  await repo.refresh()
  await assert.rejects(repo.detail('a'), /measurements/)
  assert.deepEqual(Object.keys(repo.state.cache!.details), [])
})
