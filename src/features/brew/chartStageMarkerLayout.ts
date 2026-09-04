const CHARACTER_WIDTH_ALLOWANCE = 7.5
const NAME_START_INSET = 31
const NAME_END_PADDING = 10

export const stageMarkerCanShowName = (name: string, availableWidth: number) => {
  const characterCount = Array.from(name.trim()).length
  return availableWidth >= NAME_START_INSET + characterCount * CHARACTER_WIDTH_ALLOWANCE + NAME_END_PADDING
}
