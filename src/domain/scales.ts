export interface SupportedScaleDefinition {
  id: string
  displayName: string
  imageName: string
  aliases: readonly RegExp[]
}

// Mirrors Decaid's scale implementations and advertised-name aliases. The
// devices API exposes only the device name, so matching must remain name-based.
export const supportedScales = [
  { id: 'bengle-scale', displayName: 'Bengle', imageName: 'bengle-scale.png', aliases: [/^bengle.*scale$/i] },
  { id: 'half-decent-scale-usb', displayName: 'Half Decent Scale', imageName: 'half-decent-scale-usb.png', aliases: [/^half\s+decent\s+scale(?:\s*\(usb\))?$/i, /^hds\s*serial$/i] },
  { id: 'half-decent-scale-wifi', displayName: 'Half Decent Scale', imageName: 'half-decent-scale-wifi.png', aliases: [/^half\s+decent\s+scale\s*\(wi-?fi\)$/i] },
  { id: 'skale2', displayName: 'Atomax Skale', imageName: 'skale2.png', aliases: [/^skale/i, /atomax.*skale/i] },
  { id: 'acaia-lunar', displayName: 'Acaia Lunar', imageName: 'acaia-lunar.png', aliases: [/\blunar\b/i] },
  { id: 'acaia-pearl', displayName: 'Acaia Pearl', imageName: 'acaia-pearl.png', aliases: [/\bpearl\b/i] },
  { id: 'acaia-pyxis', displayName: 'Acaia Pyxis', imageName: 'acaia-pyxis.png', aliases: [/\bpyxis\b/i] },
  { id: 'acaia-proch', displayName: 'Acaia PROCH', imageName: 'acaia-proch.png', aliases: [/\bproch\b/i] },
  { id: 'acaia-scale', displayName: 'Acaia', imageName: 'acaia-scale.png', aliases: [/acaia/i] },
  { id: 'felicita-arc', displayName: 'Felicita Arc', imageName: 'felicita-arc.png', aliases: [/^felicita/i] },
  { id: 'blackcoffee-scale', displayName: 'BlackCoffee', imageName: 'blackcoffee-scale.png', aliases: [/^black/i] },
  { id: 'bookoo-ultra', displayName: 'Bookoo Ultra', imageName: 'bookoo-ultra.png', aliases: [/bookoo.*ultra/i] },
  { id: 'bookoo-mini-scale', displayName: 'Bookoo Mini', imageName: 'bookoo-mini.png', aliases: [/bookoo/i, /themis[\s_-]*mini/i] },
  { id: 'solo-barista', displayName: 'Solo Barista', imageName: 'solo-barista.png', aliases: [/solo\s+barista/i, /lsj-001/i] },
  { id: 'eureka-precisa', displayName: 'Eureka Precisa', imageName: 'eureka-precisa.png', aliases: [/eureka/i, /precisa/i, /cfs-9002/i] },
  { id: 'smartchef-scale', displayName: 'SmartChef', imageName: 'smartchef-scale.png', aliases: [/smartchef/i] },
  { id: 'varia-aku', displayName: 'Varia AKU', imageName: 'varia-aku.png', aliases: [/varia/i, /\baku\b/i] },
  { id: 'difluid-microbalance', displayName: 'Difluid Microbalance', imageName: 'difluid-microbalance.png', aliases: [/difluid/i] },
  { id: 'hiroia-jimmy', displayName: 'Hiroia Jimmy', imageName: 'hiroia-jimmy.png', aliases: [/hiroia/i, /jimmy/i] },
  { id: 'atomheart-eclair', displayName: 'Atomheart Eclair', imageName: 'atomheart-eclair.png', aliases: [/atomheart/i, /eclair/i] },
  { id: 'weighmaster-scale', displayName: 'WeighMaster', imageName: 'weighmaster-scale.png', aliases: [/weigh\s*master/i] },
] as const satisfies readonly SupportedScaleDefinition[]

export type SupportedScale = (typeof supportedScales)[number]
export type SupportedScaleId = SupportedScale['id']

export function supportedScaleForName(name: string | undefined) {
  const candidate = name?.trim()
  if (!candidate) return undefined
  return supportedScales.find((scale) => scale.aliases.some((alias) => alias.test(candidate)))
}
