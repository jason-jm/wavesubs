import { createContext, useContext, useEffect, useState } from 'react'
import type { ModelMoveProgress } from '../../../shared/types'

const Context = createContext<{ moving: boolean; progress: ModelMoveProgress | null; start: () => void; finish: () => void } | null>(null)

export function ModelWorkProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [moving, setMoving] = useState(false)
  const [progress, setProgress] = useState<ModelMoveProgress | null>(null)
  useEffect(() => window.waveSubs.onModelMove(setProgress), [])
  return <Context.Provider value={{ moving, progress,
    start: () => { setProgress(null); setMoving(true) }, finish: () => setMoving(false) }}>{children}</Context.Provider>
}

export function useModelWork(): NonNullable<React.ContextType<typeof Context>> {
  const work = useContext(Context)
  if (!work) throw new Error('ModelWorkProvider is required')
  return work
}
