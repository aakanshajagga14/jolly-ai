import { config } from 'dotenv';
config();

import { createServer } from 'http';
import { attachWebSocketServer } from './ws/wsServer';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Jolly backend running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
