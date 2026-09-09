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

  // Felicitar a alguien que empieza su turno con cuartos sucios sin asignar es
  // mentirle con confianza: la lista está vacía por el filtro, no por el trabajo.
  it('distingue "no hay trabajo" de "el trabajo no es tuyo todavía"', () => {
    const verTodas = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <CleaningQueue tasks={[]} isLoading={false} sinAsignar={3} onVerTodas={verTodas} />
      </QueryClientProvider>,
    )

    expect(screen.getByText('No tienes tareas asignadas')).toBeInTheDocument()
    expect(screen.getByText(/3 habitaciones pendientes/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ver todas/i }))
    expect(verTodas).toHaveBeenCalledTimes(1)
  })

  it('la primera pendiente se señala como la siguiente', () => {
    pintar([tarea(1, '204', 'PENDING'), tarea(2, '205', 'PENDING')])

    expect(screen.getAllByText('Sigue esta')).toHaveLength(1)
    expect(screen.getByText('204')).toBeInTheDocument()
  })

  // Las dos únicas salidas de una tarjeta, visibles y sin menú de por medio:
  // es la razón de que esta vista exista en lugar de la tabla.
  it('cada tarjeta ofrece liberar y reportar problema sin abrir menús', () => {
    pintar([tarea(1, '204', 'PENDING')])

    expect(screen.getByRole('button', { name: /todo bien/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /problema/i })).toBeInTheDocument()
  })

  // Los dos botones, uno debajo del otro y del ancho entero: lado a lado, el
  // dedo que falla cae en el de junto, y ahí los dos errores son caros.
  it('los botones ocupan el ancho y pasan de 48 px de alto', () => {
    pintar([tarea(1, '204', 'PENDING')])

    for (const nombre of [/todo bien/i, /problema/i]) {
      const boton = screen.getByRole('button', { name: nombre })
      expect(boton.className).toContain('w-full')
      expect(boton.className).toContain('h-14')
    }
  })

  it('un toque libera la habitación, sin pasos intermedios', async () => {
    const finish = vi.spyOn(housekeepingApi, 'finish').mockResolvedValue(tarea(1, '204', 'DONE'))
    pintar([tarea(1, '204', 'IN_PROGRESS')])

    fireEvent.click(screen.getByRole('button', { name: /todo bien/i }))

    await waitFor(() => expect(finish).toHaveBeenCalledWith(1, '', false))
  })

  // El backend no deja saltar de "pendiente" a "hecha". Que eso obligue a dar
  // dos toques -- empezar y luego terminar -- es trasladarle al pasillo un
  // detalle del modelo de datos.
  it('si la tarea no estaba iniciada, la inicia y la cierra en el mismo toque', async () => {
    const start = vi
      .spyOn(housekeepingApi, 'start')
      .mockResolvedValue(tarea(1, '204', 'IN_PROGRESS'))
    const finish = vi.spyOn(housekeepingApi, 'finish').mockResolvedValue(tarea(1, '204', 'DONE'))
    pintar([tarea(1, '204', 'PENDING')])

    fireEvent.click(screen.getByRole('button', { name: /todo bien/i }))

    await waitFor(() => expect(start).toHaveBeenCalledWith(1))
    await waitFor(() => expect(finish).toHaveBeenCalledWith(1, '', false))
  })
})
