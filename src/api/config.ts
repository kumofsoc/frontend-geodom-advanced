export type DataMode='live'|'demo'

const rawMode=String(import.meta.env.VITE_DATA_MODE || (import.meta.env.MODE === 'test' ? 'demo' : 'live')).trim().toLowerCase()

export const dataMode:DataMode=rawMode === 'demo' ? 'demo' : 'live'
export const isDemo=dataMode === 'demo'
export const apiBase=String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/,'')
const configuredTimeout=Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS || 15000)
export const apiRequestTimeoutMs=Number.isFinite(configuredTimeout) && configuredTimeout >= 1000 ? configuredTimeout : 15000

export function assertLiveApiConfigured() {
  if (!isDemo && !apiBase) {
    throw new Error('Live mode включён, но VITE_API_URL не задан. Для демо укажите VITE_DATA_MODE=demo явно.')
  }
}
