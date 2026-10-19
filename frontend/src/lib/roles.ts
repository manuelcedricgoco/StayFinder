import type { Role } from '../types/auth';

// Where each role lands after logging in.
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  OWNER: '/owner',
  BOARDER: '/boarder',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  OWNER: 'Property Owner',
  BOARDER: 'Boarder / Property Seeker',
};
