import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  title: string
  description?: string
}

export default function PlaceholderPage({ title, description }: Props) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description ?? t('comun.moduloEnConstruccion')}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Esta seccion se implementa en una fase posterior del desarrollo.
      </CardContent>
    </Card>
  )
}
