import { localHousingMedia } from '../data/localHousingMedia.generated'
import type { Apartment, ApartmentPhoto } from '../types'

function cleanPath(value:string) {
  return value.replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/, '')
}

function localMediaRelativePath(value:string) {
  const path=cleanPath(value)
  const marker='/media/'
  const index=path.lastIndexOf(marker)
  if (index >= 0) return path.slice(index+marker.length)
  if (path.startsWith('media/')) return path.slice('media/'.length)
  return path
}

function encodedPath(value:string) {
  return value.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

const base=(import.meta.env.VITE_LOCAL_MEDIA_BASE_URL || '/media').replace(/\/$/,'')

export function localMediaUrl(value:string|null|undefined) {
  if (!value) return null
  const relative=localMediaRelativePath(value)
  return relative ? `${base}/${encodedPath(relative)}` : null
}

export function resolvePhotoUrl(photo:Partial<ApartmentPhoto>) {
  const url=typeof photo.url === 'string' ? photo.url.trim() : ''
  if (url) return url
  return localMediaUrl(photo.local_path || photo.storage_key)
}

export function withLocalHousingMedia(apartment:Apartment):Apartment {
  if (apartment.photos.some(photo => resolvePhotoUrl(photo))) return apartment

  const candidates=[
    apartment.id,
    apartment.external_id,
    apartment.upstream_source && apartment.upstream_source_id
      ? `${apartment.upstream_source}:${apartment.upstream_source_id}`
      : undefined
  ].filter((value):value is string => !!value)

  for (const key of candidates) {
    const photos=localHousingMedia[key]
    if (!photos?.length) continue
    return {
      ...apartment,
      photos:[...photos]
        .sort((a,b) => a.order-b.order)
        .map(photo => ({ ...photo,url:resolvePhotoUrl(photo) || '' }))
    }
  }

  if (apartment.cover_storage_key) {
    const url=localMediaUrl(apartment.cover_storage_key)
    if (url) {
      return {
        ...apartment,
        photos:[{
          id:`local-cover:${apartment.id}`,
          url,
          order:0,
          is_cover:true,
          storage_key:apartment.cover_storage_key
        }]
      }
    }
  }

  return apartment
}
