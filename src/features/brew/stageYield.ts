/** Stage yields are cumulative. Only the completed final card includes post-shot drips.
 * Keep this a display override: recorded samples still drive charts and exit reasons.
 */
export function displayedStageYield(sampleWeight: number | undefined, completedFinalStage: boolean, finalYield?: number | string) {
  const value = typeof finalYield === 'string' && finalYield.trim() !== '' ? Number(finalYield) : finalYield
  if (completedFinalStage && typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  return sampleWeight
}
