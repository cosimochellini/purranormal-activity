export interface TelegramApiResponse {
  /**
   * Whether the API call was successful
   */
  ok: boolean
  /**
   * Response data when successful
   */
  result?: {
    /**
     * The unique identifier of the sent message
     */
    message_id: number
  }
  /**
   * Error description when the API call fails
   */
  description?: string
}

/**
 * Result of a single-chat Telegram primitive call.
 */
export interface ChatResult {
  success: boolean
  messageId?: number
  error?: string
}

/**
 * @deprecated Used only by the transitional `services/notification.ts` shim;
 * removed once the route is cut over to the Notifier.
 */
export interface SendEventNotificationResult {
  success: boolean
  messageId?: number
  error?: string
}

export interface SendMessageOptions {
  /**
   * Message parsing mode: HTML, MarkdownV2, or Markdown. Defaults to 'HTML'
   */
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  /**
   * Disables link previews for links in this message. Defaults to true
   */
  disableWebPagePreview?: boolean
  /**
   * Sends the message silently (users will receive a notification with no sound). Defaults to false
   */
  silent?: boolean
}

export interface SendMessageBody {
  /**
   * Unique identifier for the target chat or username of the target channel
   */
  chat_id: string | number
  /**
   * Text of the message to be sent, 1-4096 characters after entities parsing
   */
  text: string
  /**
   * Mode for parsing entities in the message text
   */
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  /**
   * A JSON-serialized list of special entities that appear in message text
   */
  entities?: Array<{
    type: string
    offset: number
    length: number
    url?: string
    user?: object
    language?: string
  }>
  /**
   * Disables link previews for links in this message
   */
  disable_web_page_preview?: boolean
  /**
   * Sends the message silently. Users will receive a notification with no sound
   */
  disable_notification?: boolean
  /**
   * Protects the contents of the sent message from forwarding and saving
   */
  protect_content?: boolean
  /**
   * If the message is a reply, ID of the original message
   */
  reply_to_message_id?: number
  /**
   * Pass True if the message should be sent even if the specified replied-to message is not found
   */
  allow_sending_without_reply?: boolean
  /**
   * Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user
   */
  reply_markup?: object
}

export interface MessageEntity {
  type: string
  offset: number
  length: number
  url?: string
  user?: object
  language?: string
}

export interface ReplyParameters {
  message_id: number
  chat_id?: string | number
  allow_sending_without_reply?: boolean
  quote?: string
  quote_parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  quote_entities?: MessageEntity[]
  quote_position?: number
}

export interface SuggestedPostParameters {
  text?: string
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  entities?: MessageEntity[]
}

export interface SendPhotoOptions {
  businessConnectionId?: string
  messageThreadId?: number
  directMessagesTopicId?: number
  caption?: string
  /**
   * Message parsing mode for caption: HTML, MarkdownV2, or Markdown. Defaults to 'MarkdownV2'
   */
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  captionEntities?: MessageEntity[]
  showCaptionAboveMedia?: boolean
  hasSpoiler?: boolean
  /**
   * Sends the message silently. Defaults to false
   */
  silent?: boolean
  protectContent?: boolean
  allowPaidBroadcast?: boolean
  messageEffectId?: string
  suggestedPostParameters?: SuggestedPostParameters
  replyParameters?: ReplyParameters
  replyMarkup?: object
  /**
   * @deprecated Use replyParameters instead
   */
  replyToMessageId?: number
}

export interface SendPhotoBody {
  business_connection_id?: string
  chat_id: string | number
  message_thread_id?: number
  direct_messages_topic_id?: number
  photo: string
  caption?: string
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  caption_entities?: MessageEntity[]
  show_caption_above_media?: boolean
  has_spoiler?: boolean
  disable_notification?: boolean
  protect_content?: boolean
  allow_paid_broadcast?: boolean
  message_effect_id?: string
  suggested_post_parameters?: SuggestedPostParameters
  reply_parameters?: ReplyParameters
  reply_markup?: object
  /**
   * @deprecated Use reply_parameters instead
   */
  reply_to_message_id?: number
}
