import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`StayFinder API running at http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
});

// Close the server and database connection cleanly on Ctrl+C
async function shutdown() {
  console.log('Shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
