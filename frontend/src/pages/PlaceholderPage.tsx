import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  title: string
  description?: string
}

/** Pantalla temporal para las secciones que llegan en las Fases 8 y 9. */
export default function PlaceholderPage({ title, description }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description ?? 'Modulo en construccion.'}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Esta seccion se implementa en una fase posterior del desarrollo.
      </CardContent>
    </Card>
  )
}
