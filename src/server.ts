import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSocketIO } from './socket/socket.js';

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  initSocketIO(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
    console.log(`🔌 WebSocket ready for real-time order updates`);
  });

  process.on('unhandledRejection', (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Unhandled Rejection: ${message}`);
    httpServer.close(() => process.exit(1));
  });
};

startServer();
