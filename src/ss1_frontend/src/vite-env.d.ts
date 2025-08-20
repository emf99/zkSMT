// Vite environment types
interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string
  readonly CANISTER_ID?: string
  readonly CANISTER_ID_SS1_BACKEND?: string
  readonly CANISTER_ID_SS1_FRONTEND?: string
  readonly DFX_NETWORK?: string
  readonly DFX_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
