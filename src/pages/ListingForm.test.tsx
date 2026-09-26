// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ListingForm } from './ListingForm'
import { api } from '../lib/api'
import { demoApartments } from '../data/demo'

vi.mock('../App', () => ({ useAuth: () => ({ user: { id: 'owner', login: 'owner' } }) }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('retries only the remaining photo on a saved listing after a partial upload failure', async () => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
  vi.stubGlobal('scrollTo', vi.fn())
  const created = { ...demoApartments[0], id: 'created-id', owner_id: 'owner' }
  const create = vi.spyOn(api, 'create').mockResolvedValue(created)
  const update = vi.spyOn(api, 'update').mockResolvedValue(created)
  const first = new File(['one'], 'first.jpg', { type: 'image/jpeg' })
  const second = new File(['two'], 'second.jpg', { type: 'image/jpeg' })
  let failSecond = true
  const upload = vi.spyOn(api, 'upload').mockImplementation(async (_id, file) => {
    if (file.name === 'second.jpg' && failSecond) { failSecond = false; throw new Error('Сеть недоступна') }
  })
  const { container } = render(<MemoryRouter initialEntries={['/new']}><Routes><Route path="/new" element={<ListingForm/>}/><Route path="/account" element={<h1>Личный кабинет</h1>}/></Routes></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Название объявления *'), { target: { value: 'Новая квартира' } })
  fireEvent.change(screen.getByLabelText('Адрес в Красноярске *'), { target: { value: 'Красноярск, Ленина, 25' } })
  fireEvent.change(screen.getByLabelText('Цена, ₽ *'), { target: { value: '6000000' } })
  fireEvent.change(screen.getByLabelText('Площадь, м² *'), { target: { value: '45' } })
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [first, second] } })
  fireEvent.click(screen.getByRole('button', { name: 'Опубликовать квартиру' }))

  await screen.findByRole('alert')
  expect(screen.getByRole('alert').textContent).toContain('Сеть недоступна')
  expect(screen.getByText('second.jpg')).toBeTruthy()
  expect(screen.queryByText('first.jpg')).toBeNull()
  expect(create).toHaveBeenCalledTimes(1)
  expect(upload.mock.calls.map(([,file]) => file.name)).toEqual(['first.jpg', 'second.jpg'])

  const tooMany = Array.from({ length: 9 }, (_, index) => new File(['extra'], `extra-${index}.jpg`, { type: 'image/jpeg' }))
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: tooMany } })
  expect(screen.getByRole('alert').textContent).toContain('Не больше 10 фотографий')
  expect(screen.queryByText('extra-0.jpg')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /Повторить загрузку/ }))
  await screen.findByRole('heading', { name: 'Личный кабинет' })
  expect(create).toHaveBeenCalledTimes(1)
  expect(update).toHaveBeenCalledOnce()
  expect(update).toHaveBeenCalledWith('created-id', expect.objectContaining({ title: 'Новая квартира' }))
  expect(upload.mock.calls.map(([,file]) => file.name)).toEqual(['first.jpg', 'second.jpg', 'second.jpg'])
  expect(upload.mock.calls.every(([id]) => id === 'created-id')).toBe(true)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Личный кабинет' })).toBeTruthy())
})

it('rejects image formats outside JPG, PNG and WebP', () => {
  const { container } = render(<MemoryRouter><ListingForm/></MemoryRouter>)
  const svg = new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [svg] } })
  expect(screen.getByRole('alert').textContent).toContain('JPG, PNG или WebP')
  expect(screen.queryByAltText('Новое фото 1')).toBeNull()
})
