import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { invalidateLiveCatalogue } from '../../data/live'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  deleteProduct,
  getAdminProduct,
  levelOf,
  removeImage,
  saveProduct,
  uploadImage,
  type AdminImage,
  type AdminProduct,
  type ProductStatus,
} from '../api'
import { money, number, slugify } from '../format'
import { useAsync } from '../hooks'
import {
  Card,
  ConfirmDialog,
  ErrorState,
  Field,
  Notice,
  PageHeader,
  Spinner,
  StatusBadge,
  Toggle,
} from '../ui'
import {
  IconArrowLeft,
  IconEye,
  IconImage,
  IconPlus,
  IconTrash,
  IconUpload,
} from '../icons'

interface Draft {
  title: string
  handle: string
  description: string
  fabric: string
  care: string
  brand: string
  vendor: string
  category: string
  product_type: string
  sku: string
  price: string
  compare_at_price: string
  cost_per_item: string
  tags: string
  search_keywords: string
  seo_title: string
  seo_description: string
  status: ProductStatus
  featured: boolean
  released_at: string
}

interface DraftImage {
  id?: string
  url: string
  storage_path: string | null
  alt: string
  is_primary: boolean
}

interface DraftVariant {
  id?: string
  size: string
  colour: string
  colour_hex: string
  sku: string
  price: string
  compare_at_price: string
  quantity: string
  low_stock_threshold: string
  is_active: boolean
}

const blank: Draft = {
  title: '',
  handle: '',
  description: '',
  fabric: '',
  care: '',
  brand: 'HALA.S',
  vendor: 'HALA.S',
  category: 'Dresses',
  product_type: '',
  sku: '',
  price: '',
  compare_at_price: '',
  cost_per_item: '',
  tags: '',
  search_keywords: '',
  seo_title: '',
  seo_description: '',
  status: 'draft',
  featured: false,
  released_at: '',
}

const blankVariant = (): DraftVariant => ({
  size: '',
  colour: '',
  colour_hex: '#c8b9a5',
  sku: '',
  price: '',
  compare_at_price: '',
  quantity: '0',
  low_stock_threshold: '',
  is_active: true,
})

