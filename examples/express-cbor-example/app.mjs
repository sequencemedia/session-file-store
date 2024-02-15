import express from 'express'
import session from 'express-session'
import sessionFileStore from '@sequencemedia/session-file-store'
import cbor from 'cbor-sync'

const FileStore = sessionFileStore(session)

const app = express()

const server = (
  app
    .use(session({
      store: new FileStore(),
      secret: 'keyboard cat',
      resave: true,
      saveUninitialized: true,
      fileExtension: '.cbor',
      encoding: null,
      encoder: cbor.encode,
      decoder: cbor.decode
    }))
    .get('/', ({ session = {} }, res, next) => {
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
