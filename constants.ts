/**
 * Application-wide constants for validation, limits, and UI configuration
 */

// Character limits for form validations
export const CHARACTER_LIMITS = {
  /** Maximum characters for log titles */
  TITLE: 100,
  /** Maximum characters for log descriptions */
  DESCRIPTION: 1000,
  /** Maximum characters for refinement descriptions */
  REFINEMENT_DESCRIPTION: 10000,
  /** Maximum characters for questions in prompts */
  QUESTION: 90,
  /** Maximum characters for answers in prompts */
  ANSWER: 120,
  /** Maximum characters for generated titles */
  GENERATED_TITLE: 60,
  /** Maximum characters for generated descriptions */
  GENERATED_DESCRIPTION: 550,
  /** Maximum characters for image prompts */
  IMAGE_PROMPT: 200,
  /** Maximum characters for telegram description */
  TELEGRAM_DESCRIPTION: 500,
  /** Maximum characters for telegram link text */
  TELEGRAM_LINK: 100,
} as const

// Array limits
export const ARRAY_LIMITS = {
  /** Maximum number of follow-up answers */
  MAX_ANSWERS: 5,
  /** Minimum required items for arrays */
  MIN_REQUIRED: 1,
  /** Maximum number of questions in prompts */
  MAX_QUESTIONS: 5,
  /** Maximum number of categories to select */
  MAX_CATEGORIES: 4,
} as const

// UI configuration
export const UI_CONFIG = {
  /** Default textarea rows for initial log form */
  TEXTAREA_ROWS_SMALL: 4,
  /** Default textarea rows for edit forms */
  TEXTAREA_ROWS_LARGE: 6,
  /** Progress calculation duration in seconds */
  PROGRESS_DURATION_SECONDS: 40,
  /** Maximum percentage value */
  MAX_PERCENTAGE: 100,
} as const

// Validation messages
export const VALIDATION_MESSAGES = {
  TITLE_REQUIRED: 'Please provide a title for your paranormal event',
  TITLE_TOO_LONG: `Title must be ${CHARACTER_LIMITS.TITLE} characters or less`,
  DESCRIPTION_REQUIRED: 'Please describe what mystical event occurred',
  DESCRIPTION_TOO_LONG: `Description must be ${CHARACTER_LIMITS.DESCRIPTION} characters or less`,
  DESCRIPTION_TOO_SHORT: 'Please provide more details about the mystical event',
  DESCRIPTION_REFINEMENT_TOO_LONG: `Description must be ${CHARACTER_LIMITS.REFINEMENT_DESCRIPTION} characters or less`,
  CATEGORIES_REQUIRED: 'Please select at least one category for this event',
  ANSWERS_TOO_MANY: `You can provide up to ${ARRAY_LIMITS.MAX_ANSWERS} answers`,
  CATEGORY_REQUIRED: 'At least one category must be selected',
  SECRET_INVALID: 'The secret password is incorrect. Please check and try again.',
  SECRET_REQUIRED: 'Secret password is required to submit this event',
} as const
