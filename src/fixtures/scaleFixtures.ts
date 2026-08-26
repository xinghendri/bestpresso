import type { ScaleConnection } from '../domain/brewing'

const scaleFixtures = {
  decent: { status: 'connected', id: 'AA:BB:CC:DD:EE:FF', name: 'Decent Scale' },
  'half-decent-usb': { status: 'connected', id: 'serial-cu.usbmodem-HDS', name: 'Half Decent Scale (USB)' },
  'half-decent-wifi': { status: 'connected', id: 'wifi:hds.local', name: 'Half Decent Scale (WiFi)' },
} as const satisfies Record<string, ScaleConnection>

export type ScaleFixtureKey = keyof typeof scaleFixtures

export function scaleFixtureForKey(key: string | null | undefined): ScaleConnection | undefined {
  return key && key in scaleFixtures ? scaleFixtures[key as ScaleFixtureKey] : undefined
}
