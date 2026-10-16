/**
 * Convert netx MCP `inputSchema` (standard JSON Schema) into the DSH value
 * schema DSL accepted by `defineTool({ parameters })`.
 *
 * The DSL is a strict subset: nodes allow only type / enum / const /
 * properties / additionalProperties / items / oneOf plus annotations, and
 * `required` is a per-property `true`. Range and size constraints
 * (`minimum`, `maxItems`, ...) are folded into the description so the model
 * still sees them; netx validates arguments server-side anyway.
 */

type Json = Record<string, unknown>

const ANNOTATIONS = ['description', 'title', 'default', 'examples'] as const
const SCALAR_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'null'])
const CONSTRAINTS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minItems',
  'maxItems',
  'uniqueItems',
] as const

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withAnnotations(source: Json, target: Json): Json {
  for (const key of ANNOTATIONS) {
    if (Object.hasOwn(source, key)) target[key] = source[key]
  }
  const notes = CONSTRAINTS.filter(key => Object.hasOwn(source, key)).map(key => `${key}=${JSON.stringify(source[key])}`)
  if (notes.length > 0) {
    const base = typeof target.description === 'string' ? target.description : ''
    target.description = `${base}${base ? ' ' : ''}(${notes.join(', ')})`
  }
  return target
}

/** Branches of anyOf / oneOf / a type array, minus `null` (nullable = optional here). */
function variants(node: Json): Json[] | undefined {
  const list = Array.isArray(node.oneOf) ? node.oneOf : Array.isArray(node.anyOf) ? node.anyOf : undefined
  if (list) return list.filter(isRecord).filter(branch => branch.type !== 'null')
  if (Array.isArray(node.type)) {
    const { type: _types, ...rest } = node
    return node.type.filter(t => t !== 'null').map(t => ({ ...rest, type: t }))
  }
  return undefined
}

function toValue(node: unknown): Json {
  if (!isRecord(node)) return { type: 'json' }
  const branches = variants(node)
  if (branches) {
    if (branches.length === 0) return withAnnotations(node, { type: 'json' })
    if (branches.length === 1) return withAnnotations(node, toValue({ ...branches[0] }))
    return withAnnotations(node, { oneOf: branches.map(toValue) })
  }
  const type = node.type
  if (type === 'object' || (type === undefined && isRecord(node.properties))) {
    const out: Json = {
      type: 'object',
      additionalProperties: typeof node.additionalProperties === 'boolean' ? node.additionalProperties : true,
    }
    if (isRecord(node.properties)) out.properties = toProperties(node.properties, node.required)
    return withAnnotations(node, out)
  }
  if (type === 'array') {
    const out: Json = { type: 'array' }
    if (Object.hasOwn(node, 'items')) out.items = toValue(node.items)
    return withAnnotations(node, out)
  }
  if (typeof type === 'string' && SCALAR_TYPES.has(type)) {
    const out: Json = { type }
    if (Array.isArray(node.enum) && node.enum.length > 0) out.enum = node.enum
    if (Object.hasOwn(node, 'const')) out.const = node.const
    return withAnnotations(node, out)
  }
  return withAnnotations(node, { type: 'json' })
}

function toProperties(properties: Json, required: unknown): Json {
  const requiredSet = new Set(Array.isArray(required) ? required.filter(k => typeof k === 'string') : [])
  const out: Json = {}
  for (const [key, value] of Object.entries(properties)) {
    const converted = toValue(value)
    if (requiredSet.has(key)) converted.required = true
    out[key] = converted
  }
  return out
}

/** `defineTool` parameters (a property map) from an MCP tool `inputSchema`. */
export function parametersFromInputSchema(schema: unknown): Json {
  if (!isRecord(schema) || !isRecord(schema.properties)) return {}
  return toProperties(schema.properties, schema.required)
}
