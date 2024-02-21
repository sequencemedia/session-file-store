import {
  normalize,
  join
} from 'node:path'
import childProcess from 'node:child_process'
import debug from 'debug'
import fs from 'fs-extra'
import writeFileAtomic from 'write-file-atomic'
import retry from 'retry'
import Bagpipe from 'bagpipe'
import kruptein from 'kruptein'
import WHEREAMI from '#where-am-i'

const isWindows = process.platform === 'win32'

const log = debug('@sequencemedia/session-file-store')

export const DEFAULTS = {
  path: './sessions',
  ttl: 3600,
  retries: 5,
  factor: 1,
  minTimeout: 50,
  maxTimeout: 100,
  reapInterval: 3600,
  reapMaxConcurrent: 10,
  reapAsync: false,
  reapSyncFallback: false,
  log,
  encoding: 'utf8',
  encoder: JSON.stringify,
  decoder: JSON.parse,
  encryptEncoding: 'hex',
  fileExtension: '.json',
  crypto: {
    algorithm: 'aes-256-gcm',
    hashing: 'sha512',
    use_scrypt: true
  },
  keyFunction (secret, sessionId) {
    return secret + sessionId
  }
}

export function defaults (options = {}) {
  const delta = Object.assign({}, DEFAULTS, options)

  delta.path = normalize(delta.path)
  delta.filePattern = getFilePatternFromFileExtension(delta.fileExtension)

  if (isSecret(delta.secret)) {
    delta.kruptein = kruptein(delta.crypto)
  }

  return delta
}

export function isSecret (secret) {
  return Boolean(secret ?? false)
}

export function isExpired (session, options) {
  if (!session) return true

  const ttl = session.cookie && session.cookie.originalMaxAge ? session.cookie.originalMaxAge : options.ttl * 1000
  return (!ttl) || ((getLastAccess(session) + ttl) < new Date().getTime())
}

export function sessionPath (options, sessionId) {
  return join(options.path, sessionId + options.fileExtension) // return join(basepath, sessionId + '.json');
}

export function sessionId (options, file) {
  // return file.substring(0, file.lastIndexOf('.json'));
  if (options.fileExtension.length === 0) return file
  const id = file.replace(options.filePattern, '')
  return id === file ? '' : id
}

export function getLastAccess (session) {
  return session.__lastAccess
}

export function setLastAccess (session) {
  session.__lastAccess = new Date().getTime()
}

export function escapeForRegExp (v) {
  return v.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
}

export function getFilePatternFromFileExtension (fileExtension) {
  return new RegExp(escapeForRegExp(fileExtension) + '$')
}

export function destroyExpired (sessionId, options, done = () => {}) {
  expired(sessionId, options, (err, expired) => {
    if ((!err) && expired) {
      destroy(sessionId, options, done)
    } else {
      return (
        err ? done(err) : done()
      )
    }
  })
}

export function scheduleReap (options) {
  if (options.reapInterval !== -1) {
    options.reapIntervalObject = setInterval(() => {
      if (options.reapAsync) {
        options.log('Starting reap worker')
        asyncReap(options)
      } else {
        options.log('Deleting expired sessions')
        reap(options)
      }
    }, options.reapInterval * 1000).unref()
  }
}

export function asyncReap (options, done = () => {}) {
  function execDone (err) {
    if (err && options.reapSyncFallback) {
      reap(options, done)
    } else {
      return (
        err ? done(err) : done()
      )
    }
  }

  if (isWindows) {
    childProcess.execFile('node', [join(WHEREAMI, './lib/reap-worker.mjs'), options.path, options.ttl], execDone)
  } else {
    childProcess.execFile(join(WHEREAMI, './lib/reap-worker.mjs'), [options.path, options.ttl], execDone)
  }
}

export function reap (options, done = () => {}) {
  list(options, (err, files) => {
    if (err) return done(err)
    if (files.length === 0) return done()

    const bagpipe = new Bagpipe(options.reapMaxConcurrent)

    const errors = []
    const n = files.length - 1

    files
      .forEach((file, i) => {
        bagpipe.push(destroyExpired,
          sessionId(options, file),
          options,
          (err) => {
            if (err) {
              errors.push(err)
            }

            if (i === n) {
              return (
                errors.length ? done(errors) : done()
              )
            }
          })
      })
  })
}

/**
 * Attempts to fetch session from a session file by the given `sessionId`
 *
 * @param {String} sessionId
 * @param {Object} options
 * @param {Function} done
 *
 * @api public
 */
