/// <reference types="vite/client" />

import type { FileHelperApi } from '@shared/api'

declare global {
  interface Window {
    api: FileHelperApi
  }
}

export {}
