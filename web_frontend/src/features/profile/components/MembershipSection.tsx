import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Progress } from 'antd'
import { profileService, type UserMembership } from '../profile.service'
import { formatPoint, getTierBenefit, getTierCondition } from '../profile.utils'
import { AccountSectionSkeleton } from './AccountSectionSkeleton'

const openLoyaltySupport = () => {
  window.history.pushState(null, '', '/account/support/new?category=loyalty&source=loyalty')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function MembershipSection() {
  const [membership, setMembership] = useState<UserMembership | null>(null)
  const [isLoadingMembership, setIsLoadingMembership] = useState(true)
  const [membershipError, setMembershipError] = useState('')

  useEffect(() => {
    let isMounted = true
    setIsLoadingMembership(true)
    setMembershipError('')

    profileService
      .getMembership()
      .then((result) => {
        if (isMounted) setMembership(result)
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return
        setMembershipError(loadError instanceof Error ? loadError.message : 'Không thể tải hạng thành viên.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingMembership(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="account-ranking" aria-labelledby="account-ranking-title">
      <h1 id="account-ranking-title">Hạng thẻ thành viên</h1>

      {membershipError && <Alert type="error" message={membershipError} showIcon />}

      {isLoadingMembership ? (
        <AccountSectionSkeleton variant="ranking" />
      ) : !membership ? (
          <Empty description="Chưa có dữ liệu hạng thành viên." />
        ) : (
          <>
            <section
              className="membership-rank-hero"
              style={{
                background: membership.currentTier?.cardColor || undefined,
                color: membership.currentTier?.textColor || undefined,
              }}
            >
              <div>
                <span>Hạng hiện tại</span>
                <strong>{membership.currentTier?.name || 'Member'}</strong>
                <p>Điểm tích lũy: {formatPoint(membership.loyaltyPoint)} điểm</p>
                <p>
                  {membership.nextTier && membership.pointToNextTier !== null
                    ? `Còn ${formatPoint(membership.pointToNextTier)} điểm để lên hạng ${membership.nextTier.name}`
                    : 'Bạn đang ở hạng cao nhất'}
                </p>
              </div>
              <Progress percent={membership.progressPercent} showInfo={false} strokeColor="#f6eddb" trailColor="rgba(246,237,219,0.24)" />
            </section>

            <div className="membership-rank-table" role="table" aria-label="Bảng hạng thành viên">
              <div className="membership-rank-row is-head" role="row">
                <span role="columnheader">Hạng thẻ</span>
                <span role="columnheader">Điều kiện (Tổng điểm tích lũy)</span>
                <span role="columnheader">Ưu đãi giảm giá</span>
              </div>
              {membership.tiers.map((tier) => {
                const isCurrent = membership.currentTier?._id === tier._id || membership.currentTier?.name === tier.name

                return (
                  <div className={`membership-rank-row${isCurrent ? ' is-current' : ''}`} role="row" key={tier._id || tier.name}>
                    <span role="cell">
                      <strong>{tier.name}</strong>
                      {isCurrent && <em>Hiện tại</em>}
                    </span>
                    <span role="cell">{getTierCondition(tier)}</span>
                    <span role="cell">{getTierBenefit(tier)}</span>
                  </div>
                )
              })}
            </div>

            <Alert
              className="membership-rank-note"
              type="info"
              message="Lưu ý: Điểm tích lũy được tính từ tất cả các đơn hàng đã hoàn thành. Hạng thẻ sẽ được cập nhật tự động khi đạt điều kiện."
              showIcon={false}
            />
          </>
        )}
      <Button onClick={openLoyaltySupport}>Cần hỗ trợ về điểm hoặc hạng?</Button>
    </section>
  )
}
