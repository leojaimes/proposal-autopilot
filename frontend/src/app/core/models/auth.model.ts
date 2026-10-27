export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  tenant: TenantInfo;
}

export interface RegisterPayload {
  email: string;
  password: string;
  companyName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface StoredSession {
  token: string;
  user: AuthUser;
  tenant: TenantInfo;
}

