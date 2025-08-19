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

export interface SendMessageOptions {
  /**
   * Message parsing mode: HTML, MarkdownV2, or Markdown. Defaults to 'MarkdownV2'
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
  /**
   * Array of chat IDs to send the message to. Defaults to TELEGRAM_BOT_CHAT_IDS
   */
  chatIds?: string[]
}

export interface SendMessageInput {
  /**
   * The text content of the message to send
   */
  text: string
  /**
   * Optional configuration for the message
   */
  options?: SendMessageOptions
}

export interface SendMessageResult {
  /**
   * Whether the operation was successful (true if at least one message was sent)
   */
  success: boolean
  /**
   * Array of message IDs for successfully sent messages
   */
  messageIds?: number[]
  /**
   * Error message if the operation failed completely
   */
  error?: string
}

export interface SendEventNotificationResult {
  /**
   * Whether the notification was sent successfully
   */
  success: boolean
  /**
   * The message ID of the last sent message (for backward compatibility)
   */
  messageId?: number
  /**
   * Error message if the operation failed
   */
  error?: string
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
  /**
   * Type of the entity
   */
  type: string
  /**
   * Offset in UTF-16 code units to the start of the entity
   */
  offset: number
  /**
   * Length of the entity in UTF-16 code units
   */
  length: number
  /**
   * For "text_link" only, URL that will be opened after user taps on the text
   */
  url?: string
  /**
   * For "text_mention" only, the mentioned user
   */
  user?: object
  /**
   * For "pre" only, the programming language of the entity text
   */
  language?: string
}

export interface ReplyParameters {
  /**
   * Identifier of the message that will be replied to in the current chat, or in the chat chat_id if it is specified
   */
  message_id: number
  /**
   * If the message to be replied to is from a different chat, unique identifier for the chat or username of the channel (in the format @channelusername)
   */
  chat_id?: string | number
  /**
   * Pass True if the message should be sent even if the specified message to be replied to is not found; can be used only for replies in the same chat
   */
  allow_sending_without_reply?: boolean
  /**
   * Quoted part of the message to be replied to; 0-1024 characters after entities parsing. The quote must be an exact substring of the message to be replied to, including bold, italic, underline, strikethrough, spoiler, and custom_emoji entities. The message will fail to send if the quote isn't found in the original message.
   */
  quote?: string
  /**
   * Mode for parsing entities in the quote. See formatting options for more details.
   */
  quote_parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  /**
   * A JSON-serialized list of special entities that appear in the quote. It can be specified instead of quote_parse_mode.
   */
  quote_entities?: MessageEntity[]
  /**
   * Position of the quote in the original message in UTF-16 code units
   */
  quote_position?: number
}

export interface SuggestedPostParameters {
  /**
   * The text of the suggested post
   */
  text?: string
  /**
   * Mode for parsing entities in the suggested post text
   */
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  /**
   * A JSON-serialized list of special entities that appear in the suggested post text
   */
  entities?: MessageEntity[]
}

export interface SendPhotoOptions {
  /**
   * Unique identifier of the business connection on behalf of which the message will be sent
   */
  businessConnectionId?: string
  /**
   * Unique identifier for the target message thread (topic) of the forum; for forum supergroups only
   */
  messageThreadId?: number
  /**
   * Identifier of the direct messages topic to which the message will be sent; required if the message is sent to a direct messages chat
   */
  directMessagesTopicId?: number
  /**
   * Photo caption (0-1024 characters after entities parsing)
   */
  caption?: string
  /**
   * Message parsing mode for caption: HTML, MarkdownV2, or Markdown
   */
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  /**
   * A JSON-serialized list of special entities that appear in the caption
   */
  captionEntities?: MessageEntity[]
  /**
   * Pass True, if the caption must be shown above the message media
   */
  showCaptionAboveMedia?: boolean
  /**
   * Pass True if the photo needs to be covered with a spoiler animation
   */
  hasSpoiler?: boolean
  /**
   * Sends the message silently (users will receive a notification with no sound). Defaults to false
   */
  silent?: boolean
  /**
   * Protects the contents of the sent message from forwarding and saving
   */
  protectContent?: boolean
  /**
   * Pass True to allow up to 1000 messages per second, ignoring broadcasting limits for a fee of 0.1 Telegram Stars per message
   */
  allowPaidBroadcast?: boolean
  /**
   * Unique identifier of the message effect to be added to the message; for private chats only
   */
  messageEffectId?: string
  /**
   * A JSON-serialized object containing the parameters of the suggested post to send; for direct messages chats only
   */
  suggestedPostParameters?: SuggestedPostParameters
  /**
   * Description of the message to reply to
   */
  replyParameters?: ReplyParameters
  /**
   * Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove a reply keyboard or to force a reply from the user
   */
  replyMarkup?: object
  /**
   * Array of chat IDs to send the photo to. Defaults to TELEGRAM_BOT_CHAT_IDS
   */
  chatIds?: string[]
  /**
   * @deprecated Use replyParameters instead
   * If the message is a reply, ID of the original message
   */
  replyToMessageId?: number
}

export interface SendPhotoInput {
  /**
   * Photo to send. Can be a file_id, file path, or URL
   */
  photo: string
  /**
   * Optional configuration for the photo message
   */
  options?: SendPhotoOptions
}

export interface SendPhotoResult {
  /**
   * Whether the operation was successful (true if at least one photo was sent)
   */
  success: boolean
  /**
   * Array of message IDs for successfully sent photos
   */
  messageIds?: number[]
  /**
   * Error message if the operation failed completely
   */
  error?: string
}

export interface SendPhotoBody {
  /**
   * Unique identifier of the business connection on behalf of which the message will be sent
   */
  business_connection_id?: string
  /**
   * Unique identifier for the target chat or username of the target channel
   */
  chat_id: string | number
  /**
   * Unique identifier for the target message thread (topic) of the forum; for forum supergroups only
   */
  message_thread_id?: number
  /**
   * Identifier of the direct messages topic to which the message will be sent; required if the message is sent to a direct messages chat
   */
  direct_messages_topic_id?: number
  /**
   * Photo to send. Can be a file_id as String to resend a photo, file path, or URL
   */
  photo: string
  /**
   * Photo caption (0-1024 characters after entities parsing)
   */
  caption?: string
  /**
   * Mode for parsing entities in the photo caption
   */
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  /**
   * A JSON-serialized list of special entities that appear in the caption
   */
  caption_entities?: MessageEntity[]
  /**
   * Pass True, if the caption must be shown above the message media
   */
  show_caption_above_media?: boolean
  /**
   * Pass True if the photo needs to be covered with a spoiler animation
   */
  has_spoiler?: boolean
  /**
   * Sends the message silently. Users will receive a notification with no sound
   */
  disable_notification?: boolean
  /**
   * Protects the contents of the sent message from forwarding and saving
   */
  protect_content?: boolean
  /**
   * Pass True to allow up to 1000 messages per second, ignoring broadcasting limits for a fee of 0.1 Telegram Stars per message
   */
  allow_paid_broadcast?: boolean
  /**
   * Unique identifier of the message effect to be added to the message; for private chats only
   */
  message_effect_id?: string
  /**
   * A JSON-serialized object containing the parameters of the suggested post to send; for direct messages chats only
   */
  suggested_post_parameters?: SuggestedPostParameters
  /**
   * Description of the message to reply to
   */
  reply_parameters?: ReplyParameters
  /**
   * Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove a reply keyboard or to force a reply from the user
   */
  reply_markup?: object
  /**
   * @deprecated Use reply_parameters instead
   * If the message is a reply, ID of the original message
   */
  reply_to_message_id?: number
}
