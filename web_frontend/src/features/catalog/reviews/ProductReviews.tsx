import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Empty, Image, Input, Pagination, Rate, Select, Spin, message } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled, SendOutlined, UserOutlined } from '@ant-design/icons'
import { useAppSelector } from '../../../app/hooks'
import { reviewService } from './review.service'
import type {
  ProductReview,
  ProductReviewResponse,
  EligibleReviewItem,
  ReviewEligibility,
  ReviewListQuery,
} from './review.types'
import type { ProductVariant } from '../catalog.types'

type ProductReviewsProps = {
  productId: string
  variants: ProductVariant[]
}

const PAGE_SIZE = 5

const emptyReviewData: ProductReviewResponse = {
  items: [],
  summary: {
    averageRating: 0,
    reviewCount: 0,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0, percent: 0 })),
  },
  pagination: { page: 1, limit: PAGE_SIZE, totalItems: 0, totalPages: 0 },
}

const formatReviewDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  )

const estimateLegacyDistribution = (averageRating: number, reviewCount: number) => {
  // Một số product cũ chỉ có averageRating/reviewCount, chưa có từng review.
  // Ước lượng vào hai mức sao gần nhất để UI progress bar vẫn có dữ liệu hiển thị.
  const countByRating = new Map<number, number>()
  const lowerRating = Math.floor(averageRating)
  const upperRating = Math.ceil(averageRating)

  if (lowerRating === upperRating) {
    countByRating.set(lowerRating, reviewCount)
  } else {
    const upperCount = Math.round((averageRating - lowerRating) * reviewCount)
    countByRating.set(upperRating, upperCount)
    countByRating.set(lowerRating, reviewCount - upperCount)
  }

  return [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: countByRating.get(rating) ?? 0,
    percent: reviewCount > 0
      ? Math.round(((countByRating.get(rating) ?? 0) / reviewCount) * 100)
      : 0,
  }))
}

const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value)

const formatPurchasedVariant = (
  purchasedVariant: NonNullable<ProductReview['purchasedVariant']>,
  variants: ProductVariant[],
) => {
  // Dùng variantId để lấy label đang hiển thị trên trang sản phẩm, không đưa ObjectId ra UI.
  const fitTypeLabel = variants.find(
    (variant) => variant._id === purchasedVariant.variantId,
  )?.fitType?.label
  const safeStoredFitType = isObjectId(purchasedVariant.fitType) ? null : purchasedVariant.fitType

  return [
    fitTypeLabel ?? safeStoredFitType,
    purchasedVariant.color,
    `Size ${purchasedVariant.size}`,
  ].filter(Boolean).join(' / ')
}

