import fs from 'fs-extra'
import writeFileAtomic from 'write-file-atomic'
import path from 'path'
import retry from 'retry'
import childProcess from 'child_process'
import Bagpipe from 'bagpipe'
import objectAssign from 'object-assign'
import kruptein from 'kruptein'
import WHEREAMI from '#where-am-i'

const isWindows = process.platform === 'win32'

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
  logFn: console.log || (() => {}),
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

export function isSecret (secret) {
  return secret !== undefined && secret != null
}

export function sessionPath (options, sessionId) {
  // return path.join(basepath, sessionId + '.json');
  return path.join(options.path, sessionId + options.fileExtension)
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

export function escapeForRegExp (str) {
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
}

export function getFilePatternFromFileExtension (fileExtension) {
  return new RegExp(escapeForRegExp(fileExtension) + '$')
}

export function defaults (userOptions) {
  const options = objectAssign({}, DEFAULTS, userOptions)
  options.path = path.normalize(options.path)
  options.filePattern = getFilePatternFromFileExtension(options.fileExtension)

  if (isSecret(options.secret)) {
    options.kruptein = kruptein(options.crypto)
  }

  return options
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
        options.logFn('[session-file-store] Starting reap worker thread')
        asyncReap(options)
      } else {
        options.logFn('[session-file-store] Deleting expired sessions')
        reap(options)
      }
    }, options.reapInterval * 1000).unref()
  }
}

export function asyncReap (options, done = () => {}) {
  done || (done = () => {})

  function execCallback (err) {
    if (err && options.reapSyncFallback) {
      reap(options, done)
    } else {
      return (
        err ? done(err) : done()
      )
    }
  }

  if (isWindows) {
    childProcess.execFile('node', [path.join(WHEREAMI, './lib/reap-worker.mjs'), options.path, options.ttl], execCallback)
  } else {
    childProcess.execFile(path.join(WHEREAMI, './lib/reap-worker.mjs'), [options.path, options.ttl], execCallback)
  }
}

export function reap (options, done = () => {}) {
  list(options, (err, files) => {
    if (err) return done(err)
    if (files.length === 0) return done()

    const bagpipe = new Bagpipe(options.reapMaxConcurrent)

    const errors = []
    files.forEach((file, i) => {
      bagpipe.push(destroyExpired,
        sessionId(options, file),
        options,
        (err) => {
          if (err) {
            errors.push(err)
          }
          if (i >= files.length - 1) {
            errors.length > 0 ? done(errors) : done()
          }
        })
    })
  })
}

/**
 * Attempts to fetch session from a session file by the given `sessionId`
 *
 * @param  {String}   sessionId
 * @param  {Object}   options
 * @param  {Function} done
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
    fs.readFile(filePath, isSecret(options.secret) && !options.encryptEncoding ? null : options.encoding, function readCallback (err, data) {
      if (!err) {
        let json

        if (isSecret(options.secret)) {
          data = options.decoder(decrypt(options, data, sessionId))
        }

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
        options.logFn('[session-file-store] will retry, error on last attempt: ' + err)
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
 * @param {String}   sessionId
 * @param {Object}   session
 * @param  {Object}  options
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
 * @param {String}   sessionId
 * @param {Object}   session
 * @param {Object}   options
 * @param {Function} done (optional)
 *
 * @api public
 */
export function touch (sessionId, session, options, done = () => {}) {
  get(sessionId, options, (err, originalSession) => {
    if (err) {
      done(err, null)
      return
    }

    if (!originalSession) {
      originalSession = {}
    }

    if (session.cookie) {
      // Update cookie details
      originalSession.cookie = session.cookie
    }
    // Update `__lastAccess` property and save to store
    set(sessionId, originalSession, options, done)
  })
}

/**
 * Attempts to unlink a given session by its id
 *
 * @param  {String}   sessionId   Files are serialized to disk by their sessionId
 * @param  {Object}   options
 * @param  {Function} done
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
 * @param  {Object}   options
 * @param  {Function} done
 *
 * @api public
 */
export function length (options, done = () => {}) {
  fs.readdir(options.path, (err, files) => {
    if (err) return done(err)

    let result = 0
    files.forEach((file) => {
      if (options.filePattern.exec(file)) {
        ++result
      }
    })

    done(null, result)
  })
}

/**
 * Attempts to clear out all of the existing session files
 *
 * @param  {Object}   options
 * @param  {Function} done
 *
 * @api public
 */
export function clear (options, done = () => {}) {
  fs.readdir(options.path, (err, files) => {
    if (err) return done([err])
    if (files.length <= 0) return done()

    const errors = []
    files.forEach((file, i) => {
      if (options.filePattern.exec(file)) {
        fs.remove(path.join(options.path, file), (err) => {
          if (err) {
            errors.push(err)
          }
          // TODO: wrong call condition (call after all completed attempts to remove instead of after completed attempt with last index)
          if (i >= files.length - 1) {
            errors.length > 0 ? done(errors) : done()
          }
        })
      } else {
        // TODO: wrong call condition (call after all completed attempts to remove instead of after completed attempt with last index)
        if (i >= files.length - 1) {
          errors.length > 0 ? done(errors) : done()
        }
      }
    })
  })
}

/**
 * Attempts to find all of the session files
 *
 * @param  {Object}   options
 * @param  {Function} done
 *
 * @api public
 */
export function list (options, done = () => {}) {
  fs.readdir(options.path, (err, files) => {
    if (err) return done(err)

    files = files.filter((file) => {
      return options.filePattern.exec(file)
    })

    done(null, files)
  })
}

/**
 * Attempts to detect whether a session file is already expired or not
 *
 * @param  {String}   sessionId
 * @param  {Object}   options
 * @param  {Function} done
 *
 * @api public
 */
export function expired (sessionId, options, done = () => {}) {
  get(sessionId, options, (err, session) => {
    if (err) return done(err)

    err ? done(err) : done(null, isExpired(session, options))
  })
}

export function isExpired (session, options) {
  if (!session) return true

  const ttl = session.cookie && session.cookie.originalMaxAge ? session.cookie.originalMaxAge : options.ttl * 1000
  return !ttl || getLastAccess(session) + ttl < new Date().getTime()
}

export function encrypt (options, data) {
  let ciphertext = null

  options.kruptein.set(options.secret, data, (err, ct) => {
    if (err) { throw err }

    ciphertext = ct
  })

  return ciphertext
}

export function decrypt (options, data) {
  let plaintext = null

  options.kruptein.get(options.secret, data, (err, pt) => {
    if (err) { throw err }

    plaintext = pt
  })

  return plaintext
}
