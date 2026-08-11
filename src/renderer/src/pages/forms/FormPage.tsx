import { useParams } from 'react-router-dom'
import { ToastContainer } from '@/components/ToastContainer'
import { UserFormPage } from './UserFormPage'
import { ProductFormPage } from './ProductFormPage'
import { MovementFormPage } from './MovementFormPage'
import { PlanFormPage } from './PlanFormPage'
import { PromoFormPage } from './PromoFormPage'
import { TemplateFormPage } from './TemplateFormPage'
import { MeasurementFormPage } from './MeasurementFormPage'
import { GoalFormPage } from './GoalFormPage'
import { RenewFormPage } from './RenewFormPage'
import { FreezeFormPage } from './FreezeFormPage'
import { AbonoFormPage } from './AbonoFormPage'
import { StatsFormPage } from './StatsFormPage'

const FORM_PAGES: Record<string, () => JSX.Element> = {
  user: UserFormPage,
  product: ProductFormPage,
  movement: MovementFormPage,
  plan: PlanFormPage,
  promo: PromoFormPage,
  template: TemplateFormPage,
  measurement: MeasurementFormPage,
  goal: GoalFormPage,
  renew: RenewFormPage,
  freeze: FreezeFormPage,
  abono: AbonoFormPage,
  stats: StatsFormPage
}

export function FormPage(): JSX.Element {
  const { type } = useParams<{ type: string }>()
  const Page = (type && FORM_PAGES[type]) || null

  if (!Page) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--color-secondary)'
        }}
      >
        Formulario desconocido: {type}
      </div>
    )
  }

  return (
    <>
      <Page />
      <ToastContainer />
    </>
  )
}
