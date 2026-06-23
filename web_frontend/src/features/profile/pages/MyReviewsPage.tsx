import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Image, Input, Modal, Rate, Select, Spin, message } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { useAppSelector } from '../../../app/hooks'
import { ProfileSidebar } from '../components/ProfileSidebar'
import { reviewService } from '../../catalog/reviews/review.service'
import type { EligibleReviewItem, MyReview } from '../../catalog/reviews/review.types'
import '../profile.css'

export function MyReviewsPage() {
  const user = useAppSelector((state) => state.auth.currentUser)
  const [eligible, setEligible] = useState<EligibleReviewItem[]>([])
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [editingReview, setEditingReview] = useState<MyReview | null>(null)
  const [saving, setSaving] = useState(false)
  const load = async () => {
    const [eligibleResult, reviewResult] = await Promise.all([reviewService.listEligibleItems(), reviewService.listMyReviews()])
    setEligible(eligibleResult.items.filter((item) => item.canReview)); setReviews(reviewResult.items)
  }
  useEffect(() => { void load().catch((error) => message.error(error instanceof Error ? error.message : 'Không thể tải đánh giá')).finally(() => setLoading(false)) }, [])
  const remove = async (id: string) => {
    if (!window.confirm('Xóa đánh giá này? Hành động không thể hoàn tác.')) return
    try { await reviewService.deleteReview(id); await load(); message.success('Đã xóa đánh giá.') }
    catch (error) { message.error(error instanceof Error ? error.message : 'Không thể xóa đánh giá.') }
  }
  const openEdit = (review: MyReview) => setEditingReview(review)
  const saveEdit = async (input: {
    rating: number
    comment: string
    criteria: { productQuality: number; descriptionMatch: number; sizeFit: 'small' | 'true_to_size' | 'large' }
    keepImageIds: string[]
    newImages: File[]
  }) => {
    if (!editingReview) return
    if (input.comment.trim().length < 10) { message.warning('Nội dung cần ít nhất 10 ký tự.'); return }
    setSaving(true)
    try {
      await reviewService.updateReview(editingReview._id, {
        rating: input.rating,
        comment: input.comment.trim(),
        criteria: input.criteria,
        keepImageIds: input.keepImageIds,
        images: input.newImages,
      })
      await load()
      message.success('Đã cập nhật đánh giá. Nội dung có thể được kiểm duyệt lại.')
      setEditingReview(null)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể cập nhật đánh giá.')
    } finally { setSaving(false) }
  }
  return <MainLayout showSlider={false}><main className="account-page"><div className="account-shell"><ProfileSidebar name={user?.name} avatarImage={user?.avatarImage} selectedKey="reviews" /><section className="account-content"><h1>Đánh giá của tôi</h1><Spin spinning={loading}><h2>Có thể đánh giá</h2>{eligible.length ? eligible.map((item) => <article className="my-review-card" key={item.orderItemId}><img src={item.product.image} alt="" /><div><strong>{item.product.name}</strong><span>{item.orderCode} · {item.variant.color} · Size {item.variant.size}</span></div><Button href={`/products/${item.product._id}?compose=1&orderId=${item.orderId}&orderItemId=${item.orderItemId}`}>Viết đánh giá</Button></article>) : <Empty description="Không có sản phẩm đang chờ đánh giá" />}<h2>Đã đánh giá</h2>{reviews.length ? reviews.map((review) => <article className="my-review-card" key={review._id}><img src={review.product.image} alt="" /><div><strong>{review.product.name}</strong><Rate disabled value={review.rating} /><p>{review.comment}</p><span>Trạng thái: {review.moderationStatus ?? 'visible'}</span>{review.adminReply ? <small>Fashionista: {review.adminReply.content}</small> : null}</div><div><Button onClick={() => openEdit(review)}>Sửa</Button><Button danger onClick={() => void remove(review._id)}>Xóa</Button></div></article>) : <Empty description="Bạn chưa có đánh giá" />}</Spin></section></div></main><EditReviewModal review={editingReview} saving={saving} onCancel={() => setEditingReview(null)} onSave={saveEdit} /></MainLayout>
}

type EditFormState = {
  rating: number
  comment: string
  productQuality: number
  descriptionMatch: number
  sizeFit: 'small' | 'true_to_size' | 'large'
  keepImageIds: string[]
  newImages: File[]
}

