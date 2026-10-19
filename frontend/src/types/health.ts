export interface ApiHealthResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface DbHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  database: string;
  connected: boolean;
  migrationsApplied?: boolean;
  message?: string;
}
