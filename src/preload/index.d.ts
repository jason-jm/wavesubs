import type { WaveSubsApi } from './index'

declare global {
  interface Window {
    waveSubs: WaveSubsApi
  }
}

export {}
