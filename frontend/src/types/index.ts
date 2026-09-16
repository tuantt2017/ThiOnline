export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'offline';
  database: string;
  environment: string;
}
