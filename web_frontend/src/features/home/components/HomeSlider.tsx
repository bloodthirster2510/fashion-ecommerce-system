import { Carousel } from 'antd'
import sliderImage from '../../../assets/images/SliderTrue1.png'
import sliderImage2 from '../../../assets/images/ShopTrue2.png'

const slides = [
  {
    id: 'summer',
    image: sliderImage,
    label: 'Bộ sưu tập thời trang trẻ trung',
    href: '/products',
  },
  {
    id: 'daily',
    image: sliderImage2,
    label: 'Bộ sưu tập thời trang tối giản',
    href: '/products',
  },
]

export function HomeSlider() {
  return (
    <section className="slider" aria-label="Nội dung nổi bật">
      <Carousel autoplay autoplaySpeed={10000} arrows dots infinite pauseOnHover={false}>
        {slides.map((slide) => (
          <div key={slide.id}>
            <a className="slide" href={slide.href} aria-label={slide.label}>
              <img src={slide.image} alt={slide.label} />
            </a>
          </div>
        ))}
      </Carousel>
    </section>
  )
}
