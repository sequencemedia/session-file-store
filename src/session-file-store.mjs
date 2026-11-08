import fs from 'fs-extra'

import * as utils from '#session-file-utils'

/**
 * https://github.com/expressjs/session#session-store-implementation
 *
 * @param {object} session  express session
 * @return {Function} the `FileStore` extending `express`'s session Store
 *
 * @api public
 */
export default function sessionFileStore ({ Store }) {
  /**
   * Initialize FileStore with the given `options`
   *
   * @param {Object} options (optional)
   *
   * @api public
   */
  return class FileStore extends Store {
    constructor (options = {}) {
      super(options)

      this.options = utils.defaults(options)

      fs.mkdirsSync(this.options.path)

      utils.scheduleReap(this.options)

      Object.assign(options, this.options)
    }

    /**
     * Attempts to fetch session from a session file by the given `sessionId`
     *
     * @param {String} sessionId
     * @param {Function} done
     *
     * @api public
     */
    get (sessionId, done) {
      utils.get(sessionId, this.options, done)
    }

    /**
     * Attempts to commit the given session associated with the given `sessionId` to a session file
     *
     * @param {String} sessionId
     * @param {Object} session
     * @param {Function} done (optional)
     *
     * @api public
     */
    set (sessionId, session, done) {
      utils.set(sessionId, session, this.options, done)
    }

    /**
     * Touch the given session object associated with the given `sessionId`
     *
     * @param {string} sessionId
     * @param {object} session
     * @param {function} done
     *
     * @api public
     */
    touch (sessionId, session, done) {
      utils.touch(sessionId, session, this.options, done)
    }

    /**
     * Attempts to unlink a given session by its id
     *
     * @param {String} sessionId   Files are serialized to disk by their sessionId
     * @param {Function} done
     *
     * @api public
     */
    destroy (sessionId, done) {
      utils.destroy(sessionId, this.options, done)
    }

    /**
     * Attempts to fetch number of the session files
     *
     * @param {Function} done
     *
     * @api public
     */
    length (done) {
      utils.length(this.options, done)
    }

    /**
     * Attempts to clear out all of the existing session files
     *
     * @param {Function} done
     *
     * @api public
     */
    clear (done) {
      utils.clear(this.options, done)
    }

    /**
     * Attempts to find all of the session files
     *
     * @param {Function} done
     *
     * @api public
     */
    list (done) {
      utils.list(this.options, done)
    }

    /**
     * Attempts to detect whether a session file is already expired or not
     *
     * @param {String} sessionId
     * @param {Function} done
     *
     * @api public
     */
    expired (sessionId, done) {
      utils.expired(sessionId, this.options, done)
    }
  }
}
