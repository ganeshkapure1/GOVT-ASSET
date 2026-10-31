const http = require('http');

const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000',
      'x-forwarded-host': req.headers.host || 'localhost:3001',
      'x-forwarded-proto': 'http',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy gateway connecting to http://localhost:3000...');
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(3001, '0.0.0.0', () => {
  console.log('GovAsset Proxy: Port 3001 -> Port 3000 active.');
});
