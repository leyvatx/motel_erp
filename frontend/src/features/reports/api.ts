import { useQuery } from '@tanstack/react-query'

import { api, get } from '@/lib/axios'

export type ReportKind = 'occupancy' | 'revenue' | 'products' | 'shifts' | 'housekeeping'
export interface ReportPeriod {
  from: string
  to: string
}

export interface OccupancyReport {
  summary: { rentals: number; rooms: number; average_minutes: number; occupancy_rate: number }
  daily: { date: string; rentals: number }[]
  by_room_type: { name: string; rentals: number }[]
}

export interface RevenueReport {
  summary: { revenue: string; payments: number; expenses: string; net: string }
  daily: { date: string; revenue: string; payments: number }[]
  by_method: { method: string; total: string; payments: number }[]
}

export interface ProductsReport {
  summary: { products: number; units: string; revenue: string; margin: string }
  products: {
    product_id: number
    name: string
    sku: string
    quantity: string
    revenue: string
    cost: string
    margin: string
  }[]
}

export interface ShiftsReport {
  summary: { sales: string; expenses: string; difference: string; shifts: number }
  shifts: {
    id: number
    code: string
    business_date: string
    cashier__full_name: string
    shift_type: string
    status: string
    sales: string
    expenses_total: string
    difference: string
    folios_closed: number
  }[]
}

export interface HousekeepingReport {
  summary: {
    tasks: number
    average_seconds: number
    issues: number
    maintenance: number
    maintenance_resolved: number
  }
  employees: {
    assigned_to_id: number | null
    name: string | null
    tasks: number
    average_seconds: number | null
    issues: number
  }[]
}

export type ReportData =
  OccupancyReport | RevenueReport | ProductsReport | ShiftsReport | HousekeepingReport

export function useReport<T extends ReportData>(
  kind: ReportKind,
  period: ReportPeriod,
  enabled = true,
) {
  return useQuery({
    queryKey: ['reports', kind, period],
    queryFn: () => get<T>(`/reports/${kind}/`, { params: period }),
    enabled,
  })
}

export async function exportReport(kind: ReportKind, period: ReportPeriod): Promise<Blob> {
  const { data } = await api.get<Blob>(`/reports/${kind}/`, {
    params: { ...period, export: 'csv' },
    responseType: 'blob',
  })
  return data
}
