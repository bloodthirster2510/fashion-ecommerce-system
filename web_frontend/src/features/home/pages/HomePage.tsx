import { MainLayout } from '../../../layouts/MainLayout'
import { HomeSlider } from '../components/HomeSlider'

export function HomePage() {
  return (
    <MainLayout>
      <main>
        <HomeSlider />
      </main>
    </MainLayout>
  )
}