export function EditReviewModal({ review, saving, onCancel, onSave }: {
  review: MyReview | null
  saving: boolean
  onCancel: () => void
  onSave: (input: EditFormState) => void
}) {
  const [form, setForm] = useState<EditFormState | null>(null)
  useEffect(() => {
    if (!review) { setForm(null); return }
    setForm({
      rating: review.rating,
      comment: review.comment,
      productQuality: review.criteria?.productQuality ?? 5,
      descriptionMatch: review.criteria?.descriptionMatch ?? 5,
      sizeFit: review.criteria?.sizeFit ?? 'true_to_size',
      keepImageIds: review.images.filter((image) => image._id).map((image) => image._id as string),
      newImages: [],
    })
  }, [review])

  const imagePreviews = useMemo(
    () => (form?.newImages ?? []).map((file) => ({ file, url: URL.createObjectURL(file) })),
    [form?.newImages],
  )
  useEffect(() => () => { imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url)) }, [imagePreviews])

  if (!review || !form) return null

  const toggleKeep = (imageId: string) => {
    setForm((current) => current ? {
      ...current,
      keepImageIds: current.keepImageIds.includes(imageId)
        ? current.keepImageIds.filter((id) => id !== imageId)
        : [...current.keepImageIds, imageId],
    } : current)
  }
  const onPickImages = (files: File[]) => {
    if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
      message.warning('Tổng dung lượng ảnh không được vượt quá 20MB.')
      return
    }
    const oversized = files.find((file) => file.size > 5 * 1024 * 1024)
    if (oversized) { message.warning(`${oversized.name} vượt quá 5MB.`); return }
    const remaining = 5 - form.keepImageIds.length - form.newImages.length
    if (remaining <= 0) { message.warning('Đã đạt giới hạn 5 ảnh mỗi đánh giá.'); return }
    if (files.length > remaining) { message.warning(`Chỉ còn có thể thêm ${remaining} ảnh.`); return }
    setForm((current) => current ? { ...current, newImages: [...current.newImages, ...files] } : current)
  }

  return <Modal
    open={!!review}
    title="Chỉnh sửa đánh giá"
    onCancel={onCancel}
    confirmLoading={saving}
    okText="Lưu thay đổi"
    cancelText="Hủy"
    okButtonProps={{ disabled: form.comment.trim().length < 10 }}
    onOk={() => onSave(form)}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><strong>{review.product.name}</strong></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Đánh giá tổng quan</span>
        <Rate value={form.rating} onChange={(value) => setForm((current) => current ? { ...current, rating: value } : current)} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Chất lượng sản phẩm</span>
          <Rate value={form.productQuality} onChange={(value) => setForm((current) => current ? { ...current, productQuality: value } : current)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Đúng với mô tả</span>
          <Rate value={form.descriptionMatch} onChange={(value) => setForm((current) => current ? { ...current, descriptionMatch: value } : current)} />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Độ vừa vặn</span>
        <Select value={form.sizeFit} onChange={(value: EditFormState['sizeFit']) => setForm((current) => current ? { ...current, sizeFit: value } : current)} options={[
          { value: 'small', label: 'Nhỏ hơn dự kiến' },
          { value: 'true_to_size', label: 'Đúng kích thước' },
          { value: 'large', label: 'Lớn hơn dự kiến' },
        ]} />
      </label>
      <Input.TextArea
        value={form.comment}
        onChange={(event) => setForm((current) => current ? { ...current, comment: event.target.value } : current)}
        maxLength={2000}
        showCount
        autoSize={{ minRows: 3, maxRows: 6 }}
        placeholder="Sản phẩm có đúng mô tả không?"
      />
      <div>
        <span>Ảnh hiện tại (bỏ chọn để xóa)</span>
        <Image.PreviewGroup>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {review.images.length === 0 && <small>Chưa có ảnh.</small>}
            {review.images.map((image) => (
              <span key={image._id ?? image.url} style={{ position: 'relative', opacity: image._id && form.keepImageIds.includes(image._id) ? 1 : 0.35, cursor: 'pointer' }} onClick={() => image._id && toggleKeep(image._id)}>
                <Image src={image.thumbnailUrl || image.url} preview={{ src: image.url }} width={64} height={64} alt="Ảnh đánh giá" />
              </span>
            ))}
          </div>
        </Image.PreviewGroup>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Thêm ảnh mới (tối đa {5 - form.keepImageIds.length} ảnh, 5MB/ảnh)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={form.keepImageIds.length + form.newImages.length >= 5}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length) onPickImages(files)
            event.target.value = ''
          }}
        />
      </label>
      {imagePreviews.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {imagePreviews.map(({ file, url }) => (
            <span key={`${file.name}-${file.lastModified}`} style={{ position: 'relative' }}>
              <img src={url} alt={file.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4 }} />
              <button type="button" onClick={() => setForm((current) => current ? { ...current, newImages: current.newImages.filter((item) => item !== file) } : current)} style={{ position: 'absolute', top: -6, right: -6, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  </Modal>
}