import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ImageWithFallback } from '@/components/ui/image'

describe('imagen con respaldo', () => {
  it('sin src dibuja el respaldo y no una etiqueta img vacía', () => {
    const { container } = render(<ImageWithFallback src={null} fallback={<span>iniciales</span>} />)

    expect(screen.getByText('iniciales')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  // El caso del disco efímero: la fila sigue apuntando a un archivo que el
  // despliegue se llevó. Sin esto queda el ícono de imagen rota del navegador
  // justo en el logotipo de la esquina.
  it('cambia al respaldo cuando la carga falla', () => {
    const { container } = render(
      <ImageWithFallback
        src="/media/logo-que-ya-no-existe.png"
        fallback={<span>iniciales</span>}
      />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()

    fireEvent.error(img as HTMLImageElement)

    expect(screen.getByText('iniciales')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('otra imagen en el mismo hueco vuelve a intentarlo', () => {
    const { container, rerender } = render(
      <ImageWithFallback src="/media/rota.png" fallback={<span>iniciales</span>} />,
    )
    fireEvent.error(container.querySelector('img') as HTMLImageElement)
    expect(container.querySelector('img')).toBeNull()

    rerender(<ImageWithFallback src="/media/otra.png" fallback={<span>iniciales</span>} />)

    expect(container.querySelector('img')).not.toBeNull()
  })
})
