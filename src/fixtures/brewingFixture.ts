import type { BrewingScreenModel } from '../domain/brewing'
export const brewingFixture: BrewingScreenModel = {
  machineName: 'DE1PRO', readiness: 'ready',
  profile: { id: 'adaptive-v2', name: 'Adaptive V2', eyebrow: 'FAVOURITE 01', description: 'A bright, balanced extraction with a gentle decline.', temperature: 92, grindSetting: '14.5', dose: 21, targetYield: 34 },
  utilities: [{ id: 'water', label: 'Hot water', value: '92°', detail: 'Ready' }, { id: 'steam', label: 'Steam', value: '160°', detail: '3 bar' }, { id: 'scale', label: 'Scale', value: '0.0 g', detail: 'Connected', tone: 'accent' }, { id: 'tank', label: 'Water tank', value: '72%', detail: '1.4 L remaining' }],
  previousShot: { profileName: 'Adaptive V2', pulledAt: 'Today, 08:42', dose: 21, yield: 33.8, duration: 34, points: [{ pressure: 0, flow: 0 }, { pressure: 2, flow: 2.2 }, { pressure: 6, flow: 3.2 }, { pressure: 8.5, flow: 2.5 }, { pressure: 8, flow: 2.1 }, { pressure: 7, flow: 2.4 }, { pressure: 5.8, flow: 2.2 }, { pressure: 3.5, flow: 1.4 }, { pressure: 0, flow: 0 }] },
}
