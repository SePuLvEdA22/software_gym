import { useState } from 'react'
import { Icons } from '@/components/Icons'
import { PlansSection } from '@/components/settings/PlansSection'
import { StaffSection } from '@/components/settings/StaffSection'
import { FacilitySection } from '@/components/settings/FacilitySection'
import { BrandingSection } from '@/components/settings/BrandingSection'
import { HardwareSection } from '@/components/settings/HardwareSection'
import { WhatsappSection } from '@/components/settings/WhatsappSection'
import { SystemSection } from '@/components/settings/SystemSection'

type SettingsSection = 'plans' | 'staff' | 'facility' | 'branding' | 'hardware' | 'whatsapp' | 'system'

const SETTINGS_NAV: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'plans', label: 'Planes de Membresía', icon: <Icons.Membership /> },
  { id: 'staff', label: 'Personal y Roles', icon: <Icons.User /> },
  { id: 'facility', label: 'Info del Gimnasio', icon: <Icons.Door /> },
  { id: 'branding', label: 'Marca y Apariencia', icon: <Icons.Sun /> },
  { id: 'hardware', label: 'Integración de Hardware', icon: <Icons.Settings /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <Icons.Bell /> },
  { id: 'system', label: 'Sistema', icon: <Icons.Shield /> },
]

export function SettingsPage(): JSX.Element {
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('plans')

  return (
    <div className="flex-col gap-md">
      <div>
        <h1 className="display-lg">Configuración del Sistema</h1>
        <p className="body-lg" style={{ color: 'var(--color-on-surface-variant)', marginTop: 8 }}>
          Configure los planes de membresía, permisos del personal, hardware e imagen de su gimnasio.
        </p>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SETTINGS_NAV.map(item => (
            <button
              key={item.id}
              className={`settings-nav-item${settingsSection === item.id ? ' active' : ''}`}
              onClick={() => setSettingsSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="bento-card settings-content">
          {settingsSection === 'plans' && <PlansSection />}
          {settingsSection === 'staff' && <StaffSection />}
          {settingsSection === 'facility' && <FacilitySection />}
          {settingsSection === 'branding' && <BrandingSection />}
          {settingsSection === 'hardware' && <HardwareSection />}
          {settingsSection === 'whatsapp' && <WhatsappSection />}
          {settingsSection === 'system' && <SystemSection />}
        </div>
      </div>
    </div>
  )
}
