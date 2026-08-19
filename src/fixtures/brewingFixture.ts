import type { BrewingScreenModel } from '../domain/brewing'

export const brewingFixture: BrewingScreenModel = {
  readiness: 'ready',
  utilities: [
    { id: 'water', label: 'Hot water', metrics: [{ label: 'Target yield', value: '50', unit: 'ml' }, { label: 'Temp.', value: '92', unit: '°' }] },
    { id: 'steam', label: 'Steam', metrics: [{ label: 'Current', value: '121', unit: '°', highlight: true }, { label: 'Target', value: '160', unit: '°' }, { label: 'Max time', value: '50', unit: 's' }, { label: 'Flow', value: '0.6', unit: 'ml/s' }] },
    { id: 'scale', label: 'Scale', metrics: [{ label: 'Weight', value: '0.0', unit: 'g' }] },
    { id: 'tank', label: 'Reservoir', metrics: [{ label: 'Current', value: '1,234', unit: 'ml' }] },
  ],
  profiles: [
    { id: 'trendy-six-bar', name: 'Trendy 6 bar low pressure shot', temperature: '91', grindSetting: '13.2', dose: '20', targetYield: '42' },
    { id: 'adaptive-v2', name: 'Adaptive V2', temperature: '92', grindSetting: '14.5', dose: '21', targetYield: '34' },
    { id: 'best-practice-light', name: 'Best practice (light roast)', temperature: '94', grindSetting: '12.8', dose: '18', targetYield: '45' },
    { id: 'turbo-bloom', name: 'Turbo bloom', temperature: '93', grindSetting: '11.8', dose: '18', targetYield: '48' },
    { id: 'gentle-sweet', name: 'Gentle and sweet', temperature: '90', grindSetting: '15.1', dose: '20', targetYield: '40' },
  ],
  previousShot: { profileName: 'Adaptive V2', totalYield: '33.6', totalTime: '38' },
}
