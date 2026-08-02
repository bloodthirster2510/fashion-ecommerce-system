import { useEffect, useState } from 'react'
import { useAppSelector } from '../../../app/hooks'
import { MainLayout } from '../../../layouts/MainLayout'
import { CouponsSection } from '../components/CouponsSection'
import { FavoritesSection } from '../components/FavoritesSection'
import { MembershipSection } from '../components/MembershipSection'
import { OrdersSection } from '../components/OrdersSection'
import { ProfileInfoSection } from '../components/ProfileInfoSection'
import { ProfileSidebar } from '../components/ProfileSidebar'
import type { AccountSection } from '../profile.types'
import '../profile.css'

const getAccountSection = (): AccountSection => {
  const section = new URLSearchParams(window.location.search).get('section')
  if (section === 'orders') return 'orders'
  if (section === 'favorites') return 'favorites'
  if (section === 'ranking') return 'ranking'
  if (section === 'coupons') return 'coupons'
  return 'profile'
}

const renderAccountSection = (section: AccountSection) => {
  if (section === 'orders') return <OrdersSection />
  if (section === 'favorites') return <FavoritesSection />
  if (section === 'ranking') return <MembershipSection />
  if (section === 'coupons') return <CouponsSection />
  return <ProfileInfoSection />
}

export function ProfilePage() {
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const [activeSection, setActiveSection] = useState<AccountSection>(() => getAccountSection())
  const visibleSection = activeSection === 'favorites' && currentUser?.role !== 'user' ? 'profile' : activeSection

  useEffect(() => {
    const handleLocationChange = () => setActiveSection(getAccountSection())

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  useEffect(() => {
    if (activeSection !== 'favorites' || !currentUser || currentUser.role === 'user') return

    window.history.replaceState(null, '', '/account')
    setActiveSection('profile')
  }, [activeSection, currentUser])

  return (
    <MainLayout>
      <main className="account-page">
        <div className="account-shell">
          <ProfileSidebar
            name={currentUser?.name}
            avatarImage={currentUser?.avatarImage}
            role={currentUser?.role}
            selectedKey={visibleSection}
          />
          <section className="account-content" aria-label="Nội dung tài khoản">
            {renderAccountSection(visibleSection)}
          </section>
        </div>
      </main>
    </MainLayout>
  )
}
