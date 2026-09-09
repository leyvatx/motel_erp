import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useProducts,
  useStockAdjustment,
  useStockEntry,
  useStockTransfer,
  useStockWaste,
  useWarehouses,
} from '@/features/inventory/hooks'

export type MovementMode = 'entry' | 'waste' | 'transfer' | 'adjust'

/* Claves, no texto: esta tabla vive fuera de todo componente y ahí no hay
   hook que valga. La cadena se trae al pintar, que además es lo que hace que
   el diálogo cambie de idioma sin recargar. */
const TITLES: Record<MovementMode, { title: string; description: string }> = {
  entry: { title: 'inventario.entradaDeMercancia', description: 'inventario.entradaDescripcion' },
  waste: { title: 'inventario.mermaOCaducidad', description: 'inventario.mermaDescripcion' },
  transfer: {
    title: 'inventario.traspasoEntreAlmacenes',
    description: 'inventario.traspasoDescripcion',
  },
  adjust: {
    title: 'inventario.ajustePorConteo',
    description: 'inventario.ajusteDescripcion',
  },
}

interface Props {
  mode: MovementMode | null
  onOpenChange: (open: boolean) => void
}

export function MovementDialog({ mode, onOpenChange }: Props) {
  const { t } = useTranslation()
  const { data: warehouses } = useWarehouses()
  const { data: products } = useProducts({ page_size: 200 })

  const entry = useStockEntry()
  const waste = useStockWaste()
  const transfer = useStockTransfer()
  const adjust = useStockAdjustment()

  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [lotCode, setLotCode] = useState('')
  const [expiration, setExpiration] = useState('')
  const [reason, setReason] = useState('')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (mode) {
      setProductId('')
      setWarehouseId('')
      setTargetWarehouseId('')
      setQuantity('')
      setUnitCost('')
      setLotCode('')
      setExpiration('')
      setReason('')
      setExpired(false)
    }
  }, [mode])

  if (!mode) return null

  const selectedProduct = (products?.results ?? []).find((item) => item.id === Number(productId))
  const pending = entry.isPending || waste.isPending || transfer.isPending || adjust.isPending
  const close = (): void => onOpenChange(false)

  const requiresReason = mode === 'waste' || mode === 'adjust'
  const isValid =
    Boolean(productId && warehouseId && quantity) &&
    (!requiresReason || reason.trim().length >= 5) &&
    (mode !== 'transfer' || Boolean(targetWarehouseId))

  const submit = (): void => {
    const base = { product_id: Number(productId), warehouse_id: Number(warehouseId) }

    if (mode === 'entry') {
      entry.mutate(
        {
          ...base,
          quantity,
          ...(unitCost ? { unit_cost: unitCost } : {}),
          ...(lotCode ? { lot_code: lotCode } : {}),
          ...(expiration ? { expiration_date: expiration } : {}),
          reason,
        },
        { onSuccess: close },
      )
      return
    }

    if (mode === 'waste') {
      waste.mutate({ ...base, quantity, expired, reason }, { onSuccess: close })
      return
    }

    if (mode === 'transfer') {
      transfer.mutate(
        {
          product_id: Number(productId),
          source_warehouse_id: Number(warehouseId),
          target_warehouse_id: Number(targetWarehouseId),
          quantity,
          reason,
        },
        { onSuccess: close },
      )
      return
    }

    adjust.mutate({ ...base, counted_quantity: quantity, reason }, { onSuccess: close })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(TITLES[mode].title)}</DialogTitle>
          <DialogDescription>{t(TITLES[mode].description)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="product">{t('inventario.producto')}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="product">
                <SelectValue placeholder={t('inventario.eligeElProducto')} />
              </SelectTrigger>
              <SelectContent>
                {(products?.results ?? []).map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.sku} - {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="warehouse">
                {mode === 'transfer' ? t('inventario.almacenOrigen') : t('inventario.almacen')}
              </Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger id="warehouse">
                  <SelectValue placeholder={t('inventario.elige')} />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses?.results ?? []).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === 'transfer' ? (
              <div className="space-y-2">
                <Label htmlFor="target">{t('inventario.almacenDestino')}</Label>
                <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                  <SelectTrigger id="target">
                    <SelectValue placeholder={t('inventario.elige')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(warehouses?.results ?? [])
                      .filter((warehouse) => String(warehouse.id) !== warehouseId)
                      .map((warehouse) => (
                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  {mode === 'adjust' ? 'Cantidad contada' : t('inventario.cantidad')}
                </Label>
                <Input
                  id="quantity"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            )}
          </div>

          {mode === 'transfer' ? (
            <div className="space-y-2">
              <Label htmlFor="transfer-qty">{t('inventario.cantidad')}</Label>
              <Input
                id="transfer-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          ) : null}

          {mode === 'entry' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="cost">{t('inventario.costoUnitario')}</Label>
                <Input
                  id="cost"
                  inputMode="decimal"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                />
              </div>

              {selectedProduct?.track_expiration ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="lot">{t('inventario.lote')}</Label>
                    <Input
                      id="lot"
                      value={lotCode}
                      onChange={(event) => setLotCode(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration">{t('inventario.caducidad')}</Label>
                    <Input
                      id="expiration"
                      type="date"
                      value={expiration}
                      onChange={(event) => setExpiration(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'waste' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expired}
                onChange={(event) => setExpired(event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {t('inventario.bajaPorCaducidad')}
            </label>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo {requiresReason ? '' : '(opcional)'}</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={mode === 'waste' ? 'Producto derramado' : 'Conteo mensual'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('inventario.cancelar')}
          </Button>
          <Button disabled={!isValid} loading={pending} onClick={submit}>
            {t('inventario.confirmar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
