import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CleaningQueue } from '@/features/housekeeping/components/CleaningQueue'
import { housekeepingApi } from '@/features/housekeeping/api'
import type { CleaningTask, CleaningTaskStatus } from '@/features/housekeeping/types'

function tarea(id: number, numero: string, status: CleaningTaskStatus): CleaningTask {
  return {
    id,
    room: id,
    room_number: numero,
    stay: null,
    task_type: 'CHECKOUT',
    task_type_display: 'Salida de huésped',
    status,
    status_display: status,
    priority: 100,
    assigned_to: null,
    assigned_to_name: null,
    assigned_at: null,
    started_at: status === 'IN_PROGRESS' ? '2026-09-07T11:50:00Z' : null,
    finished_at: null,
    duration_seconds: null,
    elapsed_seconds: null,
    verified_by: null,
    verified_at: null,
    notes: '',
    found_issues: false,
    cancellation_reason: '',
    created_at: '2026-09-07T11:00:00Z',
  }
}

function pintar(tasks: CleaningTask[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CleaningQueue tasks={tasks} isLoading={false} />
    </QueryClientProvider>,
  )
}

describe('cola de limpieza', () => {
  it('sin tareas explica de dónde saldrán, no dice "sin datos"', () => {
    pintar([])

    expect(screen.getByText('No hay nada pendiente')).toBeInTheDocument()
    expect(screen.getByText(/Cuando salga un huésped/)).toBeInTheDocument()
  })

  it('la primera pendiente se señala como la siguiente', () => {
    pintar([tarea(1, '204', 'PENDING'), tarea(2, '205', 'PENDING')])

    expect(screen.getAllByText('Sigue esta')).toHaveLength(1)
    expect(screen.getByText('204')).toBeInTheDocument()
  })

  // Las dos únicas salidas de una tarjeta, visibles y sin menú de por medio:
  // es la razón de que esta vista exista en lugar de la tabla.
  it('cada tarjeta ofrece empezar y reportar problema sin abrir menús', () => {
    pintar([tarea(1, '204', 'PENDING')])

    expect(screen.getByRole('button', { name: /empezar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /problema/i })).toBeInTheDocument()
  })

  it('la tarea en proceso cambia a "Lista" y pide confirmar antes de cerrarla', async () => {
    const finish = vi.spyOn(housekeepingApi, 'finish').mockResolvedValue(tarea(1, '204', 'DONE'))
    pintar([tarea(1, '204', 'IN_PROGRESS')])

    fireEvent.click(screen.getByRole('button', { name: /lista/i }))

    // No se cierra de un toque: primero aparece la barra de confirmación, para
    // que un roce con el guante no libere un cuarto sin limpiar.
    expect(screen.getByText('Habitación 204 lista')).toBeInTheDocument()
    expect(finish).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(finish).toHaveBeenCalledWith(1, '', false))
  })
})
