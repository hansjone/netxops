/** Resolve the npm bundled with Node instead of an unrelated global npm shim. */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export function npmRuntime() {
  const node = process.versions.bun
    ? spawnSync('node', ['-p', 'process.execPath'], { encoding: 'utf8', windowsHide: true }).stdout.trim()
    : process.execPath
  const npm = [process.env.NETXOPS_NPM_CLI,
    join(dirname(node), 'node_modules/npm/bin/npm-cli.js'),
    resolve(dirname(node), '../lib/node_modules/npm/bin/npm-cli.js'),
  ].filter(Boolean).find(existsSync)
  assert.ok(npm, 'Node.js must include npm to build and test the public installation package.')
  return { node, npm }
}
