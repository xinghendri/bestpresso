import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_ADVANCED_MACHINE_SETTINGS,
  DEFAULT_REA_SETTINGS,
  DEFAULT_WORKFLOW_SETTINGS,
  SETTINGS_PROTOCOL,
  normalizeAdvancedMachineSettings,
  normalizeReaSettings,
  normalizeWorkflowSettings,
} from '../src/features/settings/settingsProtocol.ts'

test('Decaid defaults fill omitted optional settings without replacing server values', () => {
  assert.deepEqual(normalizeReaSettings({ gatewayMode: 'tracking', weightFlowMultiplier: 1.4 }), {
    ...DEFAULT_REA_SETTINGS,
    gatewayMode: 'tracking',
    weightFlowMultiplier: 1.4,
  })
  assert.deepEqual(normalizeAdvancedMachineSettings({ heaterPh2Timeout: 9 }), {
    ...DEFAULT_ADVANCED_MACHINE_SETTINGS,
    heaterPh2Timeout: 9,
  })
})

test('partial workflow responses receive the same safe fallbacks Streamline presents', () => {
  const workflow = normalizeWorkflowSettings({
    steamSettings: { targetTemperature: 155 },
    hotWaterData: { volume: 120 },
  })
  assert.deepEqual(workflow.steamSettings, {
    ...DEFAULT_WORKFLOW_SETTINGS.steamSettings,
    targetTemperature: 155,
  })
  assert.deepEqual(workflow.hotWaterData, {
    ...DEFAULT_WORKFLOW_SETTINGS.hotWaterData,
    volume: 120,
  })
  assert.deepEqual(workflow.rinseData, DEFAULT_WORKFLOW_SETTINGS.rinseData)
})

test('settings ranges match the Decaid/Streamline protocol', () => {
  assert.equal(SETTINGS_PROTOCOL.steam.enabledTemperatureMin, 135)
  assert.equal(SETTINGS_PROTOCOL.steam.temperatureMax, 170)
  assert.deepEqual(SETTINGS_PROTOCOL.steam.duration, { min: 10, max: 120, step: 5 })
  assert.deepEqual(SETTINGS_PROTOCOL.steam.flow, { min: 0.4, max: 2.5, step: 0.1 })
  assert.deepEqual(SETTINGS_PROTOCOL.hotWater.volume, { min: 10, max: 500, step: 10 })
  assert.deepEqual(SETTINGS_PROTOCOL.hotWater.duration, { min: 5, max: 120, step: 5 })
  assert.deepEqual(SETTINGS_PROTOCOL.rinse.temperature, { min: 5, max: 95, step: 5 })
  assert.deepEqual(SETTINGS_PROTOCOL.rinse.flow, { min: 1, max: 8, step: 1 })
  assert.deepEqual(SETTINGS_PROTOCOL.rinse.duration, { min: 0, step: 1 })
  assert.deepEqual(SETTINGS_PROTOCOL.heater.flow, { min: 0, max: 10, step: 0.1 })
  assert.deepEqual(SETTINGS_PROTOCOL.heater.phase2Timeout, { min: 0, max: 60, step: 1 })
})
