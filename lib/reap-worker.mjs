#!/usr/bin/env node

import * as helpers from './session-file-helpers.mjs'

const options = helpers.defaults({
  path: process.argv[2],
  ttl: process.argv[3]
})

if (options.path) {
  options.logFn('Deleting expired sessions')
  helpers.reap(options)
} else {
  options.logFn('Reap worker started with invalid path')
  process.exit(1)
}
