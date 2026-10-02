// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonthPicker } from '../../renderer/src/components/MonthPicker'

describe('MonthPicker', () => {
  it('muestra el mes en español con un solo trigger', async () => {
    const onChange = vi.fn()
    render(<MonthPicker value="2026-09" onChange={onChange} />)

    expect(screen.getByText('Septiembre 2026')).toBeInTheDocument()
  })

  it('abre panel del sistema, bloquea meses futuros y selecciona uno pasado', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MonthPicker value="2026-10" max="2026-10" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /2026/ }))
    const dialog = await screen.findByRole('dialog', { name: /Selector de mes/i })
    expect(dialog).toBeInTheDocument()

    // Nov 2026 (futuro respecto a max) debe estar deshabilitado
    const nov = screen.getByRole('button', { name: 'Nov' })
    expect(nov).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Sep' }))
    expect(onChange).toHaveBeenCalledWith('2026-09')
  })

  it('botón Este mes vuelve al mes actual', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MonthPicker value="2025-01" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /2025/ }))
    await user.click(await screen.findByRole('button', { name: /Este mes/i }))

    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(onChange).toHaveBeenCalledWith(expected)
  })
})
