import { app } from './app.js'

const port = Number(process.env.PORT || 3000)
const host = '0.0.0.0'

app.listen(port, host, () => {
  console.log(`Gonglui API server listening on http://${host}:${port}`)
})