const toDraft = (product: AdminProduct): Draft => ({
  title: product.title,
  handle: product.handle,
  description: product.description ?? '',
  fabric: product.fabric ?? '',
  care: product.care ?? '',
  brand: product.brand ?? 'HALA.S',
  vendor: product.vendor ?? 'HALA.S',
  category: product.category ?? '',
  product_type: product.product_type ?? '',
  sku: product.sku ?? '',
  price: String(product.price ?? ''),
  compare_at_price: product.compare_at_price == null ? '' : String(product.compare_at_price),
  cost_per_item: product.cost_per_item == null ? '' : String(product.cost_per_item),
  tags: (product.tags ?? []).join(', '),
  search_keywords: (product.search_keywords ?? []).join(', '),
  seo_title: product.seo_title ?? '',
  seo_description: product.seo_description ?? '',
  status: product.status,
  featured: Boolean(product.featured),
  released_at: product.released_at ? product.released_at.slice(0, 10) : '',
})

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const numeric = (value: string): number | null => {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ProductEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const flash = (location.state as { flash?: string } | null)?.flash ?? null
  const editing = Boolean(id)
  const { data, loading, error, reload } = useAsync(
    () => (id ? getAdminProduct(id) : Promise.resolve(null)),
    [id],
  )

  const [fields, setFields] = useState<Draft>(blank)
  const [images, setImages] = useState<DraftImage[]>([])
  const [variants, setVariants] = useState<DraftVariant[]>([])
  const [notice, setNotice] = useState<string | null>(flash)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useDocumentTitle(`${editing ? data?.title ?? 'Product' : 'New product'} — HALA.S Admin`)

  useEffect(() => {
    if (!data) return
    setFields(toDraft(data))
    setImages(
      (data.product_images ?? []).map((image: AdminImage) => ({
        id: image.id,
        url: image.url,
        storage_path: image.storage_path ?? null,
        alt: image.alt ?? '',
        is_primary: Boolean(image.is_primary),
      })),
    )
    setVariants(
      (data.product_variants ?? []).map((variant) => {
        const level = levelOf(variant)
        return {
          id: variant.id,
          size: variant.size ?? '',
          colour: variant.colour ?? '',
          colour_hex: variant.colour_hex || '#c8b9a5',
          sku: variant.sku ?? '',
          price: variant.price == null ? '' : String(variant.price),
          compare_at_price: variant.compare_at_price == null ? '' : String(variant.compare_at_price),
          quantity: String(level.quantity),
          low_stock_threshold: level.low_stock_threshold == null ? '' : String(level.low_stock_threshold),
          is_active: variant.is_active !== false,
        }
      }),
    )
  }, [data])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setFields((current) => ({ ...current, [key]: value }))

  const setVariant = (index: number, patch: Partial<DraftVariant>) =>
    setVariants((current) => current.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)))

  const primaryIndex = useMemo(() => {
    const index = images.findIndex((image) => image.is_primary)
    return index === -1 ? 0 : index
  }, [images])

  const totalStock = variants.reduce((total, variant) => total + (Number(variant.quantity) || 0), 0)
  const activeVariants = variants.filter((variant) => variant.is_active && (variant.size || variant.colour))
  const colourSummary = [...new Set(activeVariants.map((variant) => variant.colour).filter(Boolean))].join(' · ')
  const previewImage = images[primaryIndex]?.url || images[0]?.url

  const chooseFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setProblem(null)
    try {
      const uploaded: DraftImage[] = []
      for (const file of Array.from(files)) {
        if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
          throw new Error(`${file.name} is not a JPEG, PNG, WebP or AVIF image.`)
        }
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than 8 MB.`)
        }
        const result = await uploadImage(file, 'products')
        uploaded.push({ url: result.url, storage_path: result.path, alt: fields.title, is_primary: false })
      }
      setImages((current) => {
        const next = [...current, ...uploaded]
        if (!next.some((image) => image.is_primary)) next[0].is_primary = true
        return next
      })
      setNotice(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded. Save the product to keep them.`)
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The images could not be uploaded.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const addImageUrl = () => {
    const value = imageUrl.trim()
    if (!value) return
    if (!/^https?:\/\//i.test(value)) {
      setProblem('Enter a full image URL starting with https://')
      return
    }
    setImages((current) => {
      const next = [...current, { url: value, storage_path: null, alt: fields.title, is_primary: false }]
      if (!next.some((image) => image.is_primary)) next[0].is_primary = true
      return next
    })
    setImageUrl('')
  }

  const makePrimary = (index: number) =>
    setImages((current) => current.map((image, i) => ({ ...image, is_primary: i === index })))

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    setImages((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeImageAt = async (index: number) => {
    const image = images[index]
    setImages((current) => {
      const next = current.filter((_, i) => i !== index)
      if (next.length && !next.some((item) => item.is_primary)) next[0].is_primary = true
      return next
    })
    if (image?.storage_path) {
      try {
        await removeImage(image.storage_path)
      } catch {
        // The catalogue row is removed on save; an orphaned object is harmless.
      }
    }
  }

  const addVariant = () => setVariants((current) => [...current, blankVariant()])

  const addStandardSizes = () => {
    const colour = variants.find((variant) => variant.colour)?.colour ?? ''
    const hex = variants.find((variant) => variant.colour)?.colour_hex ?? '#c8b9a5'
    setVariants((current) => {
      const existing = new Set(current.map((variant) => variant.size.trim().toUpperCase()))
      const additions = ['XS', 'S', 'M', 'L', 'XL']
        .filter((size) => !existing.has(size))
        .map((size) => ({ ...blankVariant(), size, colour, colour_hex: hex }))
      return [...current, ...additions]
    })
  }

  const validate = (): string | null => {
    if (!fields.title.trim()) return 'Add a product title.'
    if (fields.price.trim() === '' || Number(fields.price) < 0) return 'Enter a valid regular price.'
    if (fields.status === 'published' && images.length === 0) return 'Add at least one product image before publishing.'
    if (images.length > 16) return 'A product can have at most 16 images.'
    if (fields.compare_at_price && Number(fields.compare_at_price) < 0) return 'The compare-at price cannot be negative.'
    if (fields.compare_at_price && Number(fields.compare_at_price) <= Number(fields.price))
      return 'The compare-at price should be higher than the selling price for a sale badge to show.'
    if (activeVariants.length === 0) return 'Add at least one active size or colour variant.'
    if (variants.some((variant) => variant.quantity !== '' && Number(variant.quantity) < 0))
      return 'Stock cannot be negative.'
    const seen = new Set<string>()
    for (const variant of variants.filter((item) => item.is_active)) {
      const key = `${variant.size.trim().toLowerCase()}::${variant.colour.trim().toLowerCase()}`
      if (!variant.size.trim() && !variant.colour.trim()) continue
      if (seen.has(key)) return 'Two active variants share the same size and colour.'
      seen.add(key)
    }
    return null
  }

  const save = async () => {
    if (busy) return
    const validation = validate()
    if (validation) {
      setProblem(validation)
      setNotice(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setBusy(true)
    setProblem(null)
    setNotice(null)
    try {
      const imagePayload = images.map((image, index) => ({
        url: image.url,
        storage_path: image.storage_path,
        alt: image.alt || fields.title,
        position: index,
        is_primary: index === primaryIndex,
      }))
      const variantPayload = variants.map((variant, index) => ({
        id: variant.id,
        size: variant.size.trim(),
        colour: variant.colour.trim(),
        colour_hex: variant.colour_hex,
        sku: variant.sku,
        price: numeric(variant.price),
        compare_at_price: numeric(variant.compare_at_price),
        quantity: Math.max(0, Math.floor(Number(variant.quantity) || 0)),
        low_stock_threshold: numeric(variant.low_stock_threshold),
        position: index,
        is_active: variant.is_active,
      }))
      const productPayload = {
        id: id || undefined,
        title: fields.title.trim(),
        handle: fields.handle.trim() || slugify(fields.title),
        description: fields.description,
        fabric: fields.fabric,
        care: fields.care,
        brand: fields.brand,
        vendor: fields.vendor,
        category: fields.category,
        product_type: fields.product_type,
        sku: fields.sku,
        price: Number(fields.price) || 0,
        compare_at_price: fields.compare_at_price === '' ? null : Number(fields.compare_at_price),
        cost_per_item: fields.cost_per_item === '' ? null : Number(fields.cost_per_item),
        tags: splitList(fields.tags),
        search_keywords: splitList(fields.search_keywords),
        seo_title: fields.seo_title,
        seo_description: fields.seo_description,
        status: fields.status,
        featured: fields.featured,
        released_at: fields.released_at || null,
      }

      const savedId = await saveProduct({
        product: productPayload,
        images: imagePayload,
        variants: variantPayload,
      })
      invalidateLiveCatalogue()
      if (!id) {
        navigate(`/admin/products/${savedId}`, {
          replace: true,
          state: { flash: fields.status === 'published' ? 'Product saved and published to the storefront.' : 'Product saved as a draft.' },
        })
        return
      }
      setNotice(fields.status === 'published' ? 'Product saved. The live storefront now reflects these changes.' : 'Product saved as a draft.')
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The product could not be saved.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  const removeProduct = async () => {
    if (!id) return
    setBusy(true)
    try {
      await deleteProduct(id)
      invalidateLiveCatalogue()
      navigate('/admin/products', { replace: true })
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The product could not be deleted.')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  if (editing && loading && !data) return <Spinner label="Loading product" />
  if (editing && error) return <ErrorState message={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        eyebrow={editing ? 'Edit product' : 'New product'}
        title={editing ? fields.title || 'Product' : 'Add a product'}
        description={
          editing
            ? 'Changes to published products appear on the storefront as soon as they are saved.'
            : 'Start with the details, add media and variants, then publish when it is ready.'
        }
        actions={
          <>
            <Link className="admin-btn admin-btn--ghost admin-btn--small" to="/admin/products">
              <IconArrowLeft /> Products
            </Link>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => setPreview(true)}>
              <IconEye /> Preview
            </button>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save product'}
            </button>
          </>
        }
      />

      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {problem && (
        <Notice tone="error" onDismiss={() => setProblem(null)}>
          {problem}
        </Notice>
      )}

      <div className="editor-grid">
        <div className="editor-grid__main">
          <Card title="Product details">
            <div className="admin-form-grid">
              <Field label="Title" className="is-span-2">
                <input value={fields.title} onChange={(event) => set('title', event.target.value)} placeholder="e.g. Noor silk slip dress" />
              </Field>
              <Field label="URL handle" hint="Leave blank to generate it from the title.">
                <input value={fields.handle} onChange={(event) => set('handle', event.target.value)} placeholder="noor-silk-slip-dress" />
              </Field>
              <Field label="SKU">
                <input value={fields.sku} onChange={(event) => set('sku', event.target.value)} placeholder="HLS-DR-001" />
              </Field>
              <Field label="Description" className="is-span-2">
                <textarea rows={5} value={fields.description} onChange={(event) => set('description', event.target.value)} placeholder="Fabric, fit, styling notes…" />
              </Field>
              <Field label="Fabric">
                <input value={fields.fabric} onChange={(event) => set('fabric', event.target.value)} placeholder="100% mulberry silk" />
              </Field>
              <Field label="Care">
                <input value={fields.care} onChange={(event) => set('care', event.target.value)} placeholder="Dry clean only" />
              </Field>
              <Field label="Category">
                <input value={fields.category} onChange={(event) => set('category', event.target.value)} placeholder="Dresses" list="halas-categories" />
                <datalist id="halas-categories">
                  <option value="Dresses" />
                  <option value="Ready to Wear" />
                  <option value="Co-Ord Sets" />
                </datalist>
              </Field>
              <Field label="Product type">
                <input value={fields.product_type} onChange={(event) => set('product_type', event.target.value)} placeholder="Slip dress" />
              </Field>
              <Field label="Vendor">
                <input value={fields.vendor} onChange={(event) => set('vendor', event.target.value)} />
              </Field>
              <Field label="Brand">
                <input value={fields.brand} onChange={(event) => set('brand', event.target.value)} />
              </Field>
              <Field label="Tags" hint="Comma separated. Used by search and automatic collections." className="is-span-2">
                <input value={fields.tags} onChange={(event) => set('tags', event.target.value)} placeholder="silk, occasion, new-in" />
              </Field>
              <Field label="Search keywords" hint="Extra terms shoppers might search for." className="is-span-2">
                <input value={fields.search_keywords} onChange={(event) => set('search_keywords', event.target.value)} placeholder="evening dress, wedding guest" />
              </Field>
            </div>
          </Card>

          <Card
            title="Media"
            description="The first image is the main image. Product pages show the first two images on hover."
            actions={
              <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => fileInput.current?.click()} disabled={uploading}>
                <IconUpload /> {uploading ? 'Uploading…' : 'Upload images'}
              </button>
            }
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              hidden
              onChange={(event) => void chooseFiles(event.target.files)}
            />
            {images.length === 0 ? (
              <button type="button" className="admin-dropzone" onClick={() => fileInput.current?.click()}>
                <IconImage />
                <strong>Upload product photography</strong>
                <span>JPEG, PNG, WebP or AVIF · up to 8 MB each</span>
              </button>
            ) : (
              <div className="admin-images">
                {images.map((image, index) => (
                  <article className={`admin-image ${index === primaryIndex ? 'is-primary' : ''}`.trim()} key={`${image.url}-${index}`}>
                    <div className="admin-image__thumb">
                      <img src={image.url} alt={image.alt || fields.title} />
                      {index === primaryIndex && <span className="admin-image__flag">Main</span>}
                    </div>
                    <input
                      value={image.alt}
                      onChange={(event) =>
                        setImages((current) => current.map((item, i) => (i === index ? { ...item, alt: event.target.value } : item)))
                      }
                      placeholder="Alt text for accessibility"
                      aria-label="Image alt text"
                    />
                    <div className="admin-image__actions">
                      <button type="button" className="admin-btn admin-btn--ghost admin-btn--tiny" onClick={() => moveImage(index, -1)} disabled={index === 0}>
                        ↑
                      </button>
                      <button type="button" className="admin-btn admin-btn--ghost admin-btn--tiny" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1}>
                        ↓
                      </button>
                      {index !== primaryIndex && (
                        <button type="button" className="admin-link" onClick={() => makePrimary(index)}>
                          Make main
                        </button>
                      )}
                      <button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => void removeImageAt(index)} aria-label="Remove image">
                        <IconTrash />
                      </button>
                    </div>
                  </article>
                ))}
                <button type="button" className="admin-image-add" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  <IconPlus /> Add more
                </button>
              </div>
            )}
            <div className="admin-image-url">
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="Or paste a hosted image URL (https://…)"
                aria-label="Image URL"
              />
              <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={addImageUrl}>
                Add URL
              </button>
            </div>
          </Card>

          <Card title="Variants & inventory" description="Each size/colour pair is a variant with its own stock. The storefront shows a size only when stock is available.">
            <div className="admin-toolbar admin-toolbar--inset">
              <div className="admin-toolbar__right">
                <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={addStandardSizes}>
                  Add XS–XL
                </button>
                <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={addVariant}>
                  <IconPlus /> Add variant
                </button>
              </div>
            </div>
            {variants.length === 0 ? (
              <p className="admin-muted">No variants yet. Add sizes above so the product can be sold.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-table--variants">
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Colour</th>
                      <th>Swatch</th>
                      <th>SKU</th>
                      <th className="is-right">Price override</th>
                      <th className="is-right">Stock</th>
                      <th className="is-right">Low at</th>
                      <th>Active</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant, index) => (
                      <tr key={variant.id ?? index}>
                        <td>
                          <input className="admin-input admin-input--cell" value={variant.size} onChange={(event) => setVariant(index, { size: event.target.value })} placeholder="M" aria-label={`Size ${index + 1}`} />
                        </td>
                        <td>
                          <input className="admin-input admin-input--cell" value={variant.colour} onChange={(event) => setVariant(index, { colour: event.target.value })} placeholder="Ivory" aria-label={`Colour ${index + 1}`} />
                        </td>
                        <td>
                          <input type="color" className="admin-color" value={variant.colour_hex} onChange={(event) => setVariant(index, { colour_hex: event.target.value })} aria-label={`Colour swatch ${index + 1}`} />
                        </td>
                        <td>
                          <input className="admin-input admin-input--cell" value={variant.sku} onChange={(event) => setVariant(index, { sku: event.target.value })} placeholder="HLS-DR-001-M" aria-label={`SKU ${index + 1}`} />
                        </td>
                        <td>
                          <input className="admin-input admin-input--cell is-right" inputMode="decimal" value={variant.price} onChange={(event) => setVariant(index, { price: event.target.value })} placeholder="—" aria-label={`Price override ${index + 1}`} />
                        </td>
                        <td>
                          <input className="admin-input admin-input--cell is-right" inputMode="numeric" value={variant.quantity} onChange={(event) => setVariant(index, { quantity: event.target.value })} aria-label={`Stock ${index + 1}`} />
                        </td>
                        <td>
                          <input className="admin-input admin-input--cell is-right" inputMode="numeric" value={variant.low_stock_threshold} onChange={(event) => setVariant(index, { low_stock_threshold: event.target.value })} placeholder="—" aria-label={`Low stock threshold ${index + 1}`} />
                        </td>
                        <td>
                          <input type="checkbox" checked={variant.is_active} onChange={(event) => setVariant(index, { is_active: event.target.checked })} aria-label={`Variant ${index + 1} active`} />
                        </td>
                        <td>
                          <button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => setVariants((current) => current.filter((_, i) => i !== index))} aria-label="Remove variant">
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="admin-muted" style={{ marginTop: '0.8rem' }}>
              Stock edits made here are recorded in the inventory movement history. Existing reservations for open orders are protected.
            </p>
          </Card>

          <Card title="Search engine listing" description="Used by search engines and social previews. Defaults to the product details when left blank.">
            <div className="admin-form-grid">
              <Field label="SEO title" className="is-span-2">
                <input value={fields.seo_title} onChange={(event) => set('seo_title', event.target.value)} maxLength={70} placeholder="Noor silk slip dress — HALA.S" />
              </Field>
              <Field label="SEO description" className="is-span-2">
                <textarea rows={3} value={fields.seo_description} onChange={(event) => set('seo_description', event.target.value)} maxLength={170} placeholder="A bias-cut silk slip in ivory, cut in Lahore." />
              </Field>
            </div>
          </Card>
        </div>

        <aside className="editor-grid__aside">
          <Card title="Publishing">
            <Field label="Status">
              <select value={fields.status} onChange={(event) => set('status', event.target.value as ProductStatus)}>
                <option value="draft">Draft — private</option>
                <option value="published">Published — live on storefront</option>
                <option value="archived">Archived — hidden</option>
              </select>
            </Field>
            <Field label="Release date" hint="Used by 'New in' automatic collections.">
              <input type="date" value={fields.released_at} onChange={(event) => set('released_at', event.target.value)} />
            </Field>
            <Toggle
              checked={fields.featured}
              onChange={(value) => set('featured', value)}
              label="Feature this piece"
              description="Eligible for featured placements."
            />
            <div className="editor-actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
              </button>
              {editing && (
                <button type="button" className="admin-btn admin-btn--danger-ghost" onClick={() => setConfirmDelete(true)}>
                  <IconTrash /> Delete product
                </button>
              )}
            </div>
          </Card>

          <Card title="Pricing">
            <Field label="Regular price (PKR)">
              <input inputMode="decimal" value={fields.price} onChange={(event) => set('price', event.target.value)} placeholder="0" />
            </Field>
            <Field label="Compare-at price" hint="Shown struck through when higher than the price.">
              <input inputMode="decimal" value={fields.compare_at_price} onChange={(event) => set('compare_at_price', event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Cost per item" hint="Private; never shown on the storefront.">
              <input inputMode="decimal" value={fields.cost_per_item} onChange={(event) => set('cost_per_item', event.target.value)} placeholder="Optional" />
            </Field>
          </Card>

          <Card title="At a glance">
            <dl className="admin-summary-list">
              <div>
                <dt>Status</dt>
                <dd><StatusBadge value={fields.status} /></dd>
              </div>
              <div>
                <dt>Active variants</dt>
                <dd>{number(activeVariants.length)}</dd>
              </div>
              <div>
                <dt>Total on hand</dt>
                <dd>{number(totalStock)}</dd>
              </div>
              <div>
                <dt>Images</dt>
                <dd>{number(images.length)}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{fields.price ? money(Number(fields.price)) : '—'}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      <Card title="Storefront preview" description="A private preview of how this piece reads. Publish when you are ready for it to go live.">
        <div className="product-preview">
          <div className="product-preview__media">
            {previewImage ? <img src={previewImage} alt={images[primaryIndex]?.alt || fields.title} /> : <span className="admin-thumb-fallback" />}
          </div>
          <div>
            <p className="admin-eyebrow">{fields.category || 'Collection'}</p>
            <h3>{fields.title || 'Untitled piece'}</h3>
            <p className="admin-muted">{colourSummary || 'One colourway'}</p>
            <p className="product-preview__price">
              {fields.price ? money(Number(fields.price)) : '—'}
              {fields.compare_at_price ? <s>{money(Number(fields.compare_at_price))}</s> : null}
            </p>
            <p>{fields.description || 'Add a description to tell the story of this piece.'}</p>
            <div className="product-preview__sizes">
              {activeVariants.length === 0 ? (
                <span className="admin-muted">No sizes yet</span>
              ) : (
                [...new Set(activeVariants.map((variant) => variant.size).filter(Boolean))].map((size) => (
                  <span key={size} className={Number(variants.find((variant) => variant.size === size)?.quantity) > 0 ? '' : 'is-out'}>
                    {size}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      {preview && (
        <div className="admin-preview-overlay" role="dialog" aria-modal="true" aria-label="Product preview" onClick={() => setPreview(false)}>
          <div className="admin-preview-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="admin-preview-sheet__head">
              <div>
                <p className="admin-eyebrow">Storefront preview · not public</p>
                <h2>{fields.title || 'Untitled piece'}</h2>
              </div>
              <div>
                <StatusBadge value={fields.status} />
                <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => setPreview(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="pdp-preview">
              <div className="pdp-preview__gallery">
                {images.length === 0 ? (
                  <span className="admin-thumb-fallback" />
                ) : (
                  images.map((image, index) => <img key={`${image.url}-${index}`} src={image.url} alt={image.alt || fields.title} />)
                )}
              </div>
              <div>
                <p className="admin-eyebrow">{fields.fabric || 'HALA.S CLOTHING'}</p>
                <h1>{fields.title || 'Untitled piece'}</h1>
                <p className="product-preview__price">
                  {fields.price ? money(Number(fields.price)) : '—'}
                  {fields.compare_at_price ? <s>{money(Number(fields.compare_at_price))}</s> : null}
                </p>
                <p>{fields.description || 'No description yet.'}</p>
                <div className="product-preview__sizes">
                  {activeVariants.length === 0 ? (
                    <span className="admin-muted">No sizes yet</span>
                  ) : (
                    [...new Set(activeVariants.map((variant) => variant.size).filter(Boolean))].map((size) => (
                      <span key={size} className={Number(variants.find((variant) => variant.size === size)?.quantity) > 0 ? '' : 'is-out'}>
                        {size}
                      </span>
                    ))
                  )}
                </div>
                <p className="admin-muted">{fields.care}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this product?"
        body="The product, its images and variants will be permanently removed. Past orders keep their recorded item details."
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={() => void removeProduct()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
