import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

// GET /api/health - is the API server running?
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'occidental-mindoro-stayfinder-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// GET /api/health/db - can we reach SQLite, and has the migration been applied?
healthRouter.get('/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Database connection check failed:', error);
    res.status(503).json({
      status: 'error',
      database: 'sqlite',
      connected: false,
      message: 'Cannot connect to the database.',
    });
    return;
  }

  let migrationsApplied = false;
  try {
    await prisma.systemCheck.count();
    migrationsApplied = true;
  } catch {
    // Table missing: the migration has not been run yet.
  }

  res.json({
    status: migrationsApplied ? 'ok' : 'degraded',
    database: 'sqlite',
    connected: true,
    migrationsApplied,
    ...(migrationsApplied
      ? {}
      : { message: 'Connected, but tables are missing. Run: npm run prisma:migrate' }),
  });
});
