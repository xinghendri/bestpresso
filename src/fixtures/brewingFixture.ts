import type { BrewingScreenModel } from '../domain/brewing'

export const brewingFixture: BrewingScreenModel = {
  readiness: 'ready',
  activeProfileId: 'adaptive-v2',
  utilities: [
    { id: 'water', label: 'Hot water', metrics: [{ label: 'Volume', value: '50', unit: 'ml' }, { label: 'Temperature', value: '92', unit: '°' }] },
    { id: 'steam', label: 'Steam', enabled: true, metrics: [{ label: 'Current', value: '121', unit: '°', highlight: true }, { label: 'Target', value: '160', unit: '°' }, { label: 'Duration', value: '50', unit: 's' }, { label: 'Flow', value: '0.6', unit: 'ml/s' }] },
    { id: 'scale', label: 'Scale', metrics: [{ label: 'Weight', value: '0.0', unit: 'g' }] },
    { id: 'tank', label: 'Reservoir', metrics: [{ label: 'Current', value: '1,234', unit: 'ml' }] },
  ],
  profiles: [
    { id: 'trendy-six-bar', name: 'D-Flow / Trendy 6 bar low pressure shot', description: 'A gentle low-pressure profile with a long, declining finish for sweet and expressive espresso.', temperature: '91', grindSetting: '13.2', dose: '20', targetYield: '42', targetPoints: [{ elapsedMs: 0, pressure: 0, flow: 0 }, { elapsedMs: 5000, pressure: 2, flow: 4 }, { elapsedMs: 9000, pressure: 6, flow: 2.8 }, { elapsedMs: 36000, pressure: 5, flow: 2.2 }] },
    { id: 'adaptive-v2', name: 'A-Flow / Adaptive V2', description: 'Adapts the extraction to puck resistance while balancing pressure and flow through the shot.', temperature: '92', grindSetting: '14.5', dose: '21', targetYield: '34', targetPoints: [{ elapsedMs: 0, pressure: 0, flow: 0 }, { elapsedMs: 4000, pressure: 1, flow: 4 }, { elapsedMs: 8000, pressure: 8.5, flow: 1.2 }, { elapsedMs: 16000, pressure: 7.5, flow: 2.8 }, { elapsedMs: 36000, pressure: 5.5, flow: 2.1 }] },
    { id: 'best-practice-light', name: 'Best practice (light roast)', description: 'A high-temperature recipe for extracting clarity and sweetness from lighter roasted coffee.', temperature: '94', grindSetting: '12.8', dose: '18', targetYield: '45', targetPoints: [{ elapsedMs: 0, pressure: 0, flow: 0 }, { elapsedMs: 7000, pressure: 2, flow: 3.5 }, { elapsedMs: 12000, pressure: 9, flow: 2 }, { elapsedMs: 40000, pressure: 6, flow: 2.5 }] },
    { id: 'turbo-bloom', name: 'Gagné / Turbo bloom', description: 'A fast, high-flow bloom followed by a short extraction for bright and juicy espresso.', temperature: '93', grindSetting: '11.8', dose: '18', targetYield: '48', targetPoints: [{ elapsedMs: 0, pressure: 0, flow: 0 }, { elapsedMs: 3000, pressure: 3, flow: 6 }, { elapsedMs: 10000, pressure: 1, flow: 0 }, { elapsedMs: 15000, pressure: 6, flow: 4 }, { elapsedMs: 30000, pressure: 4, flow: 3.5 }] },
    { id: 'gentle-sweet', name: 'Gentle and sweet', description: 'A forgiving extraction with a soft ramp and declining pressure for a round, sweet cup.', temperature: '90', grindSetting: '15.1', dose: '20', targetYield: '40', targetPoints: [{ elapsedMs: 0, pressure: 0, flow: 0 }, { elapsedMs: 8000, pressure: 3, flow: 2.5 }, { elapsedMs: 16000, pressure: 7, flow: 2.3 }, { elapsedMs: 42000, pressure: 4, flow: 1.8 }] },
    { id: 'classic-nine-bar', name: 'Classic 9 bar', description: 'A familiar flat nine-bar extraction for traditional espresso recipes.', temperature: '93', grindSetting: '13.8', dose: '18', targetYield: '36', targetPoints: [{ elapsedMs: 0, pressure: 0, flow: 0 }, { elapsedMs: 4000, pressure: 3, flow: 3 }, { elapsedMs: 8000, pressure: 9, flow: 2.4 }, { elapsedMs: 32000, pressure: 9, flow: 2.1 }] },
    { id: 'clean-forward-flush', name: 'Cleaning / 5x forward flush', beverageType: 'cleaning', description: 'Five forward flushes for routine group-head cleaning.', temperature: '92', grindSetting: '—', dose: '—', targetYield: '—', stepNames: ['Flush 1', 'Pause 1', 'Flush 2', 'Pause 2', 'Flush 3', 'Pause 3', 'Flush 4', 'Pause 4', 'Flush 5'] },
    { id: 'clean-backflush', name: 'Cleaning / Backflush', beverageType: 'cleaning', description: 'A backflush cycle for use with a blind basket.', temperature: '92', grindSetting: '—', dose: '—', targetYield: '—', stepNames: ['Fill', 'Soak', 'Release'] },
  ],
  previousShot: {
    profileName: 'Adaptive V2',
    timestamp: new Date().toISOString(),
    totalYield: '33.6',
    totalTime: '38',
    targetYield: 34,
    points: [
      { elapsedMs: 0, pressure: 0, flow: 0, temperature: 88, weight: 0 },
      { elapsedMs: 4000, pressure: 2, flow: 0.3, temperature: 90, weight: 0.2 },
      { elapsedMs: 8000, pressure: 8.5, flow: 1.2, temperature: 92, weight: 1.5 },
      { elapsedMs: 12000, pressure: 7.8, flow: 3.4, temperature: 92.5, weight: 5.4 },
      { elapsedMs: 18000, pressure: 6.8, flow: 2.9, temperature: 92.2, weight: 12.8 },
      { elapsedMs: 24000, pressure: 6.2, flow: 2.6, temperature: 92.1, weight: 20.1 },
      { elapsedMs: 30000, pressure: 5.7, flow: 2.4, temperature: 92, weight: 27.4 },
      { elapsedMs: 38000, pressure: 5.2, flow: 2.1, temperature: 91.9, weight: 33.6 },
    ],
  },
}
