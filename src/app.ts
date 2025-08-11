import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

//  health checkup for api
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/', (req, res) => {
  res.json({ message: 'DAM Backend API', version: '1.0.0' })
})
// runnig port
app.listen(PORT, () => {
  console.log(`Server running on port: http://localhost:${PORT}`)
})

export default app
