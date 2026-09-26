// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { api } from './api'

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
describe('demo listing lifecycle', () => {
  it('registers, signs in, publishes, edits and hides a user-owned listing', async () => {
    const user = await api.register('example_user','password123')
    expect((await api.login('example_user','password123')).id).toBe(user.id)
    const input = { title:'Тестовая квартира', address:'Красноярск, улица Ленина, 25', price:6000000, area:48, rooms:2, floor:3, total_floors:9, description:'Тест' }
    const created = await api.create(input)
    expect(created.source).toBe('user')
    expect((await api.list()).some(x => x.id === created.id)).toBe(true)
    expect((await api.mine()).map(x => x.id)).toContain(created.id)
    await api.update(created.id,{...input,price:6200000})
    expect((await api.detail(created.id)).price).toBe(6200000)
    await api.hide(created.id)
    expect((await api.list()).some(x => x.id === created.id)).toBe(false)
    expect((await api.mine()).find(x => x.id === created.id)?.status).toBe('hidden')
  })
  it('rejects duplicate login and wrong password', async () => {
    await api.register('first_user','password123')
    await expect(api.register('FIRST_USER','password456')).rejects.toThrow('занят')
    await expect(api.login('first_user','wrongpass')).rejects.toThrow('Неверный')
  })
})
