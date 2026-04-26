/**
 * Per-chat × per-asset diagnostics for a Telegram fan-out. Surfaced on the
 * failure arm so callers can retry only the missing piece (e.g., resend the
 * photo to the chats listed in `failedPhotoChats` instead of resending
 * everything to everyone).
 */
export interface TelegramIdPartial {
  /** Number of chats whose text message succeeded. */
  reachedChats: number
  /** Configured fan-out size. */
  totalChats: number
  /** Chats whose text succeeded but photo failed; safe target for a retry. */
  failedPhotoChats: string[]
}

export type TelegramIdResponse =
  | {
      success: true
      messageId: number
    }
  | {
      success: false
      error: string
      partial?: TelegramIdPartial
    }
