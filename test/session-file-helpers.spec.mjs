import * as chai from 'chai'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import clone from 'lodash.clone'
import cbor from 'cbor-sync'

import * as helpers from '#session-file-helpers'

const { expect } = chai

const NOOP = () => {}

describe('helpers', () => {
  const FIXTURE_SESSIONS_FILE_PATH = path.normalize('./test/fixtures/sessions')
  const FIXTURE_SESSIONS_NO_EXIST_PATH = path.normalize('./test/fixtures/sessions_no_exist')

  const SESSIONS_FILE_PATH = path.join(os.tmpdir(), 'sessions')
  const SESSION_ID = 'session_id'

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

  const OPTIONS = helpers.defaults({
    logFn: NOOP
  })

  const SESSIONS_OPTIONS = helpers.defaults({
    path: SESSIONS_FILE_PATH,
    logFn: NOOP
  })

  const FIXTURE_SESSIONS_OPTIONS = helpers.defaults({
    path: FIXTURE_SESSIONS_FILE_PATH,
    logFn: NOOP
  })

  const FIXTURE_SESSIONS_NO_EXIST_OPTIONS = helpers.defaults({
    path: FIXTURE_SESSIONS_NO_EXIST_PATH,
    logFn: NOOP
  })

  const FALLBACK_OPTIONS = helpers.defaults({
    path: FIXTURE_SESSIONS_NO_EXIST_PATH,
    logFn: NOOP,
    fallbackSessionFn: () => {
      return clone(SESSION)
    }
  })

  const ENCRYPT_OPTIONS = helpers.defaults({
    path: FIXTURE_SESSIONS_FILE_PATH,
    logFn: NOOP,
    secret: 'squirrel'
  })

  const CBOR_OPTIONS = helpers.defaults({
    path: FIXTURE_SESSIONS_FILE_PATH,
    logFn: NOOP,
    fileExtension: '.cbor',
    secret: null,
    encoding: null,
    encoder: cbor.encode,
    decoder: cbor.decode
  })

  describe('#defaults', () => {
    it('should returns valid defaults', () => {
      const options = OPTIONS
      expect(options).to.exist
      expect(options).to.have.property('path').that.is.a('string')
      expect(options).to.have.property('ttl').that.be.a('number')
      expect(options).to.have.property('retries').that.be.a('number').and.least(0)
      expect(options).to.have.property('factor').that.be.a('number').and.gt(0)
      expect(options).to.have.property('minTimeout').that.be.a('number').and.gt(0)
      expect(options).to.have.property('maxTimeout').that.be.a('number').and.least(options.minTimeout)
      expect(options).to.have.property('filePattern').that.is.instanceOf(RegExp)
      expect(options).to.have.property('reapInterval').that.be.a('number')
      expect(options).to.have.property('reapAsync').that.be.a('boolean')
      expect(options).to.have.property('reapSyncFallback').that.be.a('boolean')
      expect(options).to.have.property('logFn').that.be.a('function')
      expect(options).to.not.have.property('fallbackSessionFn')
      expect(options).to.not.have.property('secret')
    })

    it('should returns provided options', () => {
      const options = helpers.defaults({
        path: './sessions2',
        ttl: 4000,
        retries: 0,
        factor: 2,
        minTimeout: 150,
        maxTimeout: 200,
        reapInterval: 4000,
        reapAsync: true,
        reapSyncFallback: true,
        logFn: NOOP,
        fallbackSessionFn: NOOP,
        secret: 'keyboard cat'
      })

      expect(options).to.exist
      expect(options).to.have.property('path', path.normalize('./sessions2'))
      expect(options).to.have.property('ttl', 4000)
      expect(options).to.have.property('retries', 0)
      expect(options).to.have.property('factor', 2)
      expect(options).to.have.property('minTimeout', 150)
      expect(options).to.have.property('maxTimeout', 200)
      expect(options).to.have.property('filePattern').that.is.instanceOf(RegExp)
      expect(options).to.have.property('reapInterval', 4000)
      expect(options).to.have.property('reapAsync', true)
      expect(options).to.have.property('reapSyncFallback', true)
      expect(options).to.have.property('logFn', NOOP)
      expect(options).to.have.property('fallbackSessionFn', NOOP)
      expect(options).to.have.property('secret', 'keyboard cat')
    })
  })

  describe('#sessionId', () => {
    it('should returns session id when valid json file name is passed', () => {
      const sessionId = helpers.sessionId(OPTIONS, 'id.json')
      expect(sessionId).is.equal('id')
    })

    it('should returns no session id when invalid file name is passed', () => {
      const sessionId = helpers.sessionId(OPTIONS, 'id')
      expect(sessionId).is.equal('')
    })
  })

  describe('#sessionPath', () => {
    it('should returns session file path when base path and session id are passed', () => {
      const sessionPath = helpers.sessionPath(OPTIONS, 'id')
      expect(sessionPath).to.be.a('string').and.is.equal(path.normalize('sessions/id.json'))
    })
  })

  describe('#length', () => {
    describe('no destination folder exists', () => {
      it('should fails when no folder exists', (done) => {
        helpers.length(FIXTURE_SESSIONS_NO_EXIST_OPTIONS, function (err, result) {
          expect(err)
            .to.have.property('code', 'ENOENT')
          expect(result).to.be.undefined

          done()
        })
      })
    })

    describe('destination folder is empty', () => {
      before((done) => {
        fs.emptyDir(SESSIONS_FILE_PATH, done)
      })

      after((done) => {
        fs.remove(SESSIONS_FILE_PATH, done)
      })

      it('should returns 0 when empty folder exists', (done) => {
        helpers.length(SESSIONS_OPTIONS, function (err, result) {
          expect(err).to.be.null
          expect(result).to.equal(0)

          done()
        })
      })
    })

    describe('destination folder has some session files', () => {
      it('should returns count of session files match to file pattern', (done) => {
        helpers.length(FIXTURE_SESSIONS_OPTIONS, function (err, result) {
          expect(err).to.be.null
          expect(result).to.equal(2)

          done()
        })
      })
    })
  })

  describe('#list', () => {
    describe('no destination folder exists', () => {
      it('should fails when no folder exists', (done) => {
        helpers.list(FIXTURE_SESSIONS_NO_EXIST_OPTIONS, function (err, result) {
          expect(err)
            .to.have.property('code', 'ENOENT')

          done()
        })
      })
    })

    describe('destination folder is empty', () => {
      before((done) => {
        fs.emptyDir(SESSIONS_FILE_PATH, done)
      })

      after((done) => {
        fs.remove(SESSIONS_FILE_PATH, done)
      })

      it('should returns empty list when empty folder exists', (done) => {
        helpers.list(SESSIONS_OPTIONS, function (err, files) {
          expect(err).to.not.exist
          expect(files).is.empty

          done()
        })
      })
    })

    describe('destination folder has some session files', () => {
      it('should returns session files match to file pattern', (done) => {
        helpers.list(FIXTURE_SESSIONS_OPTIONS, function (err, files) {
          expect(err).to.not.exist
          expect(files).to.have.length(2)

          done()
        })
      })
    })
  })

  describe('#get', () => {
    it('should fails when no session file exists', (done) => {
      helpers.get('no_exists', FIXTURE_SESSIONS_OPTIONS, (err, json) => {
        expect(err)
          .to.have.property('code', 'ENOENT')
        expect(json).to.be.undefined

        done()
      })
    })

    it('should fails when invalid session file exists', (done) => {
      helpers.get('2o7sOpgMqMGWem0IxddjE0DkR3-jqUPS', FIXTURE_SESSIONS_OPTIONS, (err, json) => {
        expect(err)
          .to.have.property('code', 'ENOENT')
        expect(json).to.be.undefined

        done()
      })
    })

    it('should succeeds when valid expired session file exists', (done) => {
      helpers.get('2o7sOpgMqMGWem0IxddjE0DkR3-jqUPx', FIXTURE_SESSIONS_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.be.null

        done()
      })
    })

    it('should succeeds with fallbackSessionFn when session file does not exist', (done) => {
      helpers.get('2o7sOpgMqMGWem0IxddjE0DkR3-jqUPx', FALLBACK_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        done()
      })
    })

    it('should fails with empty session file. Bad session should be deleted', (done) => {
      const emptySessionPath = path.join(FIXTURE_SESSIONS_FILE_PATH, 'empty_session.json')

      fs.writeFileSync(emptySessionPath, Buffer.from(''))

      helpers.get('empty_session', FIXTURE_SESSIONS_OPTIONS, (err, json) => {
        expect(err)
          .to.have.property('name', 'SyntaxError')
        expect(json).to.be.undefined

        fs.stat(emptySessionPath, (err) => {
          expect(err)
            .to.have.property('code', 'ENOENT')

          done()
        })
      })
    })

    it('should fail when valid expired session file exists with cbor', (done) => {
      helpers.get('YH7h3CPKKWJa10-xJyEDqzbM56c8xblR', CBOR_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.be.null

        done()
      })
    })

    it('should succeeds when valid non-exired session file exists with cbor', (done) => {
      const session = clone(SESSION)
      session.__lastAccess = 0

      // first we create a session file in order to read a valid one later
      helpers.set(SESSION_ID, session, CBOR_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        // read the valid json file
        helpers.get(SESSION_ID, CBOR_OPTIONS, (err, json) => {
          expect(err).to.be.null
          expect(json).to.have.property('__lastAccess')
          expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

          done()
        })
      })
    })

    it('validates encrypted session', (done) => {
      const session = clone(SESSION)
      session.__lastAccess = 0

      helpers.set(SESSION_ID, session, ENCRYPT_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        helpers.get(SESSION_ID, CBOR_OPTIONS, (err, json) => {
          expect(err).to.be.null
          expect(json).to.have.property('__lastAccess')
          expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

          done()
        })
      })
    })
  })

  describe('#set', () => {
    before((done) => {
      fs.emptyDir(SESSIONS_FILE_PATH, done)
    })

    after((done) => {
      const CBOR_FILE_PATH = path.join(FIXTURE_SESSIONS_FILE_PATH, 'session_id.cbor')

      fs.remove(CBOR_FILE_PATH, () => {
        const JSON_FILE_PATH = path.join(FIXTURE_SESSIONS_FILE_PATH, 'session_id.json')

        fs.remove(JSON_FILE_PATH, done)
      })
    })

    it('should creates new session file', (done) => {
      const session = clone(SESSION)
      session.__lastAccess = 0

      helpers.set(SESSION_ID, session, SESSIONS_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        done()
      })
    })

    it('should creates new session file with cbor', (done) => {
      const session = clone(SESSION)
      session.__lastAccess = 0

      helpers.set(SESSION_ID, session, CBOR_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        done()
      })
    })

    it('creates encrypted session', (done) => {
      const session = clone(SESSION)
      session.__lastAccess = 0

      helpers.set(SESSION_ID, session, ENCRYPT_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        done()
      })
    })
  })

  describe('#touch', () => {
    before((done) => {
      fs.emptyDir(SESSIONS_FILE_PATH, done)
    })

    after((done) => {
      fs.remove(SESSIONS_FILE_PATH, done)
    })

    it('should fails when no session file exists', (done) => {
      const session = clone(SESSION)
      helpers.touch('no_exists', session, SESSIONS_OPTIONS, (err, json) => {
        expect(err)
          .to.have.property('code', 'ENOENT')
        expect(json).to.be.null

        done()
      })
    })

    it('should succeeds when valid session touched', (done) => {
      const session = clone(SESSION)
      session.__lastAccess = 0

      // first we create a session file in order to read a valid one later
      helpers.set(SESSION_ID, session, SESSIONS_OPTIONS, (err, json) => {
        expect(err).to.be.null
        expect(json).to.have.property('__lastAccess')
        expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

        helpers.touch(SESSION_ID, session, SESSIONS_OPTIONS, (err, json) => {
          expect(err).to.be.null
          expect(json).to.have.property('__lastAccess')
          expect(json.__lastAccess).to.not.equal(SESSION.__lastAccess)

          done()
        })
      })
    })
  })

  describe('#destroy', () => {
    const SESSION_FILE_PATH = path.join(SESSIONS_FILE_PATH, SESSION_ID + '.json')

    before((done) => {
      fs.emptyDir(SESSIONS_FILE_PATH, () => {
        fs.writeJson(SESSION_FILE_PATH, SESSION, done)
      })
    })

    after((done) => {
      fs.remove(SESSIONS_FILE_PATH, done)
    })

    it('should destroys session file', (done) => {
      helpers.destroy(SESSION_ID, SESSIONS_OPTIONS, (err) => {
        expect(err).to.be.undefined

        done()
      })
    })
  })

  describe('#clear', () => {
    describe('no destination folder exists', () => {
      it('should fails when no folder exists', (done) => {
        helpers.clear(FIXTURE_SESSIONS_NO_EXIST_OPTIONS, (err) => {
          expect(err)
            .to.be.an('array')
            .with.deep.property('0')
            .and.have.property('code', 'ENOENT')

          done()
        })
      })
    })

    describe('destination folder is empty', () => {
      before((done) => {
        fs.emptyDir(SESSIONS_FILE_PATH, done)
      })

      after((done) => {
        fs.remove(SESSIONS_FILE_PATH, done)
      })

      it('should returns 0 when empty folder exists', (done) => {
        helpers.clear(SESSIONS_OPTIONS, (err) => {
          expect(err).to.be.undefined

          done()
        })
      })
    })

    describe('destination folder has some session files', () => {
      const SESSION_FILE_PATH = path.join(SESSIONS_FILE_PATH, SESSION_ID + '.json')

      before((done) => {
        fs.emptyDir(SESSIONS_FILE_PATH, () => {
          fs.writeJson(SESSION_FILE_PATH, SESSION, done)
        })
      })

      after((done) => {
        fs.remove(SESSIONS_FILE_PATH, done)
      })

      it('should destroys session file', (done) => {
        helpers.clear(SESSIONS_OPTIONS, (err) => {
          expect(err).to.be.undefined

          done()
        })
      })
    })
  })

  describe('#expired', () => {
    const EXPIRED_SESSION_ID = 'expired_' + SESSION_ID

    const SESSION_FILE_PATH = path.join(SESSIONS_FILE_PATH, SESSION_ID + '.json')
    const EXPIRED_SESSION_FILE_PATH = path.join(SESSIONS_FILE_PATH, EXPIRED_SESSION_ID + '.json')

    const session = clone(SESSION)
    const expiredSession = clone(SESSION)

    session.__lastAccess = new Date().getTime()
    expiredSession.__lastAccess = 0

    before((done) => {
      fs.emptyDir(SESSIONS_FILE_PATH, () => {
        fs.writeJson(EXPIRED_SESSION_FILE_PATH, expiredSession, () => {
          fs.writeJson(SESSION_FILE_PATH, session, done)
        })
      })
    })

    after((done) => {
      fs.remove(SESSIONS_FILE_PATH, done)
    })

    it('should be expired', (done) => {
      helpers.expired(EXPIRED_SESSION_ID, SESSIONS_OPTIONS, (err, expired) => {
        expect(err).to.be.null
        expect(expired).to.be.true

        done()
      })
    })

    it('should not be expired', (done) => {
      helpers.expired(SESSION_ID, SESSIONS_OPTIONS, (err, expired) => {
        expect(err).to.be.null
        expect(expired).to.be.false

        done()
      })
    })
  })

  describe('#destroyExpired', () => {
    const EXPIRED_SESSION_ID = 'expired_' + SESSION_ID

    const SESSION_FILE_PATH = path.join(SESSIONS_FILE_PATH, SESSION_ID + '.json')
    const EXPIRED_SESSION_FILE_PATH = path.join(SESSIONS_FILE_PATH, EXPIRED_SESSION_ID + '.json')

    const session = clone(SESSION)
    const expiredSession = clone(SESSION)

    session.__lastAccess = new Date().getTime()
    expiredSession.__lastAccess = 0

    before((done) => {
      fs.emptyDir(SESSIONS_FILE_PATH, () => {
        fs.writeJson(EXPIRED_SESSION_FILE_PATH, expiredSession, () => {
          fs.writeJson(SESSION_FILE_PATH, session, done)
        })
      })
    })

    after((done) => {
      fs.remove(SESSIONS_FILE_PATH, done)
    })

    it('should be succeed', (done) => {
      helpers.destroyExpired(SESSION_ID, SESSIONS_OPTIONS, (err) => {
        expect(err).to.be.undefined

        done()
      })
    })
  })
})
