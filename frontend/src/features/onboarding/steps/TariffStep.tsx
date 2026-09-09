import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StepField, StepShell } from '@/features/onboarding/steps/StepShell'
import { useCreateTariff } from '@/features/config/hooks'
import { useRoomTypes } from '@/features/frontdesk/hooks'

export function TariffStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const { data: types } = useRoomTypes()
  const create = useCreateTariff()

  const opciones = types?.results ?? []
  const [roomType, setRoomType] = useState('')
  const [hours, setHours] = useState('4')
  const [price, setPrice] = useState('')

  const primerTipo = opciones[0]
  const tipo = roomType || (primerTipo ? String(primerTipo.id) : '')
  const valid = tipo !== '' && Number(hours) > 0 && price.trim() !== ''

  const submit = (): void => {
    create.mutate(
      {
        room_type: Number(tipo),
        name: t('asistente.horasNombre', { horas: hours }),
        duration_minutes: Math.round(Number(hours) * 60),
        base_price: price.trim(),
        overstay_hour_price: '0.00',
        grace_minutes: 15,
        is_default: true,
      },
      { onSuccess: () => onDone() },
    )
  }

  return (
    <StepShell valid={valid} submitting={create.isPending} onSubmit={submit}>
      {opciones.length > 1 ? (
        <StepField label={t('asistente.paraQueTipo')} htmlFor="setup-tariff-type">
          <Select value={tipo} onValueChange={setRoomType}>
            <SelectTrigger id="setup-tariff-type">
              <SelectValue placeholder={t('asistente.eligeElTipo')} />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StepField label={t('asistente.cuantasHoras')} htmlFor="setup-hours">
          <Input
            id="setup-hours"
            type="number"
            min={0.5}
            step={0.5}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
        </StepField>

        <StepField label={t('asistente.cuantoCuesta')} htmlFor="setup-price">
          <Input
            id="setup-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="350.00"
            autoFocus
          />
        </StepField>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('asistente.quedaComoSugerida')}
      </p>
    </StepShell>
  )
}
