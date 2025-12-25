const client = require('prom-client')

const register = new client.Registry()

client.collectDefaultMetrics({ register })

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
})

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
})

const httpInFlightRequests = new client.Gauge({
  name: 'http_in_flight_requests',
  help: 'In-flight HTTP requests',
  registers: [register]
})

const verbQueriesTotal = new client.Counter({
  name: 'verb_queries_total',
  help: 'Total verb query requests',
  labelNames: ['route'],
  registers: [register]
})

function getRouteLabel(req) {
  if (req.route && req.route.path) {
    const baseUrl = req.baseUrl || ''
    return `${baseUrl}${req.route.path}`
  }

  if (req.baseUrl) {
    return req.baseUrl
  }

  return 'unknown'
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next()
  }

  httpInFlightRequests.inc()
  const start = process.hrtime.bigint()
  let finished = false

  res.on('finish', () => {
    finished = true
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9
    const route = getRouteLabel(req)
    const method = req.method

    httpRequestsTotal.inc({ method, route, status: res.statusCode })
    httpRequestDurationSeconds.observe({ method, route }, durationSeconds)

    if (route.startsWith('/api/verb')) {
      verbQueriesTotal.inc({ route })
    }

    httpInFlightRequests.dec()
  })

  res.on('close', () => {
    if (!finished) {
      httpInFlightRequests.dec()
    }
  })

  next()
}

async function metricsEndpoint(req, res) {
  res.setHeader('Content-Type', register.contentType)
  res.end(await register.metrics())
}

module.exports = {
  metricsMiddleware,
  metricsEndpoint
}
