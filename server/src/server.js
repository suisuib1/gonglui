import { app } from './app.js'

const port = Number(process.env.PORT || 3001)

app.listen(port, () => {
  console.log(`Gonglui API server listening on http://127.0.0.1:${port}`)
})
