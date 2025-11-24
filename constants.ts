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
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: 'Title is too long',
  DESCRIPTION_REQUIRED: 'Description is required',
  DESCRIPTION_TOO_LONG: 'Description is too long',
  CATEGORIES_REQUIRED: 'Categories are required',
  ANSWERS_TOO_MANY: 'At least 5 follow-up answers are required',
  CATEGORY_REQUIRED: 'At least one category is required',
} as const
