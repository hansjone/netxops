import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { parametersFromInputSchema } from '../src/netx/mcp-schema.ts'

const tools = JSON.parse(readFileSync(new URL('./fixtures-netx-mcp-tools.json', import.meta.url), 'utf8'))

function define(name, inputSchema) {
  return defineTool({
    name: `netx__${name}`,
    description: name,
    parameters: parametersFromInputSchema(inputSchema),
    output: { schema: { type: 'object', additionalProperties: true }, render: () => [] },
    async execute() {
      return {}
    },
  })
}

test('every real netx /mcp tool schema compiles in the DSH value schema DSL', () => {
  assert.ok(tools.length >= 39)
  for (const tool of tools) {
    assert.doesNotThrow(() => define(tool.name, tool.inputSchema), tool.name)
  }
})

test('required, constraints and nullable unions survive conversion', () => {
  const params = parametersFromInputSchema({
    type: 'object',
    required: ['ne_id'],
    properties: {
      ne_id: { type: 'string', description: 'NE id' },
      page: { type: 'integer', minimum: 1, maximum: 50, default: 1 },
      ids: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      filter: { type: 'object', required: ['k'], properties: { k: { type: 'string' } } },
      maybe: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      either: { type: ['string', 'integer'] },
    },
  })
  assert.equal(params.ne_id.required, true)
  assert.equal(params.page.required, undefined)
  assert.equal(params.page.minimum, undefined)
  assert.match(params.page.description, /minimum=1, maximum=50/)
  assert.match(params.ids.description, /maxItems=20/)
  assert.equal(params.filter.additionalProperties, true)
  assert.equal(params.filter.properties.k.required, true)
  assert.equal(params.maybe.type, 'string')
  assert.equal(params.either.oneOf.length, 2)
  assert.doesNotThrow(() => define('sample', { type: 'object', properties: params }))
})
