import assert from 'node:assert/strict'
import test from 'node:test'
import { supportedScaleForDevice } from '../src/domain/scales.ts'

const match = (name?: string, identifier?: string) => supportedScaleForDevice(name, identifier)

test('uses Decaid canonical names for the original and Half Decent scales', () => {
  assert.equal(match('Decent Scale', 'AA:BB:CC:DD:EE:FF')?.id, 'decent-scale')
  assert.equal(match('Half Decent Scale (USB)', 'serial-cu.usbmodem01')?.id, 'half-decent-scale-usb')
  assert.equal(match('Half Decent Scale (WiFi)', 'wifi:hds.local')?.id, 'half-decent-scale-wifi')
})

test('uses transport identifiers only to disambiguate legacy Decent names', () => {
  assert.equal(match('Decent', 'serial-cu.usbmodem01')?.id, 'half-decent-scale-usb')
  assert.equal(match('Decent', '/dev/cu.usbmodem01')?.id, 'half-decent-scale-usb')
  assert.equal(match('Decent', 'wifi:hds.local')?.id, 'half-decent-scale-wifi')
  assert.equal(match('Decent', 'AA:BB:CC:DD:EE:FF')?.id, 'decent-scale')
})

test('does not let a transport-shaped identifier override a canonical model name', () => {
  assert.equal(match('Acaia Lunar', 'wifi:unexpected')?.id, 'acaia-scale')
  assert.equal(match('Bookoo Mini Scale', 'serial-unexpected')?.id, 'bookoo-scale')
})

test('maps every supplied image to the matching Decaid scale name', () => {
  assert.equal(match('Decent Scale', 'AA:BB')?.imageName, 'half-decent-scale-wifi.png')
  assert.equal(match('Half Decent Scale (USB)', 'serial-1')?.imageName, 'half-decent-scale-usb.png')
  assert.equal(match('Half Decent Scale (WiFi)', 'wifi:hds.local')?.imageName, 'half-decent-scale-usb.png')
  assert.equal(match('Skale2', 'ble-1')?.imageName, 'skale2.png')
  assert.equal(match('LUNAR', 'ble-2')?.imageName, 'acaia-scale.png')
  assert.equal(match('Felicita Arc', 'ble-3')?.imageName, 'felicita-arc.png')
  assert.equal(match('Bookoo Mini Scale', 'ble-4')?.imageName, 'bookoo-scale.png')
  assert.equal(match('Eureka Precisa', 'ble-5')?.imageName, 'eureka-precisa.png')
  assert.equal(match('Difluid Microbalance', 'ble-6')?.imageName, 'difluid-microbalance.png')
})

test('presents ambiguous Acaia and Bookoo models as brand families', () => {
  assert.equal(match('Bookoo Ultra', 'ble-1')?.id, 'bookoo-scale')
  assert.equal(match('Bookoo Themis Mini', 'ble-2')?.id, 'bookoo-scale')
  assert.equal(match('Themis Mini', 'ble-3')?.displayName, 'Bookoo')
  assert.equal(match('Acaia Pearl S', 'ble-4')?.id, 'acaia-scale')
  assert.equal(match('PYXIS', 'ble-5')?.displayName, 'Acaia')
  assert.equal(match('PROCH', 'ble-6')?.imageName, 'acaia-scale.png')
  assert.equal(match('Solo Barista', 'ble-7')?.id, 'solo-barista')
})

test('keeps supported scales without supplied art image-free', () => {
  assert.equal(match('Varia AKU', 'ble-1')?.imageName, undefined)
  assert.equal(match('BlackCoffee Scale', 'ble-2')?.imageName, undefined)
  assert.equal(match('Unknown Scale', 'ble-3'), undefined)
})
