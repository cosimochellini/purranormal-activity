import { useState } from 'react'

export function usePartialState<T>(initialState: T) {
  const [state, setState] = useState(initialState)
  const updateState = (update: Partial<T>) => setState(prev => ({ ...prev, ...update }))
  return [state, updateState] as const
}
