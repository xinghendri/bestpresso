import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { en } from '../src/i18n/en/index.ts'
import { catalog } from '../src/i18n/es/index.ts'
import { languageRegistry, matchLanguage } from '../src/i18n/registry.ts'
import { activeLocaleTag, dateFormatter, decimalSeparator, formatDecimal, formatNumber, localeFor, parseLocalizedNumber, plural, resolveLanguage, setActiveLanguage, t } from '../src/i18n/index.ts'
import { displayedShotName, displayedStageName } from '../src/i18n/dataLabels.ts'
import { insightHour, insightPeriods } from '../src/features/insights/insightClock.ts'
import { validateCatalog } from '../src/i18n/validation.ts'

test('Spanish covers all copy with traceable sources and only omits native date templates', () => {
  const provenance = JSON.parse(readFileSync(new URL('../docs/localisation-spanish-provenance.json', import.meta.url), 'utf8'))
  assert.deepEqual(validateCatalog(en, catalog, 'es-ES'), [])
  assert.deepEqual(Object.keys(en).filter(key => !(key in catalog)), ['insights.period.dayMonth', 'insights.period.dayOnly'])
  assert.equal(Object.keys(catalog).length, Object.keys(en).length - 2)
  let seeded = 0
  for (const [key, value] of Object.entries(catalog)) {
    const entry = provenance.entries[key]
    assert.deepEqual(entry.english, en[key as keyof typeof en])
    assert.deepEqual(entry.translation, value)
    if (entry.kind === 'streamline') {
      seeded++
      assert.ok(entry.row > 1)
      assert.ok(entry.sourceSpanish.trim())
      const expected = entry.adjustment === 'none' ? entry.sourceSpanish : entry.sourceSpanish[0].toUpperCase() + entry.sourceSpanish.slice(1).toLowerCase()
      assert.equal(value, expected)
    } else assert.equal(entry.kind, 'contextual')
  }
  assert.equal(seeded, 116)
})

test('Spanish resolves device regions and retains region without Intl.Locale', () => {
  assert.equal(languageRegistry.es.name, 'Español')
  for (const tag of ['es', 'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-US', 'es-419']) {
    assert.equal(resolveLanguage('auto', [tag]), 'es')
    assert.equal(localeFor('es', [tag]), tag === 'es' ? 'es-ES' : tag)
  }
  assert.equal(localeFor('es', ['en-US']), 'es-ES')
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale')!
  try {
    Object.defineProperty(Intl, 'Locale', { configurable: true, value: undefined })
    for (const tag of ['es-ES', 'es-MX', 'es-419']) assert.equal(matchLanguage(tag, languageRegistry), 'es')
  } finally { Object.defineProperty(Intl, 'Locale', descriptor) }
})

test('Spanish regional decimals, grouping, plural forms and input preserve stored numbers', async () => {
  for (const region of ['es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-US', 'es-419']) {
    await setActiveLanguage('es', [region])
    assert.equal(activeLocaleTag(), region)
    assert.equal(formatNumber(12345.6), new Intl.NumberFormat(region).format(12345.6))
    assert.equal(formatDecimal(18.5, 1), new Intl.NumberFormat(region, { useGrouping: false, minimumFractionDigits: 1 }).format(18.5))
    assert.equal(decimalSeparator(), new Intl.NumberFormat(region).formatToParts(1.5).find(p => p.type === 'decimal')?.value)
    assert.equal(parseLocalizedNumber(formatDecimal(18.5, 1)), 18.5)
    assert.equal(JSON.stringify({ dose: parseLocalizedNumber(formatDecimal(18.5, 1)) }), '{"dose":18.5}')
    for (const count of [0, 1, 2, 1000000]) {
      assert.equal(plural('insights.common.brewsPct', count, { pct: 50 }), formatNumber(count) + (count === 1 ? ' preparación · 50%' : ' preparaciones · 50%'))
    }
  }
  await setActiveLanguage('en', ['en-US'])
})

test('Spanish native dates, cross-year ranges and independent clocks work with older WebViews', async () => {
  for (const region of ['es-ES', 'es-MX', 'es-AR', 'es-419']) {
    await setActiveLanguage('es', [region])
    const date = new Date('2026-09-19T12:00Z')
    assert.equal(dateFormatter({ dateStyle: 'short', timeZone: 'UTC' }).format(date), new Intl.DateTimeFormat(region, { dateStyle: 'short', timeZone: 'UTC' }).format(date))
    const a = { start: '2026-09-12', end: '2026-09-19' }, b = { start: '2026-09-05', end: '2026-09-12' }
    const formatter = new Intl.DateTimeFormat(region, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    assert.equal(insightPeriods(a, b)[0], formatter.formatRange(new Date('2026-09-12T12:00Z'), new Date('2026-09-18T12:00Z')))
    const crossYear = insightPeriods({ start: '2025-12-29', end: '2026-01-05' }, { start: '2025-12-22', end: '2025-12-29' })[0]
    assert.match(crossYear, /2025/)
    assert.match(crossYear, /2026/)
    const descriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'formatRange')!
    try {
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', { configurable: true, value: undefined })
      assert.equal(insightPeriods(a, b)[0], formatter.format(new Date('2026-09-12T12:00Z')) + '–' + formatter.format(new Date('2026-09-18T12:00Z')))
    } finally { Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', descriptor) }
    for (const hour of [0, 6, 12, 15, 18, 21]) {
      const expected = new Intl.DateTimeFormat(region, { hour: 'numeric', hourCycle: 'h12', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1, hour))).toLowerCase().replace(/[\u00a0\u202f]/g, ' ')
      assert.equal(insightHour(hour, '12h'), expected)
      assert.equal(insightHour(hour, '24h'), String(hour))
      assert.equal(insightHour(hour, 'device', false, 'en-US'), expected)
      assert.equal(insightHour(hour, 'device', false, 'en-GB'), String(hour))
    }
  }
  await setActiveLanguage('en', ['en-US'])
})

test('Spanish preserves espresso meaning, compact navigation and authored profile names', async () => {
  await setActiveLanguage('es', [])
  assert.equal(t('brew.metric.yield'), 'Peso en taza')
  assert.equal(t('insights.common.yield'), t('brew.metric.yield'))
  assert.equal(t('library.metric.dose'), t('brew.metric.dose'))
  assert.equal(t('brew.metric.flowRate'), t('common.metric.flow'))
  assert.equal(t('shell.cleaning.title'), 'Limpieza')
  assert.equal(t('shell.machine.off'), 'Apag.')
  assert.equal(t('shell.status.disconnected'), 'Sin conexión')
  for (const section of ['prepare', 'clean', 'alerts', 'devices', 'power', 'experience', 'data', 'extensions', 'advanced']) {
    const entries = catalog as Record<string, unknown>
    assert.equal(entries['settings.section.' + section + '.label'], entries['settings.section.' + section + '.title'])
  }
  assert.equal(displayedShotName({ profileName: 'Pressure 18.5 / café de Ana' }), 'Pressure 18.5 / café de Ana')
  assert.equal(displayedStageName({ time: 0, stageName: 'Bloom 2' }), 'Bloom 2')
  assert.equal(t('brew.stage.reason.sensorExitReached', { type: t('brew.metric.pressure'), symbol: '>', value: '7', unit: 'bar' }), 'Se alcanzó: Presión >7 bar')
  assert.match(t('brew.data.error.stopUnconfirmed'), /no ha confirmado/)
  assert.match(t('settings.prepare.calibration.description'), /mayor adelanta la parada/)
  await setActiveLanguage('en', ['en-US'])
})
