export interface SupportedScaleDefinition {
  id: string
  displayName: string
  imageName?: string
  aliases: readonly RegExp[]
}

export const supportedScales = [
  { id: 'bengle-scale', displayName: 'Bengle', aliases: [/^bengle(?:\s+(?:internal\s+)?scale)?$/i] },
  { id: 'half-decent-scale-usb', displayName: 'Half Decent', imageName: 'half-decent-scale-usb.png', aliases: [/^half\s+decent(?:\s+scale)?(?:\s*\(usb\))?$/i, /^hds\s*serial$/i] },
  { id: 'half-decent-scale-wifi', displayName: 'Half Decent', imageName: 'half-decent-scale-usb.png', aliases: [/^half\s+decent(?:\s+scale)?\s*\(wi-?fi\)$/i, /^hds\s*wi-?fi$/i] },
  { id: 'decent-scale', displayName: 'Decent', imageName: 'half-decent-scale-wifi.png', aliases: [/^decent(?:\s+scale)?$/i] },
  { id: 'skale2', displayName: 'Atomax Skale', imageName: 'skale2.png', aliases: [/^skale(?:2|\s*ii)?$/i, /atomax.*skale/i] },
  { id: 'acaia-lunar', displayName: 'Acaia Lunar', imageName: 'acaia-lunar.png', aliases: [/\blunar\b/i] },
  { id: 'acaia-pearl', displayName: 'Acaia Pearl', aliases: [/\bpearl(?:-?s)?\b/i] },
  { id: 'acaia-pyxis', displayName: 'Acaia Pyxis', aliases: [/\bpyxis\b/i] },
  { id: 'acaia-proch', displayName: 'Acaia PROCH', aliases: [/\bproch\b/i] },
  { id: 'acaia-scale', displayName: 'Acaia', aliases: [/acaia/i] },
  { id: 'felicita-arc', displayName: 'Felicita Arc', imageName: 'felicita-arc.png', aliases: [/^felicita/i] },
  { id: 'blackcoffee-scale', displayName: 'BlackCoffee', aliases: [/^black(?:coffee|\s+mirror)/i] },
  { id: 'bookoo-ultra', displayName: 'Bookoo Ultra', imageName: 'bookoo-ultra.png', aliases: [/bookoo.*ultra/i] },
  { id: 'bookoo-mini-scale', displayName: 'Bookoo Mini', imageName: 'bookoo-mini.png', aliases: [/bookoo.*(?:mini|themis)/i, /themis[\s_-]*mini/i, /^bookoo(?:\s+mini)?(?:\s+scale)?$/i] },
  { id: 'solo-barista', displayName: 'Solo Barista', aliases: [/solo\s+barista/i, /lsj-001/i] },
  { id: 'eureka-precisa', displayName: 'Eureka Precisa', imageName: 'eureka-precisa.png', aliases: [/eureka/i, /precisa/i, /cfs-9002/i] },
  { id: 'smartchef-scale', displayName: 'SmartChef', aliases: [/smartchef/i] },
  { id: 'varia-aku', displayName: 'Varia AKU', aliases: [/varia/i, /\baku\b/i] },
  { id: 'difluid-microbalance', displayName: 'Difluid Microbalance', imageName: 'difluid-microbalance.png', aliases: [/difluid(?!.*\br2\b)/i] },
  { id: 'hiroia-jimmy', displayName: 'Hiroia Jimmy', aliases: [/hiroia/i, /jimmy/i] },
  { id: 'atomheart-eclair', displayName: 'Atomheart Eclair', aliases: [/atomheart/i, /eclair/i] },
  { id: 'weighmaster-scale', displayName: 'WeighMaster', aliases: [/weigh\s*master/i] },
] as const satisfies readonly SupportedScaleDefinition[]

export type SupportedScale = (typeof supportedScales)[number]
export type SupportedScaleId = SupportedScale['id']

const scaleById = new Map<SupportedScaleId, SupportedScale>(supportedScales.map((scale) => [scale.id, scale]))

const normalized = (value: string | undefined) => value?.trim().replace(/\s+/g, ' ').toLowerCase()

const halfDecentTransportForIdentifier = (identifier: string | undefined) => {
  const candidate = identifier?.trim()
  if (!candidate) return undefined
  if (/^wifi:/i.test(candidate)) return scaleById.get('half-decent-scale-wifi')
  if (/^(?:serial|usb)-/i.test(candidate) || /^\/dev\//i.test(candidate)) return scaleById.get('half-decent-scale-usb')
  return undefined
}

export function supportedScaleForName(name: string | undefined) {
  const candidate = name?.trim()
  if (!candidate) return undefined
  return supportedScales.find((scale) => scale.aliases.some((alias) => alias.test(candidate)))
}

export function supportedScaleForDevice(name: string | undefined, identifier: string | undefined) {
  const nameMatch = supportedScaleForName(name)
  const normalizedName = normalized(name)

  if (nameMatch) {
    if (nameMatch.id === 'decent-scale' && normalizedName === 'decent') {
      return halfDecentTransportForIdentifier(identifier) ?? nameMatch
    }
    return nameMatch
  }

  if (!normalizedName || normalizedName === 'scale') {
    return halfDecentTransportForIdentifier(identifier)
  }

  return undefined
}
