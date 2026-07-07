type LoyaltyImpactSectionProps = {
  items: string[]
}

export function LoyaltyImpactSection({ items }: LoyaltyImpactSectionProps) {
  return (
    <section className="admin-loyalty-impact">
      <div className="admin-section-heading">
        <div>
          <p>Liên kết nghiệp vụ</p>
          <h2>Những nơi bị ảnh hưởng khi đổi chương trình thành viên</h2>
        </div>
      </div>

      <div className="admin-loyalty-impact-list">
        {items.map((item) => (
          <span key={item}><b aria-hidden="true">✓</b>{item}</span>
        ))}
      </div>
    </section>
  )
}
