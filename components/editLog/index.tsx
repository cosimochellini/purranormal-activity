import { IconRefresh } from '@tabler/icons-react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import classNames from 'classnames'
import type { ChangeEvent, FormEvent } from 'react'
import { Suspense, useRef, useState } from 'react'
import { SpookyButton } from '@/components/common/SpookyButton'
import { EventImage } from '@/components/events/EventImage'
import { UI_CONFIG, UPLOAD_LIMITS } from '@/constants'
import type { LogWithCategories } from '@/db/schema'
import { usePartialState } from '@/hooks/state'
import {
  deleteLog as deleteLogFn,
  updateLog as updateLogFn,
  uploadCover,
} from '@/start/services/logs'
import { invalidateTags } from '@/utils/invalidation'
import { logger } from '@/utils/logger'
import { secretErrorMessage } from '@/utils/secret'
import { transitions } from '@/utils/viewTransition'
import { SpookyInput } from '../common/SpookyInput'
import { SpookyTextarea } from '../common/SpookyTextarea'
import { CategorySelector, CategorySelectorSkeleton } from './CategorySelector'

interface UpdateImageButtonProps {
  id: number
  // The upload writes to R2 *and* flips the row to `ImageGenerated`, which
  // takes it out of the cron sweeper's reach — so it is gated like every other
  // write, and the form has to hand its secret over.
  secret: string
  onSecretError: (message: string) => void
}

function UpdateImageButton({ id, secret, onSecretError }: UpdateImageButtonProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const uploadImage = useServerFn(uploadCover)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const handleClick = () => {
    // The secret field sits at the bottom of the form, below this button, so
    // an empty secret is the common mistake: catch it before opening the picker.
    if (!secret.trim()) {
      setError('Enter the secret first')
      return
    }
    setError('')
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > UPLOAD_LIMITS.MAX_BYTES) {
      setError('File is too large (max 5 MB)')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('id', String(id))
      formData.append('file', file)
      formData.append('secret', secret)

      const data = await uploadImage({ data: formData })

      if (!data.success) {
        setError(data.error)
        return
      }

      await invalidateTags(router, ['logs', `log:${id}`])
      await navigate({
        to: '/$id',
        params: { id: `${id}` },
        viewTransition: true,
      })

      setError('')
    } catch (err) {
      const secretError = secretErrorMessage(err)
      if (secretError) {
        onSecretError(secretError)
      } else {
        logger.error('Failed to upload image:', err)
        setError('Failed to upload image')
      }
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
  const router = useRouter()
  const updateLog = useServerFn(updateLogFn)
  const deleteLog = useServerFn(deleteLogFn)
  const [submitting, setSubmitting] = usePartialState({ form: false, delete: false })
  const [error, setError] = useState('')
  const [secretError, setSecretError] = useState('')
  const [formData, setFormData] = usePartialState(() => ({ ...initialData, secret: '' }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting({ form: true })
    setError('')
    setSecretError('')

    try {
      const { id, title, description, categories, imageDescription, secret } = formData
      const response = await updateLog({
        data: { id, title, description, categories, imageDescription, secret },
      })

      if (!response.success) {
        const errors = Object.values(response.errors ?? {}).flat()
        setError(errors[0] ?? 'Failed to update')
        return
      }

      await invalidateTags(router, ['logs', `log:${initialData.id}`])
      await navigate({
        to: '/$id',
        params: { id: `${initialData.id}` },
        viewTransition: true,
      })
    } catch (err) {
      const message = secretErrorMessage(err)
      if (message) setSecretError(message)
      else setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSubmitting({ form: false })
    }
  }

  const handleDelete = async () => {
    setSubmitting({ delete: true })
    setError('')
    setSecretError('')

    try {
      const response = await deleteLog({
        data: { id: initialData.id, secret: formData.secret },
      })

      if (!response.success) {
        setError(response.error)
        return
      }

      // Not `log:<id>`: that would re-run this page's loader on a deleted row
      // and flash the 404 before the navigation lands.
      await invalidateTags(router, ['logs'])
      await navigate({ to: '/', viewTransition: true })
    } catch (err) {
      const message = secretErrorMessage(err)
      if (message) setSecretError(message)
      else setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSubmitting({ delete: false })
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
        <UpdateImageButton
          id={initialData.id}
          secret={formData.secret}
          onSecretError={setSecretError}
        />
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
            error={secretError || undefined}
            onChange={(e) => {
              setFormData({ secret: e.target.value })
              setSecretError('')
            }}
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
