import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

/** Con el alta habilitada monta el panel de producto nuevo, y ese consulta
 *  categorías: necesita su propio cliente de react-query. */
function ProductPickerConAlta({ catalog }: { catalog: Product[] }) {
  const cart = useCart()
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={cliente}>
      <ProductPicker
        catalog={catalog}
        isLoading={false}
        cart={cart}
        autoFocus={false}
        allowCreate
      />
    </QueryClientProvider>
  )
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

describe('catálogo visual de alta velocidad', () => {
  it('la insignia de existencia flota sobre la foto, sin robarle renglón al nombre', () => {
    render(<Catalogo catalog={[producto({ total_stock: '3.000' })]} />)

    // Tres o menos se avisa en la esquina; el nombre y el precio conservan su
    // espacio, que es lo que se lee para elegir.
    expect(screen.getByText('3')).toBeTruthy()
    expect(tarjeta('Cerveza clara').disabled).toBe(false)
  })

  it('agotado se apaga y no se puede tocar', () => {
    render(<Catalogo catalog={[producto({ total_stock: '0' })]} />)

    const boton = tarjeta('Cerveza clara')
    expect(boton.disabled).toBe(true)
    // `grayscale` además de la opacidad: a media luz, apagado a secas seguía
    // pareciendo vendible.
    expect(boton.className).toContain('grayscale')
  })

  it('ofrece dar de alta un producto desde la cuadrícula, no desde otro menú', () => {
    render(<ProductPickerConAlta catalog={[producto()]} />)

    expect(screen.getByRole('button', { name: /Añadir producto/ })).toBeTruthy()
  })

  it('sin permiso de catálogo no aparece el atajo de alta', () => {
    render(<Catalogo catalog={[producto()]} />)

    expect(screen.queryByRole('button', { name: /Añadir producto/ })).toBeNull()
  })
})
