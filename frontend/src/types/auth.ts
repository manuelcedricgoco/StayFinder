export type Role = 'ADMIN' | 'OWNER' | 'BOARDER';

// Matches the user object returned by the API (never contains a password).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: 'OWNER' | 'BOARDER';
}
