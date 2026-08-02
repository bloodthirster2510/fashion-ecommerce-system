import type { CatalogCategory, ProductListQuery } from '../catalog.types'

type CatalogHeroProps = {
  categories: CatalogCategory[]
  query: ProductListQuery
}

const getCategoryId = (category?: string | { _id: string } | null) => {
  if (!category) return null
  return typeof category === 'string' ? category : category._id
}

const buildAncestors = (category: CatalogCategory, categoriesById: Map<string, CatalogCategory>) => {
  const ancestors: CatalogCategory[] = []
  let current: CatalogCategory | undefined = category

  while (current) {
    ancestors.unshift(current)
    const parentId = getCategoryId(current.parent_id)
    current = parentId ? categoriesById.get(parentId) : undefined
  }

  return ancestors
}

const getFallbackGenderCategory = (categories: CatalogCategory[], gender?: ProductListQuery['gender']) => {
  if (!gender) return undefined

  return categories
    .filter((category) => category.gender === gender && !getCategoryId(category.parent_id))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'vi'))[0]
}

const resolveHeroData = (categories: CatalogCategory[], query: ProductListQuery) => {
  const categoriesById = new Map(categories.map((category) => [category._id, category]))
  const selectedCategory = query.categoryId
    ? categoriesById.get(query.categoryId)
    : getFallbackGenderCategory(categories, query.gender)

  if (!selectedCategory) {
    return null
  }

  const ancestors = buildAncestors(selectedCategory, categoriesById)
  const imageCategory =
    [...ancestors].reverse().find((category) => category.image) ?? selectedCategory
  const image = imageCategory.image

  if (!image) {
    return null
  }

  return {
    image,
    title: selectedCategory.name,
    breadcrumbItems: ['Trang chủ', ...ancestors.map((category) => category.name)],
  }
}

export function CatalogHero({ categories, query }: CatalogHeroProps) {
  const heroData = resolveHeroData(categories, query)

  if (!heroData) {
    return null
  }

  return (
    <section className="catalog-hero" aria-labelledby="catalog-hero-title">
      <nav className="catalog-breadcrumb" aria-label="Đường dẫn danh mục">
        {heroData.breadcrumbItems.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </nav>

      <figure className="catalog-hero-banner">
        <img src={heroData.image} alt={heroData.title} />
      </figure>
      <h1 id="catalog-hero-title" className="catalog-hero-title">
        {heroData.title}
      </h1>
    </section>
  )
}
