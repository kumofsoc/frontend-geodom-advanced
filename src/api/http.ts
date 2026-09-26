import { apiBase,apiRequestTimeoutMs,assertLiveApiConfigured } from './config'
import type { User } from '../types'

export type ApiFieldErrors=Record<string,string[]>

export class ApiError extends Error {
  status:number|null
  code:string|null
  detail:string
  fields:ApiFieldErrors|null
  requestId:string|null

  constructor({
    message,
    status=null,
    code=null,
    detail=message,
    fields=null,
    requestId=null
  }:{
    message:string
    status?:number|null
    code?:string|null
    detail?:string
    fields?:ApiFieldErrors|null
    requestId?:string|null
  }) {
    super(message)
    this.name='ApiError'
    this.status=status
    this.code=code
    this.detail=detail
    this.fields=fields
    this.requestId=requestId
  }
}

export type Session={user:User;token:string}
const sessionKey='geodom-session-v1'

export function getSession():Session|null {
  try { return JSON.parse(sessionStorage.getItem(sessionKey) || '') as Session }
  catch { return null }
}

export function storeSession(session:Session|null) {
  if (session) sessionStorage.setItem(sessionKey,JSON.stringify(session))
  else sessionStorage.removeItem(sessionKey)
}

function abortError(error:unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function request<T>(path:string,options:RequestInit={}):Promise<T> {
  assertLiveApiConfigured()
  const session=getSession()
  const controller=new AbortController()
  let externallyAborted=false
  const abortFromCaller=() => { externallyAborted=true;controller.abort() }
  options.signal?.addEventListener('abort',abortFromCaller,{once:true})
  const timeout=globalThis.setTimeout(() => controller.abort(),apiRequestTimeoutMs)

  try {
    const response=await fetch(`${apiBase}${path}`,{
      ...options,
      signal:controller.signal,
      headers:{
        ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),
        ...(session?.token ? {Authorization:`Bearer ${session.token}`} : {}),
        ...options.headers
      }
    })
    const requestId=response.headers.get('X-Request-ID')

    if (!response.ok) {
      let body:Record<string,unknown>={}
      try { body=await response.json() as Record<string,unknown> } catch {}
      const detail=typeof body.detail === 'string' ? body.detail : 'Не удалось выполнить действие'
      const code=typeof body.error === 'string' ? body.error : typeof body.code === 'string' ? body.code : null
      const fields=body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields) ? body.fields as ApiFieldErrors : null
      throw new ApiError({message:detail,status:response.status,code,detail,fields,requestId:typeof body.request_id === 'string' ? body.request_id : requestId})
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
    const raw=await response.text()
    if (!raw) return undefined as T
    try { return JSON.parse(raw) as T }
    catch { throw new ApiError({message:'Сервер вернул ответ в неожиданном формате.',status:response.status,code:'invalid_response',requestId}) }
  } catch(error) {
    if (error instanceof ApiError) throw error
    if (abortError(error)) {
      if (externallyAborted) throw error
      throw new ApiError({message:'Сервер отвечает слишком долго. Попробуйте ещё раз.',code:'timeout'})
    }
    throw new ApiError({message:'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.',code:'network_error'})
  } finally {
    globalThis.clearTimeout(timeout)
    options.signal?.removeEventListener('abort',abortFromCaller)
  }
}
