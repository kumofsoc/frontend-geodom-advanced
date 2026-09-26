// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { migrateLegacyStorage } from './storage'
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
it('keeps existing demo accounts and listings when the product is renamed', () => {
  localStorage.setItem('sreda-demo-users-v1','[{"user":{"id":"1","login":"test"}}]')
  localStorage.setItem('geodom-demo-apartments-v1','newer-data')
  sessionStorage.setItem('sreda-session-v1','old-session')
  migrateLegacyStorage()
  expect(localStorage.getItem('geodom-demo-users-v1')).toContain('test')
  expect(localStorage.getItem('geodom-demo-apartments-v1')).toBe('newer-data')
  expect(sessionStorage.getItem('geodom-session-v1')).toBe('old-session')
})
