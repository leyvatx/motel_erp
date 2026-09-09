import { useState } from 'react'
import { PiCalendarPlus, PiPlus, PiTrash } from 'react-icons/pi'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TariffRulePayload } from '@/features/config/api'
import {
  useCreateHoliday,
  useCreateTariffRule,
  useDeactivateHoliday,
  useDeactivateTariffRule,
  useHolidays,
  useTariffRules,
} from '@/features/config/hooks'
import { useAllTariffBlocks } from '@/features/config/hooks'
import { formatDate, formatMoney } from '@/lib/format'

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function DynamicPricingSettings() {
  const { t } = useTranslation()
  const rules = useTariffRules()
  const holidays = useHolidays()
  const tariffs = useAllTariffBlocks()
  const createRule = useCreateTariffRule()
  const deleteRule = useDeactivateTariffRule()
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeactivateHoliday()
  const [ruleOpen, setRuleOpen] = useState(false)
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [tariff, setTariff] = useState('')
  const [name, setName] = useState('')
  const [ruleType, setRuleType] = useState<TariffRulePayload['rule_type']>('WEEKDAY')
  const [mode, setMode] = useState<TariffRulePayload['price_mode']>('FIXED')
  const [value, setValue] = useState('')
  const [priority, setPriority] = useState('100')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')

  const openRule = () => {
    setTariff('')
    setName('')
    setRuleType('WEEKDAY')
    setMode('FIXED')
    setValue('')
    setPriority('100')
    setSelectedDays([])
    setStartDate('')
    setEndDate('')
    setStartTime('')
    setEndTime('')
    setRuleOpen(true)
  }
  const submitRule = (event: React.FormEvent) => {
    event.preventDefault()
    createRule.mutate(
      {
        tariff_block: Number(tariff),
        name,
        rule_type: ruleType,
        weekdays: selectedDays,
        start_date: startDate || null,
        end_date: endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        price_mode: mode,
        value,
        priority: Number(priority),
      },
      { onSuccess: () => setRuleOpen(false) },
    )
  }
  const submitHoliday = (event: React.FormEvent) => {
    event.preventDefault()
    createHoliday.mutate(
      { date: holidayDate, name: holidayName },
      { onSuccess: () => setHolidayOpen(false) },
    )
  }
  const blockName = (id: number) => {
    const block = tariffs.data?.results.find((item) => item.id === id)
    return block ? `${block.room_type_name} · ${block.name}` : `Tarifa #${id}`
  }
  const priceLabel = (rule: { price_mode: string; value: string }) =>
    rule.price_mode === 'FIXED'
      ? formatMoney(rule.value)
      : rule.price_mode === 'MULTIPLIER'
        ? `× ${rule.value}`
        : `+ ${formatMoney(rule.value)}`

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t('config.reglasDeTarifa')}</CardTitle>
            <CardDescription>{t('config.reglaMayorPrioridad')}</CardDescription>
          </div>
          <Button size="sm" onClick={openRule}>
            <PiPlus />
            {t('config.nuevaRegla')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('config.regla')}</TableHead>
                <TableHead>{t('config.tarifa')}</TableHead>
                <TableHead>{t('config.aplicacion')}</TableHead>
                <TableHead>{t('config.precio')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.data?.results.length ? (
                rules.data.results.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">Prioridad {rule.priority}</p>
                    </TableCell>
                    <TableCell>{blockName(rule.tariff_block)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.rule_type_display}</Badge>
                      {rule.weekdays.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {rule.weekdays.map((day) => weekdays[day]).join(', ')}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{priceLabel(rule)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (window.confirm(`¿Desactivar la regla ${rule.name}?`))
                            deleteRule.mutate(rule.id)
                        }}
                      >
                        <PiTrash />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={5} message={t('config.sinReglas')} />
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t('config.diasFestivos')}</CardTitle>
            <CardDescription>{t('config.activanReglas')}</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setHolidayDate('')
              setHolidayName('')
              setHolidayOpen(true)
            }}
          >
            <PiCalendarPlus />
            {t('config.agregar')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {holidays.data?.results.length ? (
            holidays.data.results.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteHoliday.mutate(item.id)}
                >
                  <PiTrash />
                </Button>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('config.sinFestivos')}
            </p>
          )}
        </CardContent>
      </Card>
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('config.nuevaReglaTarifaria')}</DialogTitle>
            <DialogDescription>{t('config.seAplicaAutomaticamente')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRule} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('config.tarifa')}</Label>
                <Select value={tariff} onValueChange={setTariff}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('config.selecciona')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(tariffs.data?.results ?? []).map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.room_type_name} · {item.name} ({formatMoney(item.base_price)} →{' '}
                        {formatMoney(item.current_price)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-name">{t('config.nombre')}</Label>
                <Input
                  id="rule-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('config.cuandoAplica')}</Label>
                <Select
                  value={ruleType}
                  onValueChange={(v) => setRuleType(v as TariffRulePayload['rule_type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKDAY">{t('config.diasDeSemana')}</SelectItem>
                    <SelectItem value="DATE_RANGE">{t('config.rangoDeFechas')}</SelectItem>
                    <SelectItem value="HOLIDAY">{t('config.diaFestivo')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('config.tipoDePrecio')}</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as TariffRulePayload['price_mode'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">{t('config.precioFijo')}</SelectItem>
                    <SelectItem value="MULTIPLIER">{t('config.multiplicador')}</SelectItem>
                    <SelectItem value="DELTA">{t('config.montoAdicional')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-value">{t('config.valor')}</Label>
                <Input
                  id="rule-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  required
                />
              </div>
            </div>
            {ruleType === 'WEEKDAY' ? (
              <div className="space-y-2">
                <Label>{t('config.dias')}</Label>
                <div className="flex flex-wrap gap-2">
                  {weekdays.map((day, index) => (
                    <label
                      key={day}
                      className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDays.includes(index)}
                        onChange={() =>
                          setSelectedDays((current) =>
                            current.includes(index)
                              ? current.filter((item) => item !== index)
                              : [...current, index],
                          )
                        }
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {ruleType === 'DATE_RANGE' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('config.desde')}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('config.hasta')}</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('config.horaInicial')}</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('config.horaFinal')}</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('config.prioridad')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRuleOpen(false)}>
                {t('config.cancelar')}
              </Button>
              <Button
                type="submit"
                loading={createRule.isPending}
                disabled={!tariff || !name || !value}
              >
                {t('config.crearRegla')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('config.agregarDiaFestivo')}</DialogTitle>
            <DialogDescription>{t('config.reglasFestivoAplican')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitHoliday} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-date">{t('config.fecha')}</Label>
              <Input
                id="holiday-date"
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-name">{t('config.nombre')}</Label>
              <Input
                id="holiday-name"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHolidayOpen(false)}>
                {t('config.cancelar')}
              </Button>
              <Button type="submit" loading={createHoliday.isPending}>
                {t('config.guardar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
