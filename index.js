const http = require('http');
const url = require('url')
const fs = require('fs');
const client = require('prom-client');

const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();
register.setDefaultLabels({
  app: 'proxy-nodejs-app'
})
collectDefaultMetrics({ register });

// request counter for prom-client
const counter = new client.Counter({
  name: 'proxy_request_counter',
  help: 'Number of requests',
});

register.registerMetric(counter);
const server = http.createServer(async (req, res) => {
    // Retrieve route from request object
  const route = url.parse(req.url).pathname

  if (route === '/metrics') {
    // Return all metrics the Prometheus exposition format
    res.setHeader('Content-Type', register.contentType)
    res.end(await register.metrics())
    return;
  }


  const opts = {
    host: 'localhost',
    port: 4567,
    path: '/large_file',
    method: req.method,
    headers: req.headers,
  }

  // Make a request to the Sinatra server
  const proxyReq = http.request(opts, (proxyRes) => {
    // Set the content type to match the original response
    res.setHeader('Content-Type', proxyRes.headers['content-type']);

    // Pipe the response from the Sinatra server to the client
    proxyRes.pipe(res);

    // Handle errors if any
    proxyRes.on('error', (err) => {
      console.error(err);
    });
  });

  // Handle errors if any
  proxyReq.on('error', (err) => {
    console.error(err);
    res.writeHead(500);
    res.end('Proxy Error');
  });

  proxyReq.end();
  counter.inc();
});

const port = 5555;
server.listen(port, () => {
  console.log(`Node.js Proxy Server is listening on port ${port}`);
});

// // Profile memory usage in MB every 5 seconds
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const memoryInMB = {
    rss: memoryUsage.rss / 1024 / 1024,
    heapTotal: memoryUsage.heapTotal / 1024 / 1024,
    heapUsed: memoryUsage.heapUsed / 1024 / 1024,
  };
  // console.log(`Memory usage (MB): ${JSON.stringify(memoryInMB)}`);
  fs.appendFileSync('rss.txt', `${memoryInMB.rss}\n`);
}, 2000);

