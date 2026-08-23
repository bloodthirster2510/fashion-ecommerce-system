import { Skeleton } from 'antd'

type AccountSectionSkeletonProps = {
  variant: 'profile' | 'list' | 'grid' | 'ranking' | 'payment'
}

export function AccountSectionSkeleton({ variant }: AccountSectionSkeletonProps) {
  if (variant === 'profile') {
    return (
      <div className="account-section-skeleton account-section-skeleton-profile" aria-label="Đang tải thông tin tài khoản" aria-busy="true">
        <Skeleton active title={{ width: '32%' }} paragraph={{ rows: 5, width: ['100%', '100%', '48%', '100%', '34%'] }} />
        <Skeleton active title={{ width: '42%' }} paragraph={{ rows: 4, width: ['100%', '48%', '48%', '30%'] }} />
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className="account-section-skeleton account-section-skeleton-grid" aria-label="Đang tải danh sách" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="account-section-skeleton-card" key={index}>
            <Skeleton active avatar paragraph={{ rows: 3 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`account-section-skeleton account-section-skeleton-${variant}`} aria-label="Đang tải dữ liệu" aria-busy="true">
      <Skeleton active title={{ width: '38%' }} paragraph={{ rows: variant === 'ranking' ? 8 : 5 }} />
      {variant === 'ranking' && <Skeleton active title={false} paragraph={{ rows: 5 }} />}
      {variant === 'payment' && <Skeleton active title={{ width: '28%' }} paragraph={{ rows: 4 }} />}
    </div>
  )
}