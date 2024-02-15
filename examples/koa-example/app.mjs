import Koa from 'koa'
import session from 'express-session'
import sessionFileStore from '@sequencemedia/session-file-store'

const FileStore = sessionFileStore(session)

const app = new Koa()

const middleware = session({
  store: new FileStore(),
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
})

const server = (
  app
    .use(function * (next) {
      yield middleware.bind(null, this.req, this.res)
      yield next
    })
    .use(function * (next) {
      if (this.method !== 'GET' || this.path !== '/') return yield next

      const { req: { session } } = this
      const views = (session.views ? session.views : 0) + 1
      session.views = views

      this.body = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Example</title>
          </head><body>
            <p>${views}
          </body>
        </html>`.trim()
    })
    .listen(1337, () => {
      const {
        address: host,
        port
      } = server.address()

      console.log(`Example app listening at http://${host}:${port}`)
    })
)