export function get (sessionId, options, done = () => {}) {
  const filePath = sessionPath(options, sessionId)

  const operation = retry.operation({
    retries: options.retries,
    factor: options.factor,
    minTimeout: options.minTimeout,
    maxTimeout: options.maxTimeout
  })

  operation.attempt(() => {
    fs.readFile(filePath, isSecret(options.secret) && !options.encryptEncoding ? null : options.encoding, function readDone (err, data) {
      if (!err) {
        if (isSecret(options.secret)) {
          data = options.decoder(decrypt(options, data, sessionId))
        }

        let json
        try {
          json = options.decoder(data)
        } catch (parseError) {
          return fs.remove(filePath, (removeError) => {
            if (removeError) {
              return done(removeError)
            }

            done(parseError)
          })
        }

        return done(null, isExpired(json, options) ? null : json)
      }

      if (operation.retry(err)) {
        options.log('Retrying. Error on last try', err)
      } else if (options.fallbackSessionFn) {
        const session = options.fallbackSessionFn(sessionId)
        setLastAccess(session)
        done(null, session)
      } else {
        done(err)
      }
    })
  })
}

/**
 * Attempts to commit the given `session` associated with the given `sessionId` to a session file
 *
 * @param {String} sessionId
 * @param {Object} session
 * @param {Object} options
 * @param {Function} done (optional)
 *
 * @api public
 */
export function set (sessionId, session, options, done = () => {}) {
  try {
    setLastAccess(session)

    const filePath = sessionPath(options, sessionId)

    let json = options.encoder(session)
    if (isSecret(options.secret)) {
      json = encrypt(options, json, sessionId)
    }

    writeFileAtomic(filePath, json, (err) => {
      return (
        err ? done(err) : done(null, session)
      )
    })
  } catch (err) {
    done(err)
  }
}

/**
 * Update the last access time and the cookie of given `session` associated with the given `sessionId` in session file.
 * Note: Do not change any other session data.
 *
 * @param {String} sessionId
 * @param {Object} session
 * @param {Object} options
 * @param {Function} done (optional)
 *
 * @api public
 */
export function touch (sessionId, session, options, done = () => {}) {
  get(sessionId, options, (err, originalSession) => {
    if (err) return done(err, null)

    if (!originalSession) {
      originalSession = {}
    }

    if (session.cookie) {
      originalSession.cookie = session.cookie // Update cookie details
    }

    set(sessionId, originalSession, options, done) // Update `__lastAccess` property and save to store
  })
}

/**
 * Attempts to unlink a given session by its id
 *
 * @param {String} sessionId   Files are serialized to disk by their sessionId
 * @param {Object} options
 * @param {Function} done
 *
 * @api public
 */
export function destroy (sessionId, options, done = () => {}) {
  const filePath = sessionPath(options, sessionId)

  try {
    fs.removeSync(filePath)

    done()
  } catch (err) {
    done(err)
  }
}

/**
 * Attempts to fetch number of the session files
 *
 * @param {Object} options
 * @param {Function} done
 *
 * @api public
 */
export function length (options, done = () => {}) {
  fs.readdir(options.path, (err, files) => {
    if (err) return done(err)

    done(null, files.reduce((accumulator, file) => options.filePattern.exec(file) ? accumulator + 1 : accumulator, 0))
  })
}

/**
 * Attempts to clear out all of the existing session files
 *
 * @param {Object} options
 * @param {Function} done
 *
 * @api public
 */
export function clear (options, done = () => {}) {
  fs.readdir(options.path, (err, files) => {
    if (err) return done([err])
    if (files.length === 0) return done()

    const errors = []
    const n = files.length - 1

    files
      .forEach((file, i) => {
        if (options.filePattern.exec(file)) {
          fs.remove(join(options.path, file), (err) => {
            if (err) {
              errors.push(err)
            }

            if (i === n) { // TODO: wrong call condition (call after all completed attempts to remove instead of after completed attempt with last index)
              return (
                errors.length ? done(errors) : done()
              )
            }
          })
        } else {
          if (i === n) { // TODO: wrong call condition (call after all completed attempts to remove instead of after completed attempt with last index)
            return (
              errors.length ? done(errors) : done()
            )
          }
        }
      })
  })
}

/**
 * Attempts to find all of the session files
 *
 * @param {Object} options
 * @param {Function} done
 *
 * @api public
 */
export function list (options, done = () => {}) {
  fs.readdir(options.path, (err, files) => {
    if (err) return done(err)

    done(null, files.filter((file) => options.filePattern.exec(file)))
  })
}

/**
 * Attempts to detect whether a session file is already expired or not
 *
 * @param {String} sessionId
 * @param {Object} options
 * @param {Function} done
 *
 * @api public
 */
export function expired (sessionId, options, done = () => {}) {
  get(sessionId, options, (err, session) => {
    if (err) return done(err)

    return (
      err ? done(err) : done(null, isExpired(session, options))
    )
  })
}

export function encrypt ({ kruptein, secret }, data) {
  let result = null

  kruptein.set(secret, data, (err, encrypted) => {
    if (err) throw err

    result = encrypted
  })

  return result
}

export function decrypt ({ kruptein, secret }, data) {
  let result = null

  kruptein.get(secret, data, (err, decrypted) => {
    if (err) throw err

    result = decrypted
  })

  return result
}
