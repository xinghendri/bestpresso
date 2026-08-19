export type MachineReadiness = 'ready' | 'heating' | 'sleeping' | 'disconnected'
export interface BrewProfile { id: string; name: string; eyebrow: string; description: string; temperature: number; grindSetting: string; dose: number; targetYield: number }
export interface MachineUtility { id: 'water' | 'steam' | 'scale' | 'tank'; label: string; value: string; detail: string; tone?: 'accent' | 'warning' }
export interface ShotPoint { pressure: number; flow: number }
export interface PreviousShot { profileName: string; pulledAt: string; dose: number; yield: number; duration: number; points: ShotPoint[] }
export interface BrewingScreenModel { machineName: string; readiness: MachineReadiness; profile: BrewProfile; utilities: MachineUtility[]; previousShot: PreviousShot }
