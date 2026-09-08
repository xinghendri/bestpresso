import type { MachineSnapshot } from '../../api/decaid/types.ts'
import type { UtilityOperationKind } from '../../domain/brewing.ts'

function snapshotSubstate(state: MachineSnapshot['state']) {
  if (!state || typeof state === 'string') return undefined
  return typeof state.substate === 'string' ? state.substate.toLowerCase() : undefined
}

export function utilityOutputHasStarted(kind: UtilityOperationKind, state: MachineSnapshot['state']) {
  void kind
  const substate = snapshotSubstate(state)
  return substate === undefined || substate === 'pouring'
}

export function utilityTimerStartedAt(kind: UtilityOperationKind, currentStartedAt: number | undefined, state: MachineSnapshot['state'], now: number) {
  if (currentStartedAt !== undefined) return currentStartedAt
  return utilityOutputHasStarted(kind, state) ? now : undefined
}

export function utilityElapsedMs(startedAt: number | undefined, now: number) {
  return startedAt === undefined ? 0 : Math.max(0, now - startedAt)
}
