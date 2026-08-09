import { Button } from 'antd'
import type { VisualSearchResponse } from '../catalog.types'

type VisualSearchResultHeaderProps = {
  result: VisualSearchResponse
  previewUrl?: string
  imageName?: string
  queryText?: string
  onClear: () => void
}

// Khối tóm tắt kết quả sau khi người dùng tìm sản phẩm bằng ảnh hoặc mô tả.
export function VisualSearchResultHeader({
  result,
  previewUrl,
  imageName,
  queryText,
  onClear,
}: VisualSearchResultHeaderProps) {
  const isTextSearch = result.query.searchType === 'text'

  return (
    <section
      className={`visual-search-result-header${isTextSearch ? ' visual-search-result-header--text' : ''}`}
      aria-label={isTextSearch ? 'Kết quả tìm kiếm bằng mô tả' : 'Kết quả tìm kiếm bằng hình ảnh'}
    >
      {!isTextSearch && previewUrl && <img src={previewUrl} alt={imageName || 'Ảnh truy vấn'} />}

      <div>
        <span>{isTextSearch ? 'Tìm kiếm bằng mô tả' : 'Tìm kiếm bằng hình ảnh'}</span>
        <strong>{isTextSearch ? queryText || imageName || 'Mô tả sản phẩm' : 'Kết quả sản phẩm tương tự'}</strong>
      </div>

      <Button onClick={onClear}>Quay lại danh mục</Button>
    </section>
  )
}
