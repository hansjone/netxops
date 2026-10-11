/**
 * Shared settings-form face used by the Plugins card.
 *
 * DSH ≤0.1.5 exposes `ctx.settingsScope.bind({ namespace })`.
 * DSH ≥0.1.7 / 0.2.0 exposes `ctx.configForms.get(entryId)`.
 * Snapshot + set/unset/subscribe shapes match, so the card stays agnostic.
 */

export interface SettingsFormSnapshot<T> {
  status: string
  value?: T
  base?: unknown
  user?: unknown
  revision?: number
  writable: boolean
  mode?: string
}

export interface SettingsFormScope<T> {
  getSnapshot(): SettingsFormSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean | void>
  unset(field: string): Promise<boolean | void>
}

/** Read-only placeholder until an actual Host settings namespace is served. */
export function createWaitingSettingsScope<T>(initial: T): SettingsFormScope<T> {
  const snapshot: SettingsFormSnapshot<T> = { status: 'loading', value: initial, writable: false }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => { throw new Error('settings_transport_unavailable') },
    unset: async () => { throw new Error('settings_transport_unavailable') },
  }
}

/** get() may return a placeholder for any id; only a served namespace is usable. */
export function findReadySettingsForm<T>(
  forms: { get?: (id: string) => SettingsFormScope<T> },
  namespaces: readonly string[],
): { ns: string; scope: SettingsFormScope<T> } | undefined {
  if (!forms.get) return undefined
  for (const ns of namespaces) {
    try {
      const scope = forms.get(ns)
      if (scope?.getSnapshot().status === 'ready') return { ns, scope }
    } catch { /* Wrong namespace or service not ready; keep trying. */ }
  }
  return undefined
}
