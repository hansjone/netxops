/**
 * Minimal snapshot store for the Plugins card.
 *
 * Shipped DSH web (`@deepseek-ai/dsh` ≤0.1.1-rc.2) seeds only react / cordis /
 * ui-slots / ui-primitives — not `@deepseek-ai/dsh-client-store`. Keep this
 * private so the client bundle does not require that package.
 */

export interface SnapshotStore<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
  set: (next: T) => void
}

/**
 * Create a synchronous snapshot store (same-tick notify for controlled inputs).
 * @param init - initial snapshot.
 * @returns the store.
 */
export function createSnapshotStore<T>(init: T): SnapshotStore<T> {
  let state = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      state = next
      for (const listener of [...listeners]) listener()
    },
  }
}
