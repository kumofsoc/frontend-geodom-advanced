import { demoApartments } from '../data/demo'
import type { Apartment } from '../types'
import { readLocal,writeLocal } from './common'

export const demoHomesKey='geodom-demo-apartments-v1'
export const demoUsersKey='geodom-demo-users-v1'

export function demoHomes() {
  return [...demoApartments,...readLocal<Apartment[]>(demoHomesKey,[])]
}

export function saveDemoHomes(items:Apartment[]) {
  writeLocal(demoHomesKey,items)
}

export async function imageData(file:File):Promise<string> {
  const bitmap=await createImageBitmap(file)
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height))
  const canvas=document.createElement('canvas')
  canvas.width=Math.round(bitmap.width*scale)
  canvas.height=Math.round(bitmap.height*scale)
  canvas.getContext('2d')?.drawImage(bitmap,0,0,canvas.width,canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg',.72)
}