export function ProductReviews({ productId, variants }: ProductReviewsProps) {
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const [reviewData, setReviewData] = useState<ProductReviewResponse>(emptyReviewData)
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null)
  const [eligibleItems, setEligibleItems] = useState<EligibleReviewItem[]>([])
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('')
  const [selectedRating, setSelectedRating] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [formRating, setFormRating] = useState(5)
  const [comment, setComment] = useState('')
  const [productQuality, setProductQuality] = useState(5)
  const [descriptionMatch, setDescriptionMatch] = useState(5)
  const [sizeFit, setSizeFit] = useState<'small' | 'true_to_size' | 'large'>('true_to_size')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [helpfulLoadingId, setHelpfulLoadingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadReviews = useCallback(async () => {
    const query: ReviewListQuery = { page, limit: PAGE_SIZE, sort: 'newest' }
    if (selectedRating) query.rating = selectedRating

    setIsLoading(true)
    try {
      setReviewData(await reviewService.listProductReviews(productId, query))
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể tải đánh giá sản phẩm.')
    } finally {
      setIsLoading(false)
    }
  }, [page, productId, selectedRating])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'user') {
      setEligibility(null)
      setEligibleItems([])
      return
    }

    // Eligibility là dữ liệu riêng của user hiện tại nên gọi bằng requestCustomer có token.
    reviewService
      .listEligibleItems(productId)
      .then((result) => {
        setEligibleItems(result.items)
        const eligibleItem = result.items.find((item) => item.canReview)
        const reviewedItem = result.items.find((item) => item.review)
        // Ưu tiên item được chỉ định qua query (?compose=1&orderItemId=...) khi đến từ trang đơn hàng.
        const composeRequested = new URLSearchParams(window.location.search).get('compose') === '1'
        const requestedOrderItemId = new URLSearchParams(window.location.search).get('orderItemId')
        const matchedItem = composeRequested && requestedOrderItemId
          ? result.items.find((item) => item.orderItemId === requestedOrderItemId) ?? null
          : null
        const selectedItem = matchedItem ?? eligibleItem ?? reviewedItem ?? result.items[0]
        if (!selectedItem) {
          setEligibility(null)
          setSelectedOrderItemId('')
          return
        }
        setSelectedOrderItemId(selectedItem.orderItemId)
        setEligibility({
          orderId: selectedItem.orderId,
          orderItemId: selectedItem.orderItemId,
          canReview: Boolean(matchedItem ?? eligibleItem),
          hasPurchased: true,
          hasReviewed: Boolean(reviewedItem),
          reviewId: reviewedItem?.review?._id ?? null,
          reviewStatus: reviewedItem?.review?.status ?? null,
          moderationReasons: reviewedItem?.review?.moderationReasons ?? [],
        })
      })
      .catch(() => setEligibility(null))
  }, [currentUser, productId])

  const reviewableItems = eligibleItems.filter((item) => item.canReview)
  const imagePreviews = useMemo(
    () => imageFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [imageFiles],
  )

  useEffect(() => () => {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
  }, [imagePreviews])

  const selectEligibleItem = (orderItemId: string) => {
    const item = eligibleItems.find((candidate) => candidate.orderItemId === orderItemId)
    if (!item) return
    setSelectedOrderItemId(orderItemId)
    // Đổi lần mua sẽ reset nội dung đang viết dở để tránh gửi nhầm cho dòng hàng khác.
    setComment('')
    setFormRating(5)
    setProductQuality(5)
    setDescriptionMatch(5)
    setSizeFit('true_to_size')
    setImageFiles([])
    setEligibility({
      orderId: item.orderId,
      orderItemId: item.orderItemId,
      canReview: item.canReview,
      hasPurchased: true,
      hasReviewed: Boolean(item.review),
      reviewId: item.review?._id ?? null,
      reviewStatus: item.review?.status ?? null,
      moderationReasons: item.review?.moderationReasons ?? [],
    })
  }

  const distribution = useMemo(() => {
    const hasDetailedDistribution = reviewData.summary.distribution.some((item) => item.count > 0)

    // Tương thích với backend/dữ liệu catalog cũ chỉ có averageRating và reviewCount.
    if (
      !hasDetailedDistribution &&
      reviewData.summary.reviewCount > 0 &&
      reviewData.summary.averageRating >= 1 &&
      reviewData.summary.averageRating <= 5
    ) {
      return estimateLegacyDistribution(
        reviewData.summary.averageRating,
        reviewData.summary.reviewCount,
      )
    }

    const countByRating = new Map(
      reviewData.summary.distribution.map((item) => [item.rating, item]),
    )
    return [5, 4, 3, 2, 1].map(
      (rating) => countByRating.get(rating) ?? { rating, count: 0, percent: 0 },
    )
  }, [
    reviewData.summary.averageRating,
    reviewData.summary.distribution,
    reviewData.summary.reviewCount,
  ])

  const handleFilterChange = (rating?: number) => {
    setSelectedRating(rating)
    setPage(1)
  }

  const handleSubmit = async () => {
    if (comment.trim().length < 10) {
      message.warning('Nội dung đánh giá cần có ít nhất 10 ký tự.')
      return
    }
    if (!eligibility?.canReview) {
      message.warning('Sản phẩm này chưa đủ điều kiện đánh giá.')
      return
    }

    setIsSubmitting(true)
    try {
      const createdReview = await reviewService.createReview({
        orderId: eligibility.orderId,
        orderItemId: eligibility.orderItemId,
        rating: formRating,
        comment: comment.trim(),
        criteria: { productQuality, descriptionMatch, sizeFit },
      }, imageFiles)
      message.success(createdReview.moderationStatus === 'pending'
        ? 'Đánh giá đã được gửi và đang chờ kiểm duyệt.'
        : 'Cảm ơn bạn đã đánh giá sản phẩm!')
      setComment('')
      setFormRating(5)
      setProductQuality(5)
      setDescriptionMatch(5)
      setSizeFit('true_to_size')
      setImageFiles([])
      setPage(1)
      setSelectedRating(undefined)
      // Cập nhật eligibility cục bộ ngay để form biến mất, rồi load lại danh sách review.
      setEligibility((current) =>
        current ? {
          ...current,
          canReview: false,
          hasReviewed: true,
          reviewId: createdReview._id,
          reviewStatus: createdReview.moderationStatus ?? 'visible',
          moderationReasons: createdReview.moderationReasons ?? [],
        } : current,
      )
      await loadReviews()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể gửi đánh giá.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleHelpful = async (reviewId: string) => {
    if (!currentUser) {
      message.info('Vui lòng đăng nhập để đánh dấu đánh giá hữu ích.')
      return
    }
    setHelpfulLoadingId(reviewId)
    try {
      const result = await reviewService.toggleHelpful(reviewId)
      setReviewData((current) => ({
        ...current,
        items: current.items.map((review) => review._id === reviewId
          ? { ...review, helpfulCount: result.helpfulCount, hasVotedHelpful: result.hasVotedHelpful }
          : review),
      }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể cập nhật lượt hữu ích.')
    } finally {
      setHelpfulLoadingId(null)
    }
  }

  return (
    <section className="product-reviews" aria-labelledby="product-reviews-title">
      <h2 id="product-reviews-title">Đánh giá của khách hàng</h2>

      <div className="review-overview">
        <div className="review-score-card">
          <strong>{reviewData.summary.averageRating.toFixed(1)}</strong>
          <Rate disabled allowHalf value={reviewData.summary.averageRating} />
          <span>{reviewData.summary.reviewCount} đánh giá</span>
        </div>

        <div className="review-distribution" aria-label="Phân bố điểm đánh giá">
          {distribution.map((item) => (
            <div className="review-distribution-row" key={item.rating}>
              <span>{item.rating} ★</span>
              <div className="review-progress" aria-hidden="true">
                <i style={{ width: `${item.percent}%` }} />
              </div>
              <small>{item.count} đánh giá</small>
            </div>
          ))}
        </div>

        <div className="review-promise">
          <strong>Đánh giá sản phẩm từ người mua</strong>
          <p><CheckCircleFilled /> Chỉ khách đã nhận và thanh toán đơn hàng mới có thể đánh giá.</p>
          <p><CheckCircleFilled /> Mỗi đánh giá đều được xác minh từ đơn mua thực tế.</p>
        </div>
      </div>

      {eligibility?.reviewStatus === 'pending' && (
        <div className="review-moderation-alert" role="status">
          <ExclamationCircleFilled />
          <div>
            <strong>Đánh giá của bạn đang chờ kiểm duyệt</strong>
            <p>Hệ thống phát hiện: {eligibility.moderationReasons.join(', ')}. Nội dung sẽ được hiển thị sau khi quản trị viên duyệt.</p>
          </div>
        </div>
      )}

      {eligibility?.reviewStatus === 'hidden' && (
        <div className="review-moderation-alert is-removed" role="status">
          <ExclamationCircleFilled />
          <div><strong>Nội dung đánh giá đã bị ẩn</strong><p>Đánh giá vi phạm tiêu chuẩn cộng đồng và không còn được hiển thị công khai.</p></div>
        </div>
      )}

      {eligibility?.canReview && (
        <div className="review-compose">
          <div>
            <strong>Chia sẻ trải nghiệm của bạn</strong>
            <span>Sản phẩm này đã được giao đến bạn.</span>
          </div>
          {reviewableItems.length > 1 && (
            <label className="review-compose-field">
              <span>Chọn lần mua</span>
              <Select
                value={selectedOrderItemId}
                onChange={selectEligibleItem}
                options={reviewableItems.map((item) => ({
                  value: item.orderItemId,
                  label: `${item.orderCode} · ${item.variant.color} · Size ${item.variant.size}`,
                }))}
              />
            </label>
          )}
          <Rate value={formRating} onChange={setFormRating} />
          <div className="review-criteria-grid">
            <label><span>Chất lượng sản phẩm</span><Rate value={productQuality} onChange={setProductQuality} /></label>
            <label><span>Đúng với mô tả</span><Rate value={descriptionMatch} onChange={setDescriptionMatch} /></label>
            <label><span>Độ vừa vặn</span><Select value={sizeFit} onChange={setSizeFit} options={[
              { value: 'small', label: 'Nhỏ hơn dự kiến' },
              { value: 'true_to_size', label: 'Đúng kích thước' },
              { value: 'large', label: 'Lớn hơn dự kiến' },
            ]} /></label>
          </div>
          <Input.TextArea
            value={comment}
            maxLength={2000}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder="Sản phẩm có đúng mô tả không? Chất liệu, kiểu dáng và trải nghiệm sử dụng thế nào?"
            onChange={(event) => setComment(event.target.value)}
          />
          <label className="review-image-picker">
            <span>Ảnh thực tế (tối đa 5 ảnh, 5MB/ảnh)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, 5)
                const invalid = files.find((file) => file.size > 5 * 1024 * 1024)
                if (invalid) {
                  message.warning(`${invalid.name} vượt quá 5MB.`)
                  event.target.value = ''
                  return
                }
                if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
                  message.warning('Tổng dung lượng ảnh không được vượt quá 20MB.')
                  event.target.value = ''
                  return
                }
                setImageFiles(files)
              }}
            />
          </label>
          {imagePreviews.length > 0 && <div className="review-image-previews">{imagePreviews.map(({ file, url }) => (
            <span key={`${file.name}-${file.lastModified}`}><img src={url} alt={file.name} /><button type="button" onClick={() => setImageFiles((files) => files.filter((item) => item !== file))}>×</button></span>
          ))}</div>}
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            Gửi đánh giá
          </Button>
        </div>
      )}

      {currentUser && eligibility?.hasReviewed && (
        <p className="review-status-note"><CheckCircleFilled /> Bạn đã đánh giá sản phẩm này.</p>
      )}

      <div className="review-filters" aria-label="Lọc đánh giá">
        <button
          type="button"
          className={selectedRating === undefined ? 'active' : ''}
          onClick={() => handleFilterChange()}
        >
          Tất cả ({reviewData.summary.reviewCount})
        </button>
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = distribution.find((item) => item.rating === rating)?.count ?? 0
          return (
            <button
              type="button"
              className={selectedRating === rating ? 'active' : ''}
              key={rating}
              onClick={() => handleFilterChange(rating)}
            >
              {rating} sao ({count})
            </button>
          )
        })}
      </div>

      <Spin spinning={isLoading}>
        <div className="review-list">
          {!isLoading && reviewData.items.length === 0 ? (
            <Empty description={selectedRating ? `Chưa có đánh giá ${selectedRating} sao.` : 'Chưa có đánh giá nào.'} />
          ) : (
            reviewData.items.map((review) => (
              <article className="review-item" key={review._id}>
                <Avatar
                  size={40}
                  src={review.user.avatarImage || undefined}
                  icon={!review.user.name ? <UserOutlined /> : undefined}
                >
                  {review.user.name?.trim().charAt(0).toUpperCase()}
                </Avatar>
                <div className="review-content">
                  <div className="review-author-line">
                    <strong>{review.user.name || 'Khách hàng'}</strong>
                    {review.verifiedPurchase && <span><CheckCircleFilled /> Đã mua hàng</span>}
                    {review.purchasedVariant && (
                      <span className="review-purchased-variant">
                        Phân loại: {formatPurchasedVariant(review.purchasedVariant, variants)}
                      </span>
                    )}
                  </div>
                  <Rate disabled value={review.rating} />
                  <p>{review.comment}</p>
                  {review.images.length > 0 && <Image.PreviewGroup><div className="review-media-grid">{review.images.map((image) => (
                    <Image key={image._id ?? image.url} src={image.thumbnailUrl || image.url} preview={{ src: image.url }} alt="Ảnh đánh giá sản phẩm" />
                  ))}</div></Image.PreviewGroup>}
                  {review.adminReply && <div className="review-shop-reply"><strong>Phản hồi từ Fashionista</strong><p>{review.adminReply.content}</p>{review.adminReply.repliedAt && <time dateTime={review.adminReply.repliedAt}>{formatReviewDate(review.adminReply.repliedAt)}</time>}</div>}
                  <time dateTime={review.createdAt}>Đã đánh giá vào {formatReviewDate(review.createdAt)}</time>
                  <button
                    className={review.hasVotedHelpful ? 'review-helpful-button is-active' : 'review-helpful-button'}
                    type="button"
                    disabled={helpfulLoadingId === review._id || currentUser?.role !== 'user' || review.user._id === currentUser._id}
                    title={!currentUser
                      ? 'Đăng nhập để đánh dấu đánh giá hữu ích'
                      : currentUser.role !== 'user'
                        ? 'Chỉ tài khoản khách hàng có thể đánh dấu hữu ích'
                        : review.user._id === currentUser._id
                          ? 'Bạn không thể đánh dấu đánh giá của chính mình'
                          : undefined}
                    onClick={() => void handleHelpful(review._id)}
                  >
                    Hữu ích ({review.helpfulCount})
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </Spin>

      {reviewData.pagination.totalItems > PAGE_SIZE && (
        <Pagination
          className="review-pagination"
          current={page}
          pageSize={PAGE_SIZE}
          total={reviewData.pagination.totalItems}
          showSizeChanger={false}
          onChange={setPage}
        />
      )}
    </section>
  )
}
