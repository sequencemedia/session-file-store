import * as chai from 'chai'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import childProcess from 'child_process'
import clone from 'lodash.clone'

import * as helpers from '#session-file-helpers'

const { expect } = chai

const isWindows = process.platform === 'win32'

const NOOP = () => {}

describe('reap', () => {
  const SESSIONS_PATH = path.join(os.tmpdir(), 'sessions')

  const SESSION_ID = 'session_id'
  const EXPIRED_SESSION_ID = 'expired_session_id'

  const SESSION = {
    cookie: {
      originalMaxAge: null,
      expires: null,
      httpOnly: true,
      path: '/'
    },
    views: 9,
    __lastAccess: 1430336255633
  }

  const SESSIONS_OPTIONS = helpers.defaults({
    path: SESSIONS_PATH,
    log: NOOP
  })

  const SESSION_FILE_PATH = path.join(SESSIONS_PATH, SESSION_ID + '.json')
  const EXPIRED_SESSION_FILE_PATH = path.join(SESSIONS_PATH, EXPIRED_SESSION_ID + '.json')

  const session = clone(SESSION)
  const expiredSession = clone(SESSION)

  session.__lastAccess = new Date().getTime()
  expiredSession.__lastAccess = 0

  beforeEach((done) => {
    fs.emptyDir(SESSIONS_PATH, () => {
      fs.writeJson(EXPIRED_SESSION_FILE_PATH, expiredSession, () => {
        fs.writeJson(SESSION_FILE_PATH, session, done)
      })
    })
  })

  afterEach((done) => {
    fs.remove(SESSIONS_PATH, done)
  })

  it('should removes stale session file', (done) => {
    helpers.reap(SESSIONS_OPTIONS, (err) => {
      expect(err).to.be.undefined

      done()
    })
  })

  it('should removes stale session file using distinct process', (done) => {
    function asyncReap () {
      helpers.asyncReap(SESSIONS_OPTIONS, () => {
        fs.stat(EXPIRED_SESSION_FILE_PATH, (err) => {
          expect(err).not.to.be.null

          done()
        })
      })
    }

    if (isWindows) {
      asyncReap()
    } else {
      childProcess.exec('chmod +x ./reap-worker.mjs', {
        cwd: path.resolve('./lib')
      }, () => {
        asyncReap()
      })
    }
  })
})
