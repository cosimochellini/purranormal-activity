export type TelegramIdResponse =
  | {
      success: true
      messageId: number
    }
  | {
      success: false
      error: string
    }
