#!/usr/bin/env node

import * as utils from '#session-file-utils'

const options = utils.defaults({
  path: process.argv[2],
  ttl: process.argv[3]
})

if (options.path) {
  options.log('Deleting expired sessions')
  utils.reap(options)
} else {
  options.log('Reap worker started with invalid path')
  process.exit(1)
}
