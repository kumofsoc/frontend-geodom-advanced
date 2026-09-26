// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { defaultPreferences, loadPreferences, savePreferences, validatePreferences } from './preferences'

beforeEach(() => localStorage.clear())
it('restores saved inputs and ignores invalid stored data', () => {
  expect(loadPreferences()).toEqual(defaultPreferences)
  savePreferences({ ...defaultPreferences, budget_max: 9000000, priorities: { ...defaultPreferences.priorities, parks: 5 } })
  expect(loadPreferences().priorities.parks).toBe(5)
  expect(loadPreferences().budget_max).toBe(9000000)
  localStorage.setItem('geodom-recommendation-preferences-v1', '{broken')
  expect(loadPreferences()).toEqual(defaultPreferences)
})
it('rejects a down payment higher than the budget', () => {
  expect(validatePreferences({ ...defaultPreferences, budget_max: 5000000, down_payment: 6000000 })).toMatch(/взнос/)
})
