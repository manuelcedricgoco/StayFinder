import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { deleteStaleSessions } from './services/session.service';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`StayFinder API running at http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
});

// Remove stale sessions once at startup, then every hour. Failures are logged
// only - the API must keep running even if the cleanup cannot reach the database.
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
async function runSessionCleanup() {
  try {
    const removed = await deleteStaleSessions();
    if (removed > 0) console.log(`Session cleanup removed ${removed} stale session(s).`);
  } catch (error) {
    console.error('Session cleanup failed:', error);
  }
}
void runSessionCleanup();
const cleanupTimer = setInterval(runSessionCleanup, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

// Close the server and database connection cleanly on Ctrl+C
async function shutdown() {
  clearInterval(cleanupTimer);
  console.log('Shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
