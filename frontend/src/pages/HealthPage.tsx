import { StatusCard, type StatusLevel } from '../components/StatusCard';
import { useHealthCheck } from '../hooks/useHealthCheck';
import type { ApiHealthResponse, DbHealthResponse } from '../types/health';

export function HealthPage() {
  const api = useHealthCheck<ApiHealthResponse>('/health');
  const db = useHealthCheck<DbHealthResponse>('/health/db');

  let apiLevel: StatusLevel = 'loading';
  let apiMessage = 'Contacting the API...';
  if (api.state === 'error') {
    apiLevel = 'error';
    apiMessage = api.message;
  } else if (api.state === 'success') {
    apiLevel = api.data.status === 'ok' ? 'ok' : 'error';
    apiMessage = `${api.data.service} is up (uptime ${api.data.uptimeSeconds}s).`;
  }

  let dbLevel: StatusLevel = 'loading';
  let dbMessage = 'Checking the database...';
  if (db.state === 'error') {
    dbLevel = 'error';
    dbMessage = db.message;
  } else if (db.state === 'success') {
    if (db.data.status === 'ok') {
      dbLevel = 'ok';
      dbMessage = 'SQLite is connected and the Prisma migration is applied.';
    } else if (db.data.status === 'degraded') {
      dbLevel = 'warning';
      dbMessage = db.data.message ?? 'Connected, but migrations are missing.';
    } else {
      dbLevel = 'error';
      dbMessage = db.data.message ?? 'Database check failed.';
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
      <p className="mt-2 text-slate-600">Quick checks that every part of the stack is connected.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatusCard
          title="Frontend"
          level="ok"
          message="React, Tailwind CSS and React Router are running."
        />
        <StatusCard title="Backend API" level={apiLevel} message={apiMessage} />
        <StatusCard title="Database" level={dbLevel} message={dbMessage} />
      </div>
    </section>
  );
}
