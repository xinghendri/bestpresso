import type { DecentAccountStatus } from '../../api/decaid/types'

export function profileAuthorForAccount(account: DecentAccountStatus | null | undefined) {
  const username = account?.loggedIn && typeof account.username === 'string'
    ? account.username.trim()
    : ''
  return username || 'user'
}
