import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

function Shell({ code, title, message }: { code: string; title: string; message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-6xl font-bold text-brand-accent">{code}</p>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <Shell
      code="404"
      title="Página no encontrada"
      message="La dirección que abriste no existe o cambio de lugar."
    />
  )
}

export function ForbiddenPage() {
  return (
    <Shell
      code="403"
      title="Sin acceso"
      message="Tu rol no tiene permiso para entrar a esta seccion. Si crees que es un error, habla con gerencia."
    />
  )
}
