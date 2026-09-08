import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { deduplicateImportedProfileTitle, isVisualizerShareCode, normalizeVisualizerShareCode, parseProfileImport, visualizerCredentialsConfigured, visualizerImportedProfileId } from '../src/features/profiles/profileImports.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/api/decaid/client.ts', import.meta.url), 'utf8')

test('JSON import accepts a raw profile and a Decaid record wrapper', () => {
  const raw = parseProfileImport(JSON.stringify({ title: 'Raw', steps: [{ name: 'Pour' }] }))
  assert.equal(raw.profile.title, 'Raw')
  assert.equal(raw.metadata, null)

  const wrapped = parseProfileImport(JSON.stringify({ profile: { title: 'Wrapped', steps: [{ name: 'Fill' }] }, metadata: { description: 'Hello' } }))
  assert.equal(wrapped.profile.title, 'Wrapped')
  assert.deepEqual(wrapped.metadata, { description: 'Hello' })
})

test('JSON import rejects invalid and incomplete profile files', () => {
  assert.throws(() => parseProfileImport('{'), /valid JSON/)
  assert.throws(() => parseProfileImport(JSON.stringify({ steps: [{}] })), /needs a name/)
  assert.throws(() => parseProfileImport(JSON.stringify({ title: 'No stages', steps: [] })), /does not contain any brewing stages/)
})

test('Visualizer share codes are numeric and exactly four digits', () => {
  assert.equal(normalizeVisualizerShareCode(' 12a34-5 '), '1234')
  assert.equal(isVisualizerShareCode('1234'), true)
  assert.equal(isVisualizerShareCode('123'), false)
  assert.equal(isVisualizerShareCode('12a4'), false)
})

test('Visualizer credentials require both a username and a redacted stored password', () => {
  assert.equal(visualizerCredentialsConfigured({ Username: 'hendri', Password: { isSet: true } }), true)
  assert.equal(visualizerCredentialsConfigured({ Username: '', Password: { isSet: true } }), false)
  assert.equal(visualizerCredentialsConfigured({ Username: 'hendri', Password: { isSet: false } }), false)
})

test('Visualizer imports preserve unique names and suffix collisions', () => {
  assert.equal(deduplicateImportedProfileTitle({ title: 'D-Flow / New' }, ['Classic']), 'D-Flow / New')
  assert.equal(deduplicateImportedProfileTitle({ title: 'D-Flow / New' }, ['D-Flow / New', 'D-Flow / New (01)']), 'D-Flow / New (02)')
  assert.equal(visualizerImportedProfileId({ profileId: 'direct', workflowResult: { id: 'nested' } }), 'direct')
  assert.equal(visualizerImportedProfileId({ workflowResult: { id: 'nested' } }), 'nested')
})

test('Visualizer import follows Decaid plugin transport and checks loaded credentials', () => {
  assert.match(client, /getPluginSettings = \(pluginId: string\).*\/plugins\/\$\{encodeURIComponent\(pluginId\)\}\/settings/)
  assert.match(client, /method: 'POST'/)
  assert.match(app, /getPlugins\(\), getPluginSettings\('visualizer\.reaplugin'\)/)
  assert.match(app, /callPluginEndpoint<VisualizerImportResult>\('visualizer\.reaplugin', 'import', \{ shareCode \}\)/)
  assert.match(app, /deduplicateImportedProfileTitle/)
})
