/** The current Harness keeps volatile scalars in stable references. Older Hosts
 * supply ordinary values. Keep references at the boundary and read a snapshot
 * for each operation so Loader updates are visible without a plugin restart.
 */
export interface ConfigReference<T> {
  get(): T
}

export type ConfigInput<T extends object> = {
  [K in keyof T]: T[K] | ConfigReference<T[K]>
}

// Official cosmokit protocol, shared across its ESM/CJS copies. Do not import
// isVolatile from an external peer: older Harness builds do not export it.
const volatileWrite = Symbol.for('cosmokit.volatile.write')

export function readConfigValue(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && volatileWrite in value
    && 'get' in value && typeof value.get === 'function') {
    return value.get()
  }
  return value
}

/** Our Config fields are scalars; this never descends into arbitrary objects. */
export function readConfigSnapshot<T extends object>(input: ConfigInput<T>): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, readConfigValue(value)])) as T
}
