import type { BrewingScreenModel } from '../domain/brewing'

export const brewingFixture: BrewingScreenModel = {
  readiness: 'ready',
  utilities: [
    { id: 'water', label: 'Hot water', metrics: [{ label: 'Target yield', value: '50', unit: 'ml' }, { label: 'Temp.', value: '92', unit: '°' }] },
    { id: 'steam', label: 'Steam', metrics: [{ label: 'Current', value: '121', unit: '°', highlight: true }, { label: 'Target', value: '160', unit: '°' }, { label: 'Max time', value: '50', unit: 's' }, { label: 'Flow', value: '0.6', unit: 'ml/s' }] },
    { id: 'scale', label: 'Scale', metrics: [{ label: 'Scale', value: '0.0', unit: 'g' }] },
    { id: 'tank', label: 'Water tank', metrics: [{ label: 'Current', value: '1,234', unit: 'ml' }] },
  ],
  profile: { id: 'adaptive-v2', name: 'Adaptive V2', temperature: '92', grindSetting: '14.5', dose: '21', targetYield: '34' },
  previousShot: { profileName: 'Adaptive V2', totalYield: '33.6', totalTime: '38' },
}
