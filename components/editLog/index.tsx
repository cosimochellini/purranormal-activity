import { IconRefresh } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import type { ChangeEvent, FormEvent } from 'react'
import { Suspense, useRef, useState } from 'react'
import { SpookyButton } from '@/components/common/SpookyButton'
import { EventImage } from '@/components/events/EventImage'
import { UI_CONFIG } from '@/constants'
import type { LogWithCategories } from '@/db/schema'
import { usePartialState } from '@/hooks/state'
import type { LogIdDeleteResponse, LogIdPutBody, LogIdPutResponse } from '@/types/api/log-id'
import type { UploadIdResponse } from '@/types/api/upload-id'
import { fetcher } from '@/utils/fetch'
import { transitions } from '@/utils/viewTransition'
import { SpookyInput } from '../common/SpookyInput'
import { SpookyTextarea } from '../common/SpookyTextarea'
import { CategorySelector, CategorySelectorSkeleton } from './CategorySelector'

interface Secret {
  secret: string
}

const updateLog = fetcher<LogIdPutResponse, never, LogIdPutBody>('/api/log/[id]', 'PUT')
const deleteLog = fetcher<LogIdDeleteResponse, never, Secret>('/api/log/[id]', 'DELETE')
const uploadImage = fetcher<UploadIdResponse, never, FormData>('/api/upload/[id]', 'POST')

interface UpdateImageButtonProps {
  id: number
}

function UpdateImageButton({ id }: UpdateImageButtonProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const data = await uploadImage({
        params: { id },
        body: formData,
      })

      if (!data.success) {
        const errors = Object.values(data.errors ?? {}).flat()
        setError(errors[0] ?? 'Failed to upload image')
        return
      }

      await navigate({
        to: '/$id',
        params: { id: `${id}` },
        viewTransition: true,
      })

      setError('')
    } catch (err) {
      console.error('Failed to upload image:', err)
      setError('Failed to upload image')
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="absolute bottom-1 right-1 bg-purple-900/80 backdrop-blur-xs rounded-full p-1.5
          border border-purple-400/30 shadow-lg transform transition-all duration-300
          hover:scale-110 group/tooltip"
        type="button"
        aria-label="Update image"
      >
        <IconRefresh
          className={classNames('w-4 h-4 text-purple-200', { 'animate-spin': isLoading })}
        />
      </button>

      {error && <div className="rounded-md bg-red-900/30 p-4 text-red-200">{error}</div>}
    </>
  )
}

interface EditLogFormProps {
  initialData: LogWithCategories
}

export function EditLogForm({ initialData }: EditLogFormProps) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = usePartialState({ form: false, delete: false })
  const [error, setError] = useState('')
  const [formData, setFormData] = usePartialState(() => ({ ...initialData, secret: '' }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting({ form: true })
    setError('')

    try {
      const response = await updateLog({
        body: formData,
        params: { id: initialData.id },
      })

      if (!response.success) {
        const errors = Object.values(response.errors ?? {}).flat()
        setError(errors[0] ?? 'Failed to update')
        return
      }

      await navigate({
        to: '/$id',
        params: { id: `${initialData.id}` },
        viewTransition: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSubmitting({ delete: false, form: false })
    }
  }

  const handleDelete = async () => {
    setSubmitting({ delete: true })

    setError('')

    try {
      const response = await deleteLog({
        params: { id: initialData.id },
        body: formData,
      })

      if (!response.success) {
        const errors = Object.values(response.errors ?? {}).flat()
        setError(errors[0] ?? response.error ?? 'Failed to update')
        return
      }

      await navigate({ to: '/', viewTransition: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting({ delete: false, form: false })
    }
  }

  const styles = transitions(initialData.id)

  return (
    <>
      <div className="relative group">
        <EventImage
          log={initialData}
          className="pb-8"
          width={200}
          height={200}
          style={styles.image}
        />
        <UpdateImageButton id={initialData.id} />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6 p-4">
        {error && <div className="rounded-md bg-red-900/30 p-4 text-red-200">{error}</div>}

        {initialData.error && (
          <div className="rounded-md bg-red-900/30 p-4 text-red-200">
            <h3 className="mb-2 font-bold">Generation Error:</h3>
            <p className="text-sm">{initialData.error}</p>
          </div>
        )}

        <div className="space-y-2">
          <SpookyInput
            id="title"
            placeholder="Title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ title: e.target.value })}
            className="w-full rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
            style={styles.title}
          />
        </div>

        <div className="space-y-2">
          <SpookyTextarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ description: e.target.value })}
            rows={UI_CONFIG.TEXTAREA_ROWS_LARGE}
            className="w-full min-h-[150px] rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
            style={styles.description}
          />
        </div>

        <div className="space-y-2">
          <SpookyTextarea
            id="imageDescription"
            placeholder="Image Description"
            value={formData.imageDescription ?? ''}
            onChange={(e) => setFormData({ imageDescription: e.target.value })}
            rows={UI_CONFIG.TEXTAREA_ROWS_LARGE}
            className="w-full min-h-[150px] rounded-md border border-purple-700/30 bg-purple-900/30 px-4 py-2 text-white placeholder-purple-300/50 focus:border-purple-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <Suspense fallback={<CategorySelectorSkeleton />}>
          <CategorySelector
            selected={formData.categories}
            styles={styles.categories}
            onChange={(categories) => setFormData({ categories })}
          />
        </Suspense>

        <div className="space-y-2">
          <SpookyInput
            id="secret"
            placeholder="Secret"
            type="password"
            value={formData.secret}
            onChange={(e) => setFormData({ secret: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-4">
          <SpookyButton
            type="button"
            onClick={handleDelete}
            variant="danger"
            disabled={submitting.delete}
            isLoading={submitting.delete}
          >
            Delete
          </SpookyButton>
          <SpookyButton type="submit" disabled={submitting.form} isLoading={submitting.form}>
            Save Changes
          </SpookyButton>
        </div>
      </form>
    </>
  )
}
