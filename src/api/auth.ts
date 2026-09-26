import { isDemo } from './config'
import { demoDelay,readLocal,writeLocal } from './common'
import { demoUsersKey } from './demoState'
import { ApiError,getSession,request,storeSession } from './http'
import { createId,demoPasswordDigest,matchesDemoPassword } from '../lib/id'
import type { User } from '../types'

export const authApi={
  session:getSession,

  async register(login:string,password:string):Promise<User> {
    if (!isDemo) return request<User>('/api/auth/register',{method:'POST',body:JSON.stringify({login,password})})
    await demoDelay()
    const users=readLocal<{user:User;digest:string}[]>(demoUsersKey,[])
    if (users.some(x => x.user.login.toLowerCase() === login.toLowerCase())) throw new Error('Этот логин уже занят')
    const user={id:createId(),login}
    users.push({user,digest:demoPasswordDigest(password)})
    writeLocal(demoUsersKey,users)
    return user
  },

  async login(login:string,password:string):Promise<User> {
    if (!isDemo) {
      const result=await request<{access_token:string;user:User}>('/api/auth/login',{method:'POST',body:JSON.stringify({login,password})})
      storeSession({user:result.user,token:result.access_token})
      return result.user
    }
    await demoDelay()
    const account=readLocal<{user:User;digest:string}[]>(demoUsersKey,[]).find(x => x.user.login.toLowerCase() === login.toLowerCase())
    if (!account || !await matchesDemoPassword(password,account.digest)) throw new Error('Неверный логин или пароль')
    storeSession({user:account.user,token:'demo-only'})
    return account.user
  },

  async currentUser():Promise<User|null> {
    if (isDemo) return getSession()?.user ?? null
    if (!getSession()) return null
    try { return await request<User>('/api/auth/me') }
    catch(error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        storeSession(null)
        return null
      }
      return getSession()?.user ?? null
    }
  },

  logout() { storeSession(null) }
}
