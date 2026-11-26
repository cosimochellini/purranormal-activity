import { IconBrandTelegram, IconCheck, IconX } from '@tabler/icons-react'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { useSound } from '@/hooks/useSound'
import { notifyLog } from '@/start/services/logs'
import type { TelegramIdResponse } from '@/types/api/telegram-id'
import { secretErrorMessage } from '@/utils/secret'
import { SpookyButton } from './SpookyButton'
import { SpookyInput } from './SpookyInput'
import { SpookyModal } from './SpookyModal'

interface SendNotificationButtonProps {
  logId: number
}

/**
 * Telegram fan-out for one log. Gated on the secret, so the button opens a
 * modal that asks for it first and then shows the outcome in place.
 */
export function SendNotificationButton({ logId }: SendNotificationButtonProps) {
  const sendNotification = useServerFn(notifyLog)
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [secret, setSecret] = useState('')
  const [secretError, setSecretError] = useState('')
  const [response, setResponse] = useState<TelegramIdResponse | null>(null)

  const { play: playMagicSound } = useSound('/sounds/magic.mp3', { volume: 0.6 })

  const openModal = () => {
    setResponse(null)
    setSecretError('')
    setShowModal(true)
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSecretError('')

    try {
      const res = await sendNotification({ data: { id: logId, secret } })
      setResponse(res)
      if (res.success) playMagicSound()
    } catch (error) {
      const message = secretErrorMessage(error)
      if (message) {
        setSecretError(message)
      } else {
        setResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send notification',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const title = !response
    ? 'Send Notification'
    : response.success
      ? 'Notification Sent!'
      : 'Notification Failed'

  return (
    <>
      <SpookyButton
        onClick={openModal}
        variant="secondary"
        className="flex items-center gap-1.5 px-4 py-2 text-sm"
      >
        <div className="flex items-center gap-1.5">
          Send Notification
          <IconBrandTelegram className="h-4 w-4" />
        </div>
      </SpookyButton>

      <SpookyModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={title}
        className="max-w-sm sm:max-w-md"
      >
        {!response ? (
          <form onSubmit={handleSend} className="space-y-4">
            <SpookyInput
              id="notification-secret"
              label="Secret"
              type="password"
              autoComplete="current-password"
              value={secret}
              error={secretError || undefined}
              onChange={(e) => {
                setSecret(e.target.value)
                setSecretError('')
              }}
            />
            <div className="flex justify-end">
              <SpookyButton type="submit" isLoading={isLoading} disabled={isLoading}>
                Send
              </SpookyButton>
            </div>
          </form>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-center">
              {response?.success ? (
                <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-green-500/20 rounded-full">
                  <IconCheck className="h-6 w-6 sm:h-8 sm:w-8 text-green-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-red-500/20 rounded-full">
                  <IconX className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
                </div>
              )}
            </div>

            <div className="text-center space-y-1.5 sm:space-y-2 px-2">
              {response?.success ? (
                <>
                  <p className="text-green-300 font-medium text-sm sm:text-base leading-snug">
                    🎉 Your paranormal event has been successfully shared!
                  </p>
                  <p className="text-purple-200/70 text-xs sm:text-sm">
                    Message ID: {response.messageId}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-red-300 font-medium text-sm sm:text-base leading-snug">
                    😿 Something went wrong with the notification
                  </p>
                  <p className="text-purple-200/70 text-xs sm:text-sm break-words">
                    {response?.error || 'Unknown error occurred'}
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-center pt-2 sm:pt-4">
              <SpookyButton
                onClick={() => setShowModal(false)}
                variant="primary"
                className="px-5 py-2 text-sm"
              >
                Close
              </SpookyButton>
            </div>
          </div>
        )}
      </SpookyModal>
    </>
  )
}
