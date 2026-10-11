export type Batch = { ids: readonly string[]; expanded: boolean }
export type Batches = Record<string, Batch>
export type CallToBatch = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    'collapse-tool-use': {
      batches: Batches
      callToBatch: CallToBatch
      isEnabled: boolean
    }
  }
}
