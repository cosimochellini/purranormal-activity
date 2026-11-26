/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VALIDATION_MESSAGES } from '@/constants'

const { updateLog, deleteLog, uploadCover, invalidateTags, router, navigate } = vi.hoisted(() => ({
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
  uploadCover: vi.fn(),
  invalidateTags: vi.fn(),
  router: { invalidate: vi.fn() },
  navigate: vi.fn(),
}))

vi.mock('@/start/services/logs', () => ({ updateLog, deleteLog, uploadCover }))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('@/utils/invalidation', () => ({ invalidateTags }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  useRouter: () => router,
}))

// Stub heavy children
vi.mock('@/components/events/EventImage', () => ({
  EventImage: () => <div data-testid="event-image" />,
}))
vi.mock('@/components/editLog/CategorySelector', () => ({
  CategorySelector: () => <div data-testid="category-selector" />,
  CategorySelectorSkeleton: () => <div data-testid="category-skeleton" />,
}))

import { EditLogForm } from '@/components/editLog'

const initialData = {
  id: 1,
  title: 'Title',
  description: 'desc',
  imageDescription: 'img desc',
  status: 'created',
  error: null,
  createdAt: 0,
  updatedAt: 0,
  categories: [],
}

beforeEach(() => {
  for (const fn of [updateLog, deleteLog, uploadCover, invalidateTags, navigate]) fn.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('EditLogForm — Bug #8 regression', () => {
  it('delete failure resets only submitting.delete, not submitting.form', async () => {
    // Form is in-flight (slow promise) so submitting.form = true
    let resolveUpdate: (v: unknown) => void = () => {}
    updateLog.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        }),
    )

    // Delete fails immediately
    deleteLog.mockRejectedValueOnce(new Error('delete failed'))

    const { container } = render(<EditLogForm initialData={initialData as never} />)

    const findDeleteBtn = () => screen.getByRole('button', { name: /Delete/i })
    const findSaveSubmitBtn = () =>
      container.querySelector('button[type="submit"]') as HTMLButtonElement

    // Submit form → submitting.form becomes true (kept due to pending update)
    fireEvent.click(findSaveSubmitBtn())

    await waitFor(() => {
      expect(updateLog).toHaveBeenCalled()
    })

    // Click Delete → submitting.delete becomes true → fails → finally resets ONLY delete
    fireEvent.click(findDeleteBtn())

    // Wait for delete handler to settle
    await waitFor(() => {
      expect(deleteLog).toHaveBeenCalled()
    })

    // After delete-fail finally: submitting.form must remain true (not reset).
    // The submit button should remain disabled (Loading state) while the update is pending.
    await waitFor(() => {
      expect(findSaveSubmitBtn()).toBeDisabled()
    })

    // The Delete button should be re-enabled (its own flag was reset).
    await waitFor(() => {
      expect(findDeleteBtn()).not.toBeDisabled()
    })

    // Cleanup pending update
    resolveUpdate({ success: true })
  })
})

describe('EditLogForm — cover upload', () => {
  const uploadBtn = () => screen.getByRole('button', { name: /Update image/i })
  const fileInput = (container: HTMLElement) =>
    container.querySelector('input[type="file"]') as HTMLInputElement
  const typeSecret = () =>
    fireEvent.change(screen.getByPlaceholderText('Secret'), { target: { value: 's3cret' } })
  const pickFile = (container: HTMLElement) =>
    fireEvent.change(fileInput(container), {
      target: { files: [new File(['x'], 'cover.png', { type: 'image/png' })] },
    })

  it('blocks the upload and asks for the secret when it is empty', () => {
    const { container } = render(<EditLogForm initialData={initialData as never} />)
    const click = vi.spyOn(fileInput(container), 'click')

    fireEvent.click(uploadBtn())

    expect(click).not.toHaveBeenCalled()
    expect(screen.getByText('Enter the secret first')).toBeInTheDocument()
  })

  it("shows the server's error text when the upload is rejected", async () => {
    uploadCover.mockResolvedValueOnce({ success: false, error: 'Invalid image' })
    const { container } = render(<EditLogForm initialData={initialData as never} />)

    typeSecret()
    pickFile(container)

    expect(await screen.findByText('Invalid image')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('uploads id, file and secret as FormData, then refreshes the log and opens it', async () => {
    uploadCover.mockResolvedValueOnce({ success: true })
    const { container } = render(<EditLogForm initialData={initialData as never} />)

    typeSecret()
    pickFile(container)

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/$id' }))
    })
    const { data } = uploadCover.mock.calls[0][0] as { data: FormData }
    expect(data).toBeInstanceOf(FormData)
    expect(data.get('id')).toBe('1')
    expect(data.get('secret')).toBe('s3cret')
    expect((data.get('file') as File).name).toBe('cover.png')
    expect(invalidateTags).toHaveBeenCalledWith(router, ['logs', 'log:1'])
  })

  it('renders a thrown SECRET_INVALID under the secret field', async () => {
    uploadCover.mockRejectedValueOnce(new Error(VALIDATION_MESSAGES.SECRET_INVALID))
    const { container } = render(<EditLogForm initialData={initialData as never} />)

    typeSecret()
    pickFile(container)

    const message = await screen.findByText(VALIDATION_MESSAGES.SECRET_INVALID)
    expect(message.previousElementSibling).toBe(screen.getByPlaceholderText('Secret'))
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('EditLogForm — update', () => {
  const save = (container: HTMLElement) =>
    fireEvent.click(container.querySelector('button[type="submit"]') as HTMLButtonElement)

  it('sends the edited fields plus the secret, then refreshes the log and opens it', async () => {
    updateLog.mockResolvedValueOnce({ success: true, data: { id: 1 } })
    const { container } = render(<EditLogForm initialData={initialData as never} />)

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New title' } })
    fireEvent.change(screen.getByPlaceholderText('Secret'), { target: { value: 's3cret' } })
    save(container)

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/$id' }))
    })
    expect(updateLog).toHaveBeenCalledWith({
      data: {
        id: 1,
        title: 'New title',
        description: 'desc',
        categories: [],
        imageDescription: 'img desc',
        secret: 's3cret',
      },
    })
    expect(invalidateTags).toHaveBeenCalledWith(router, ['logs', 'log:1'])
  })

  it('renders a thrown SECRET_INVALID under the secret field, not as a form error', async () => {
    updateLog.mockRejectedValueOnce(new Error(VALIDATION_MESSAGES.SECRET_INVALID))
    const { container } = render(<EditLogForm initialData={initialData as never} />)

    fireEvent.change(screen.getByPlaceholderText('Secret'), { target: { value: 'nope' } })
    save(container)

    const message = await screen.findByText(VALIDATION_MESSAGES.SECRET_INVALID)
    // SpookyInput renders its error as a sibling of the input.
    expect(message.previousElementSibling).toBe(screen.getByPlaceholderText('Secret'))
    expect(navigate).not.toHaveBeenCalled()
    expect(invalidateTags).not.toHaveBeenCalled()
  })

  it('shows the first field error when the update is rejected', async () => {
    updateLog.mockResolvedValueOnce({ success: false, errors: { title: ['Title is too short'] } })
    const { container } = render(<EditLogForm initialData={initialData as never} />)

    save(container)

    expect(await screen.findByText('Title is too short')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
