export function readLocal<T>(key:string,fallback:T):T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T }
  catch { return fallback }
}

export function writeLocal(key:string,value:unknown) {
  localStorage.setItem(key,JSON.stringify(value))
}

export const demoDelay=(ms=120) => new Promise(resolve => globalThis.setTimeout(resolve,ms))
