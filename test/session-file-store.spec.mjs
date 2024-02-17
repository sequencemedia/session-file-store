import * as chai from 'chai'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

import * as helpers from '#session-file-helpers'
import sessionFileStore from '#session-file-store'

const { expect } = chai

const session = {
  Store: class Store { }
}

const FileStore = sessionFileStore(session)

const NOOP = () => {}

describe('store', () => {
  const SESSIONS_PATH = path.join(os.tmpdir(), 'sessions')

  const SESSIONS_OPTIONS = helpers.defaults({
    path: SESSIONS_PATH,
    log: NOOP,
    reapInterval: 10000
  })

  describe('#constructor', () => {
    before(function (done) {
      fs.remove(SESSIONS_OPTIONS.path, done)
    })

    after(function (done) {
      fs.remove(SESSIONS_OPTIONS.path, done)
    })

    it('should construct', () => {
      const store = new FileStore(SESSIONS_OPTIONS)

      describe('#length', () => {
        describe('no destination folder exists', () => {
          it('should fails when no folder exists', function (done) {
            store.length(function (err, result) {
              expect(err)
                .to.be.ok
                .and.have.property('code', 'ENOENT')
              expect(result).to.not.exist

              done()
            })
          })
        })

        describe('destination folder is empty', () => {
          before(function (done) {
            fs.emptyDir(SESSIONS_OPTIONS.path, done)
          })

          after(function (done) {
            fs.remove(SESSIONS_OPTIONS.path, done)
          })

          it('should returns 0 when empty folder exists', function (done) {
            store.length(function (err, result) {
              expect(err).to.not.exist
              expect(result).to.equal(0)

              done()
            })
          })
        })
      })

      describe.only('#reapIntervalObject', () => {
        after(() => {
          const { reapIntervalObject } = SESSIONS_OPTIONS

          if (reapIntervalObject) {
            clearInterval(reapIntervalObject)

            delete SESSIONS_OPTIONS.reapIntervalObject
          }
        })

        it('should contains reapIntervalObject object', function (done) {
          expect(SESSIONS_OPTIONS.reapIntervalObject).not.to.be.undefined

          done()
        })
      })
    })
  })
})
