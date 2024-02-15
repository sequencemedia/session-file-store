import fs from 'fs-extra'

import * as helpers from '#session-file-helpers'

/**
 * https://github.com/expressjs/session#session-store-implementation
 *
 * @param {object} session  express session
 * @return {Function} the `FileStore` extending `express`'s session Store
 *
 * @api public
 */
export default function SessionFileStore ({ Store }) {
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

      this.options = helpers.defaults(options)

      fs.mkdirsSync(this.options.path)

      helpers.scheduleReap(this.options)

      Object.assign(options, this.options)
    }

    /**
     * Attempts to fetch session from a session file by the given `sessionId`
     *
     * @param  {String}   sessionId
     * @param  {Function} callback
     *
     * @api public
     */
    get (sessionId, callback) {
      helpers.get(sessionId, this.options, callback)
    }

    /**
   * Attempts to commit the given session associated with the given `sessionId` to a session file
   *
   * @param {String}   sessionId
   * @param {Object}   session
   * @param {Function} callback (optional)
   *
   * @api public
   */
    set (sessionId, session, callback) {
      helpers.set(sessionId, session, this.options, callback)
    }

    /**
   * Touch the given session object associated with the given `sessionId`
   *
   * @param {string} sessionId
   * @param {object} session
   * @param {function} callback
   *
   * @api public
   */
    touch (sessionId, session, callback) {
      helpers.touch(sessionId, session, this.options, callback)
    }

    /**
   * Attempts to unlink a given session by its id
   *
   * @param  {String}   sessionId   Files are serialized to disk by their
   *                                sessionId
   * @param  {Function} callback
   *
   * @api public
   */
    destroy (sessionId, callback) {
      helpers.destroy(sessionId, this.options, callback)
    }

    /**
   * Attempts to fetch number of the session files
   *
   * @param  {Function} callback
   *
   * @api public
   */
    length (callback) {
      helpers.length(this.options, callback)
    }

    /**
   * Attempts to clear out all of the existing session files
   *
   * @param  {Function} callback
   *
   * @api public
   */
    clear (callback) {
      helpers.clear(this.options, callback)
    }

    /**
   * Attempts to find all of the session files
   *
   * @param  {Function} callback
   *
   * @api public
   */
    list (callback) {
      helpers.list(this.options, callback)
    }

    /**
   * Attempts to detect whether a session file is already expired or not
   *
   * @param  {String}   sessionId
   * @param  {Function} callback
   *
   * @api public
   */
    expired (sessionId, callback) {
      helpers.expired(sessionId, this.options, callback)
    }
  }
}
