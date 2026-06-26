import { useEffect, useState } from 'react'
import { useAppSelector } from '../../../app/hooks'
import { MainLayout } from '../../../layouts/MainLayout'
import { CouponsSection } from '../components/CouponsSection'
import { MembershipSection } from '../components/MembershipSection'
import { OrdersSection } from '../components/OrdersSection'
import { ProfileInfoSection } from '../components/ProfileInfoSection'
import { ProfileSidebar } from '../components/ProfileSidebar'
import type { AccountSection } from '../profile.types'
import '../profile.css'

const getAccountSection = (): AccountSection => {
  const section = new URLSearchParams(window.location.search).get('section')
  if (section === 'orders') return 'orders'
  if (section === 'ranking') return 'ranking'
  if (section === 'coupons') return 'coupons'
  return 'profile'
}

const renderAccountSection = (section: AccountSection) => {
  if (section === 'orders') return <OrdersSection />
  if (section === 'ranking') return <MembershipSection />
  if (section === 'coupons') return <CouponsSection />
  return <ProfileInfoSection />
}

export function ProfilePage() {
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const [activeSection, setActiveSection] = useState<AccountSection>(() => getAccountSection())

  useEffect(() => {
    const handleLocationChange = () => setActiveSection(getAccountSection())

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  return (
    <MainLayout>
      <main className="account-page">
        <div className="account-shell">
          <ProfileSidebar name={currentUser?.name} avatarImage={currentUser?.avatarImage} selectedKey={activeSection} />
          <section className="account-content" aria-label="Nội dung tài khoản">
            {renderAccountSection(activeSection)}
          </section>
        </div>
      </main>
    </MainLayout>
  )
}
