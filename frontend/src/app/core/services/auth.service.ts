import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthUser, TenantInfo, AuthResponse, RegisterPayload, LoginPayload, StoredSession } from '../models/auth.model';

const STORAGE_KEY = 'pa_auth_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? '/api/auth'
    : 'http://localhost:7000/api/auth';

  private readonly _currentUser = signal<AuthUser | null>(null);
  public readonly currentUser = this._currentUser.asReadonly();

  private readonly _currentTenant = signal<TenantInfo | null>(null);
  public readonly currentTenant = this._currentTenant.asReadonly();

  private readonly _token = signal<string | null>(null);
  public readonly token = this._token.asReadonly();

  public readonly isAuthenticated = computed(() => !!this._token());

  constructor() {
    this.hydrateSession();
  }

  private hydrateSession(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        if (session.token && session.user && session.tenant) {
          this._token.set(session.token);
          this._currentUser.set(session.user);
          this._currentTenant.set(session.tenant);
        }
      }
    } catch (e) {
      console.warn('Failed to hydrate auth session from storage', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  public register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload).pipe(
      tap((res) => {
        this.saveSession(res);
      })
    );
  }

  public login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload).pipe(
      tap((res) => {
        this.saveSession(res);
      })
    );
  }

  private saveSession(res: AuthResponse): void {
    this._token.set(res.accessToken);
    this._currentUser.set(res.user);
    this._currentTenant.set(res.tenant);

    if (typeof window !== 'undefined' && window.localStorage) {
      const session: StoredSession = {
        token: res.accessToken,
        user: res.user,
        tenant: res.tenant,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }

  public logout(): void {
    this._token.set(null);
    this._currentUser.set(null);
    this._currentTenant.set(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

