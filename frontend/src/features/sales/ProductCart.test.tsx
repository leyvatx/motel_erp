import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProductPicker, useCart } from '@/features/sales/ProductCart'
import type { Product } from '@/features/inventory/types'

function producto(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    sku: 'CERV-001',
    barcode: '',
    name: 'Cerveza clara 355 ml',
    category: 1,
    category_name: 'Bebidas',
    unit: 'PIECE',
    unit_display: 'Pieza',
    image_url: null,
    is_sellable: true,
    is_stockable: true,
    track_expiration: false,
    sale_price: '45.00',
    last_cost: '0.00',
    average_cost: '0.00',
    tax_rate: '0.00',
    default_min_stock: '0',
    total_stock: '10.000',
    is_active: true,
    ...overrides,
  }
}

function Catalogo({ catalog }: { catalog: Product[] }) {
  const cart = useCart()
  return <ProductPicker catalog={catalog} isLoading={false} cart={cart} autoFocus={false} />
}

function tarjeta(nombre: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(nombre) }) as HTMLButtonElement
}

describe('catálogo del punto de venta', () => {
  it('deja vender lo que tiene existencia', () => {
    render(<Catalogo catalog={[producto()]} />)

    expect(tarjeta('Cerveza clara').disabled).toBe(false)
    expect(screen.queryByText('Sin existencia')).toBeNull()
  })

  // Un producto recién dado de alta no tiene ni un renglón de existencias y el
  // servidor manda `total_stock: null`. Leyéndolo como "desconocido" la tarjeta
  // quedaba encendida, el producto entraba a la cuenta y el cobro reventaba con
  // "no hay suficiente" -- con el cliente enfrente.
  it('un inventariable sin renglón de existencias cuenta como agotado', () => {
    render(<Catalogo catalog={[producto({ total_stock: null })]} />)

    expect(tarjeta('Cerveza clara').disabled).toBe(true)
    expect(screen.getByText('Sin existencia')).toBeTruthy()
  })

  it('un servicio se vende sin existencias porque no consume inventario', () => {
    render(
      <Catalogo
        catalog={[producto({ name: 'Lavandería', is_stockable: false, total_stock: null })]}
      />,
    )

    expect(tarjeta('Lavandería').disabled).toBe(false)
    expect(screen.queryByText('Sin existencia')).toBeNull()
  })
})
