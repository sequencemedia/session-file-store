import connect from 'connect'
import session from 'express-session'
import sessionFileStore from '@sequencemedia/session-file-store'

const FileStore = sessionFileStore(session)

const app = connect()

const server = (
  app
    .use(session({
      store: new FileStore(),
      secret: 'keyboard cat',
      resave: true,
      saveUninitialized: true
    }))
    .use('/', ({ session = {} }, res, next) => {
      session.views = (session.views ? session.views : 0) + 1

      next()
    }, ({ session: { views } = {} }, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.send(`
<!DOCTYPE html>
<html>
  <head>
    <title>Example</title>
  </head><body>
    <p>${views}</p>
  </body>
</html>`.trim())
    })
    .listen(1337, () => {
      const {
        address: host,
        port
      } = server.address()

      console.log(`Example app listening at http://${host}:${port}`)
    })
)
