import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { invalidateLiveCatalogue } from '../../data/live'
import { useDocumentTitle } from '../../useDocumentTitle'
import {
  deleteCollection,
  getAdminCollection,
  listProductOptions,
  operatorsFor,
  previewCollection,
  RULE_FIELDS,
  saveCollection,
  uploadImage,
  type AdminCollection,
  type CollectionRules,
  type ProductStatus,
  type RuleCondition,
} from '../api'
import { money, number, slugify } from '../format'
import { useAsync, useDebounced } from '../hooks'
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
  IconExternal,
  IconImage,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from '../icons'

interface Draft {
  title: string
  handle: string
  description: string
  image_url: string
  seo_title: string
  seo_description: string
  status: ProductStatus
  is_automatic: boolean
  position: string
}

const blank: Draft = {
  title: '',
  handle: '',
  description: '',
  image_url: '',
  seo_title: '',
  seo_description: '',
  status: 'draft',
  is_automatic: false,
  position: '0',
}

const blankCondition = (): RuleCondition => ({ field: 'tag', operator: 'contains', value: '' })

const fieldType = (field: string) => RULE_FIELDS.find((option) => option.value === field)?.type ?? 'text'

export function CollectionEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const flash = (location.state as { flash?: string } | null)?.flash ?? null
  const editing = Boolean(id)
  const { data, loading, error, reload } = useAsync(async () => {
    const [products, collection] = await Promise.all([
      listProductOptions(),
      id ? getAdminCollection(id) : Promise.resolve(null),
    ])
    return { products, collection: collection as AdminCollection | null }
  }, [id])

  const [fields, setFields] = useState<Draft>(blank)
  const [rules, setRules] = useState<CollectionRules>({ match: 'all', conditions: [blankCondition()] })
  const [selected, setSelected] = useState<string[]>([])
  const [productSearch, setProductSearch] = useState('')
  const debounced = useDebounced(productSearch)
  const [previewRows, setPreviewRows] = useState<
    { product_id: string; title: string; handle: string; price: number; image_url: string; status: string }[] | null
  >(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(flash)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useDocumentTitle(`${editing ? data?.collection?.title ?? 'Collection' : 'New collection'} — HALA.S Admin`)

  useEffect(() => {
    const collection = data?.collection
    if (!collection) return
    setFields({
      title: collection.title,
      handle: collection.handle,
      description: collection.description ?? '',
      image_url: collection.image_url ?? '',
      seo_title: collection.seo_title ?? '',
      seo_description: collection.seo_description ?? '',
      status: collection.status,
      is_automatic: collection.is_automatic,
      position: String(collection.position ?? 0),
    })
    setRules(
      collection.rules && Array.isArray(collection.rules.conditions) && collection.rules.conditions.length
        ? collection.rules
        : { match: 'all', conditions: [blankCondition()] },
    )
    setSelected(
      [...(collection.collection_products ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((item) => item.product_id),
    )
  }, [data])

  const products = data?.products ?? []
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const availableProducts = useMemo(() => {
    const term = debounced.trim().toLowerCase()
    return products
      .filter((product) => !selected.includes(product.id))
      .filter((product) => !term || `${product.title} ${product.handle}`.toLowerCase().includes(term))
      .slice(0, 40)
  }, [products, selected, debounced])

  const selectedProducts = selected
    .map((productId) => productMap.get(productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setFields((current) => ({ ...current, [key]: value }))

  const setCondition = (index: number, patch: Partial<RuleCondition>) =>
    setRules((current) => ({
      ...current,
      conditions: current.conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)),
    }))

  const addCondition = () =>
    setRules((current) => ({ ...current, conditions: [...current.conditions, blankCondition()] }))

  const removeCondition = (index: number) =>
    setRules((current) => ({ ...current, conditions: current.conditions.filter((_, i) => i !== index) }))

  const moveSelected = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= selected.length) return
    setSelected((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
      setProblem('Use a JPEG, PNG, WebP or AVIF image.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setProblem('The image must be 8 MB or smaller.')
      return
    }
    setUploading(true)
    setProblem(null)
    try {
      const result = await uploadImage(file, 'collections')
      set('image_url', result.url)
      setNotice('Collection image uploaded. Save the collection to keep it.')
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The image could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  const runPreview = async () => {
    if (rules.conditions.length === 0) {
      setProblem('Add at least one rule before previewing.')
      return
    }
    setPreviewBusy(true)
    setProblem(null)
    try {
      const rows = await previewCollection(rules)
      setPreviewRows(rows)
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The preview could not be generated.')
    } finally {
      setPreviewBusy(false)
    }
  }

  const save = async () => {
    if (busy) return
    if (!fields.title.trim()) {
      setProblem('Add a collection title.')
      return
    }
    if (fields.is_automatic && rules.conditions.some((condition) => String(condition.value).trim() === '')) {
      setProblem('Every automatic rule needs a value.')
      return
    }
    if (fields.is_automatic && rules.conditions.length === 0) {
      setProblem('Add at least one automatic rule.')
      return
    }
    setBusy(true)
    setProblem(null)
    setNotice(null)
    try {
      const savedId = await saveCollection({
        collection: {
          id: id || undefined,
          title: fields.title.trim(),
          handle: fields.handle.trim() || slugify(fields.title),
          description: fields.description,
          image_url: fields.image_url,
          seo_title: fields.seo_title,
          seo_description: fields.seo_description,
          status: fields.status,
          is_automatic: fields.is_automatic,
          rules: fields.is_automatic ? rules : { match: 'all', conditions: [] },
          position: Number(fields.position) || 0,
        },
        productIds: fields.is_automatic ? [] : selected,
      })
      invalidateLiveCatalogue()
      if (!id) {
        navigate(`/admin/collections/${savedId}`, {
          replace: true,
          state: { flash: 'Collection created.' },
        })
        return
      }
      setNotice(fields.status === 'published' ? 'Collection saved and live on the storefront.' : 'Collection saved as a draft.')
      reload()
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The collection could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!id) return
    setBusy(true)
    try {
      await deleteCollection(id)
      invalidateLiveCatalogue()
      navigate('/admin/collections', { replace: true })
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : 'The collection could not be deleted.')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  if (editing && loading && !data) return <Spinner label="Loading collection" />
  if (editing && error) return <ErrorState message={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        eyebrow={editing ? 'Edit collection' : 'New collection'}
        title={editing ? fields.title || 'Collection' : 'Add a collection'}
        description="Published collections are added to the storefront automatically, including collection pages and navigation."
        actions={
          <>
            <Link className="admin-btn admin-btn--ghost admin-btn--small" to="/admin/collections">
              <IconArrowLeft /> Collections
            </Link>
            {editing && fields.status === 'published' && (
              <a className="admin-btn admin-btn--ghost admin-btn--small" href={`/collections/${fields.handle || slugify(fields.title)}`} target="_blank" rel="noreferrer">
                <IconExternal /> View live
              </a>
            )}
            <button type="button" className="admin-btn admin-btn--primary admin-btn--small" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save collection'}
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
          <Card title="Collection details">
            <div className="admin-form-grid">
              <Field label="Title">
                <input value={fields.title} onChange={(event) => set('title', event.target.value)} placeholder="The Occasion Edit" />
              </Field>
              <Field label="URL handle" hint="Leave blank to generate it from the title.">
                <input value={fields.handle} onChange={(event) => set('handle', event.target.value)} placeholder="the-occasion-edit" />
              </Field>
              <Field label="Description" className="is-span-2">
                <textarea rows={4} value={fields.description} onChange={(event) => set('description', event.target.value)} placeholder="A short editorial note for the collection page." />
              </Field>
              <Field label="SEO title" className="is-span-2">
                <input value={fields.seo_title} onChange={(event) => set('seo_title', event.target.value)} maxLength={70} />
              </Field>
              <Field label="SEO description" className="is-span-2">
                <textarea rows={2} value={fields.seo_description} onChange={(event) => set('seo_description', event.target.value)} maxLength={170} />
              </Field>
            </div>
          </Card>

          <Card title="Collection image" description="Shown on the collection page and in navigation where art direction allows.">
            <div className="collection-image-row">
              {fields.image_url ? (
                <div className="collection-image">
                  <img src={fields.image_url} alt={fields.title || 'Collection'} />
                  <button type="button" className="admin-btn admin-btn--danger-ghost admin-btn--small" onClick={() => set('image_url', '')}>
                    <IconTrash /> Remove
                  </button>
                </div>
              ) : (
                <label className="admin-dropzone admin-dropzone--small">
                  <IconImage />
                  <strong>{uploading ? 'Uploading…' : 'Upload a collection image'}</strong>
                  <span>JPEG, PNG, WebP or AVIF · up to 8 MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(event) => void upload(event.target.files?.[0])} />
                </label>
              )}
              <div style={{ flex: 1 }}>
                <Field label="Or use an image URL">
                  <input value={fields.image_url} onChange={(event) => set('image_url', event.target.value)} placeholder="https://…" />
                </Field>
                <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => set('image_url', '')}>
                  <IconUpload /> Clear image
                </button>
              </div>
            </div>
          </Card>

          <Card
            title="Products in this collection"
            description={
              fields.is_automatic
                ? 'Automatic collections ignore manual selection. Products are chosen by the rules below.'
                : 'Choose and order the pieces shown in this collection.'
            }
          >
            <Toggle
              checked={fields.is_automatic}
              onChange={(value) => {
                set('is_automatic', value)
                setPreviewRows(null)
              }}
              label="Automatic collection"
              description="Keep the collection current with tag, category, price or stock rules."
            />

            {fields.is_automatic ? (
              <div className="rules-builder">
                <div className="rules-builder__head">
                  <Field label="Match">
                    <select value={rules.match} onChange={(event) => setRules((current) => ({ ...current, match: event.target.value as 'all' | 'any' }))}>
                      <option value="all">All conditions (AND)</option>
                      <option value="any">Any condition (OR)</option>
                    </select>
                  </Field>
                  <div className="rules-builder__actions">
                    <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={addCondition}>
                      <IconPlus /> Add rule
                    </button>
                    <button type="button" className="admin-btn admin-btn--ghost admin-btn--small" onClick={() => void runPreview()} disabled={previewBusy}>
                      {previewBusy ? 'Previewing…' : 'Preview matches'}
                    </button>
                  </div>
                </div>

                {rules.conditions.map((condition, index) => {
                  const type = fieldType(condition.field)
                  return (
                    <div className="rule-row" key={index}>
                      <select
                        value={condition.field}
                        onChange={(event) => {
                          const nextType = fieldType(event.target.value)
                          const operator = nextType === 'number' ? 'gte' : 'equals'
                          setCondition(index, { field: event.target.value, operator, value: '' })
                        }}
                        aria-label={`Rule field ${index + 1}`}
                      >
                        {RULE_FIELDS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(event) => setCondition(index, { operator: event.target.value })}
                        aria-label={`Rule operator ${index + 1}`}
                      >
                        {operatorsFor(type).map((operator) => (
                          <option key={operator.value} value={operator.value}>
                            {operator.label}
                          </option>
                        ))}
                      </select>
                      {type === 'boolean' ? (
                        <select value={String(condition.value)} onChange={(event) => setCondition(index, { value: event.target.value })} aria-label={`Rule value ${index + 1}`}>
                          <option value="">Choose…</option>
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : type === 'status' ? (
                        <select value={String(condition.value)} onChange={(event) => setCondition(index, { value: event.target.value })} aria-label={`Rule value ${index + 1}`}>
                          <option value="">Choose…</option>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      ) : (
                        <input
                          value={String(condition.value)}
                          inputMode={type === 'number' ? 'decimal' : undefined}
                          onChange={(event) => setCondition(index, { value: event.target.value })}
                          placeholder={type === 'number' ? '0' : 'Value'}
                          aria-label={`Rule value ${index + 1}`}
                        />
                      )}
                      <button type="button" className="admin-icon-btn admin-icon-btn--danger" onClick={() => removeCondition(index)} aria-label="Remove rule">
                        <IconTrash />
                      </button>
                    </div>
                  )
                })}

                <div className="rules-preview">
                  <p className="admin-eyebrow">Preview · includes drafts and archived products</p>
                  {previewRows === null ? (
                    <p className="admin-muted">Run a preview to see which products currently match.</p>
                  ) : previewRows.length === 0 ? (
                    <p className="admin-muted">No products match these rules yet.</p>
                  ) : (
                    <>
                      <p className="admin-muted">{number(previewRows.length)} matching product(s)</p>
                      <div className="rules-preview__grid">
                        {previewRows.map((row) => (
                          <article key={row.product_id}>
                            {row.image_url ? <img src={row.image_url} alt="" /> : <span className="admin-thumb-fallback" />}
                            <div>
                              <strong>{row.title}</strong>
                              <small>{money(row.price)}</small>
                              <StatusBadge value={row.status} />
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="manual-picker">
                <div className="manual-picker__available">
                  <p className="admin-eyebrow">Add products</p>
                  <label className="admin-search">
                    <IconSearch />
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="Search products"
                      aria-label="Search products to add"
                    />
                  </label>
                  <div className="manual-picker__list">
                    {availableProducts.length === 0 ? (
                      <p className="admin-muted">No more products match.</p>
                    ) : (
                      availableProducts.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          className="manual-picker__item"
                          onClick={() => setSelected((current) => [...current, product.id])}
                        >
                          {product.image_url ? <img src={product.image_url} alt="" /> : <span className="admin-thumb-fallback" />}
                          <span>
                            <strong>{product.title}</strong>
                            <small>{money(product.price)} · {product.status}</small>
                          </span>
                          <IconPlus />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="manual-picker__selected">
                  <p className="admin-eyebrow">Selected · {selectedProducts.length}</p>
                  {selectedProducts.length === 0 ? (
                    <p className="admin-muted">No products selected yet.</p>
                  ) : (
                    selectedProducts.map((product, index) => (
                      <div className="manual-picker__chosen" key={product.id}>
                        {product.image_url ? <img src={product.image_url} alt="" /> : <span className="admin-thumb-fallback" />}
                        <span>
                          <strong>{product.title}</strong>
                          <small>{product.status}</small>
                        </span>
                        <div>
                          <button type="button" className="admin-icon-btn" onClick={() => moveSelected(index, -1)} disabled={index === 0} aria-label="Move up">
                            ↑
                          </button>
                          <button type="button" className="admin-icon-btn" onClick={() => moveSelected(index, 1)} disabled={index === selected.length - 1} aria-label="Move down">
                            ↓
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn admin-icon-btn--danger"
                            onClick={() => setSelected((current) => current.filter((id) => id !== product.id))}
                            aria-label={`Remove ${product.title}`}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
            <Field label="Position" hint="Lower numbers appear first in collection navigation.">
              <input inputMode="numeric" value={fields.position} onChange={(event) => set('position', event.target.value)} />
            </Field>
            <div className="editor-actions">
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create collection'}
              </button>
              {editing && (
                <button type="button" className="admin-btn admin-btn--danger-ghost" onClick={() => setConfirmDelete(true)}>
                  <IconTrash /> Delete collection
                </button>
              )}
            </div>
          </Card>

          <Card title="At a glance">
            <dl className="admin-summary-list">
              <div>
                <dt>Status</dt>
                <dd><StatusBadge value={fields.status} /></dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{fields.is_automatic ? 'Automatic' : 'Manual'}</dd>
              </div>
              <div>
                <dt>{fields.is_automatic ? 'Rules' : 'Products'}</dt>
                <dd>{fields.is_automatic ? number(rules.conditions.length) : number(selected.length)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this collection?"
        body={`“${fields.title}” will be removed from the storefront. The products themselves stay in the catalogue.`}
        confirmLabel="Delete collection"
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
