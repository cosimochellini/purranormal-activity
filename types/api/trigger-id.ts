export type TriggerIdResponse =
  | {
      success: true
    }
  | {
      success: false
      error: string
    }
