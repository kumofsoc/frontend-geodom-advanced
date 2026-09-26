// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'

const sessionKey='geodom-session-v1'
const session={user:{id:'u1',login:'ivan'},token:'token-1'}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL','https://api.example.test')
  vi.stubEnv('VITE_API_REQUEST_TIMEOUT_MS','1000')
  sessionStorage.clear()
  localStorage.clear()
  sessionStorage.setItem(sessionKey,JSON.stringify(session))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('live API session resilience',() => {
  it('keeps the local session during a transient network outage',async () => {
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('offline')))
    const {api,isDemo}=await import('./api')

    expect(isDemo).toBe(false)
    await expect(api.currentUser()).resolves.toEqual(session.user)
    expect(api.session()).toEqual(session)
  })

  it('clears the session when the backend explicitly rejects authorization',async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(
      JSON.stringify({detail:'unauthorized'}),
      {status:401,headers:{'Content-Type':'application/json'}}
    )))
    const {api}=await import('./api')

    await expect(api.currentUser()).resolves.toBeNull()
    expect(api.session()).toBeNull()
  })
})
