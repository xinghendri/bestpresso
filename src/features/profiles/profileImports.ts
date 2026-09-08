import type { DecaidProfile, DecaidProfileRecord } from '../../api/decaid/types'
import { composeBuilderProfileTitle, copiedProfileName, splitBuilderProfileTitle } from './profileBuilderModel.ts'

export interface ParsedProfileImport {
  profile: DecaidProfile
  metadata: Record<string, unknown> | null
}

export interface VisualizerImportResult {
  success?: boolean
  profileTitle?: string
  profileId?: string | null
  workflowResult?: {
    id?: string | null
    profile?: DecaidProfileRecord | DecaidProfile
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function parseProfileImport(text: string): ParsedProfileImport {
  let decoded: unknown
  try {
    decoded = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (!isObject(decoded)) throw new Error('That file does not contain a profile.')
  const candidate = isObject(decoded.profile) ? decoded.profile : decoded
  const steps = candidate.steps
  if (typeof candidate.title !== 'string' || !candidate.title.trim()) throw new Error('The imported profile needs a name.')
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('The imported profile does not contain any brewing stages.')
  if (!steps.every(isObject)) throw new Error('One or more brewing stages in this file are invalid.')

  return {
    profile: candidate as DecaidProfile,
    metadata: isObject(decoded.metadata) ? decoded.metadata : null,
  }
}

export function normalizeVisualizerShareCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function isVisualizerShareCode(value: string) {
  return /^\d{4}$/.test(value)
}

export function visualizerCredentialsConfigured(settings: Record<string, unknown>) {
  const username = typeof settings.Username === 'string' ? settings.Username.trim() : ''
  const password = isObject(settings.Password) && settings.Password.isSet === true
  return Boolean(username && password)
}

export function deduplicateImportedProfileTitle(profile: DecaidProfile, existingTitles: string[]) {
  const parsed = splitBuilderProfileTitle(profile.title, profile.category)
  const normalizedTitle = composeBuilderProfileTitle(parsed.title, parsed.category)
  const occupied = new Set(existingTitles.map((title) => title.trim().toLowerCase()))
  if (!occupied.has(normalizedTitle.toLowerCase())) return normalizedTitle
  return composeBuilderProfileTitle(copiedProfileName(parsed.title, parsed.category, existingTitles), parsed.category)
}

export function visualizerImportedProfileId(result: VisualizerImportResult) {
  return result.profileId ?? result.workflowResult?.id ?? undefined
}
