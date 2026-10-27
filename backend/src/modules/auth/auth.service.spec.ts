import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService - Unit Test Suite', () => {
  it('should successfully register a new user and create their tenant with hashed password and return JWT session token', async () => {
    const mockPrisma: any = {
      tenantUser: {
        findUnique: async () => null,
      },
      $transaction: async (cb: any) => {
        const tx = {
          tenant: {
            create: async ({ data }: any) => ({
              id: '11111111-1111-1111-1111-111111111111',
              name: data.name,
              slug: data.slug,
            }),
          },
          tenantUser: {
            create: async ({ data }: any) => ({
              id: '22222222-2222-2222-2222-222222222222',
              tenantId: data.tenantId,
              email: data.email,
              passwordHash: data.passwordHash,
              role: data.role,
            }),
          },
          scrapeConfig: {
            create: async ({ data }: any) => ({ id: 'scrape-cfg-id', ...data }),
          },
          positioningProfile: {
            create: async ({ data }: any) => ({ id: 'profile-id', ...data }),
          },
        };
        return cb(tx);
      },
    };

    const mockJwt: any = {
      sign: (payload: any) => 'mock-jwt-token-xyz',
    };

    const authService = new AuthService(mockPrisma, mockJwt);

    const result = await authService.register({
      email: 'operator@example.com',
      password: 'SecurePassword123!',
      companyName: 'Acme Corp',
    });

    assert.ok(result, 'Result should be defined');
    assert.strictEqual(result.accessToken, 'mock-jwt-token-xyz');
    assert.strictEqual(result.user.email, 'operator@example.com');
    assert.strictEqual(result.user.role, 'OWNER');
    assert.strictEqual(result.tenant.name, 'Acme Corp');
    assert.strictEqual(result.user.tenantId, '11111111-1111-1111-1111-111111111111');
    assert.strictEqual((result.user as any).passwordHash, undefined, 'passwordHash must never be leaked');
  });

  it('should reject registration when email already exists with ConflictException and not create orphan tenants', async () => {
    let tenantCreateCalled = false;
    const mockPrisma: any = {
      tenantUser: {
        findUnique: async () => ({ id: 'existing-uuid', email: 'existing@example.com' }),
      },
      tenant: {
        create: async () => {
          tenantCreateCalled = true;
        },
      },
      $transaction: async () => {
        tenantCreateCalled = true;
      },
    };

    const mockJwt: any = {
      sign: () => 'mock-jwt-token',
    };

    const authService = new AuthService(mockPrisma, mockJwt);

    await assert.rejects(
      async () => {
        await authService.register({
          email: 'existing@example.com',
          password: 'SecurePassword123!',
          companyName: 'Duplicate Corp',
        });
      },
      (err: any) => {
        assert.strictEqual(err instanceof ConflictException, true);
        assert.strictEqual(err.message, 'Email already registered');
        return true;
      }
    );

    assert.strictEqual(tenantCreateCalled, false, 'Tenant or transaction must never be called on conflict');
  });

  it('should reject registration if email or password does not meet minimum security requirements', async () => {
    const mockPrisma: any = {
      tenantUser: { findUnique: async () => null },
    };
    const mockJwt: any = { sign: () => 'mock-jwt' };
    const authService = new AuthService(mockPrisma, mockJwt);

    // Short password (< 8 chars)
    await assert.rejects(
      async () => {
        await authService.register({
          email: 'valid@example.com',
          password: 'short',
          companyName: 'Acme',
        });
      },
      (err: any) => {
        assert.strictEqual(err.name, 'BadRequestException');
        assert.match(err.message, /password/i);
        return true;
      }
    );

    // Invalid email format
    await assert.rejects(
      async () => {
        await authService.register({
          email: 'not-an-email',
          password: 'ValidPassword123!',
          companyName: 'Acme',
        });
      },
      (err: any) => {
        assert.strictEqual(err.name, 'BadRequestException');
        assert.match(err.message, /email/i);
        return true;
      }
    );
  });

  it('should successfully authenticate an existing user with valid password and return JWT session token', async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('CorrectPassword123!', salt);
    const mockPrisma: any = {
      tenantUser: {
        findUnique: async () => ({
          id: 'user-uuid-123',
          tenantId: 'tenant-uuid-456',
          email: 'operator@example.com',
          passwordHash,
          role: 'OWNER',
          tenant: {
            id: 'tenant-uuid-456',
            name: 'Acme Studio',
            slug: 'acme-studio',
          },
        }),
      },
    };

    const mockJwt: any = {
      sign: () => 'mock-login-token-jwt',
    };

    const authService = new AuthService(mockPrisma, mockJwt);

    const result = await authService.login({
      email: 'operator@example.com',
      password: 'CorrectPassword123!',
    });

    assert.ok(result, 'Login result should be defined');
    assert.strictEqual(result.accessToken, 'mock-login-token-jwt');
    assert.strictEqual(result.user.email, 'operator@example.com');
    assert.strictEqual(result.tenant.name, 'Acme Studio');
    assert.strictEqual((result.user as any).passwordHash, undefined, 'passwordHash must never be exposed');
  });

  it('should reject login with UnauthorizedException when email does not exist', async () => {
    const mockPrisma: any = {
      tenantUser: {
        findUnique: async () => null,
      },
    };
    const mockJwt: any = { sign: () => 'mock-token' };
    const authService = new AuthService(mockPrisma, mockJwt);

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        });
      },
      (err: any) => {
        assert.strictEqual(err instanceof UnauthorizedException, true);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );
  });

  it('should reject login with UnauthorizedException when password does not match hash', async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('CorrectPassword123!', salt);
    const mockPrisma: any = {
      tenantUser: {
        findUnique: async () => ({
          id: 'user-uuid-123',
          tenantId: 'tenant-uuid-456',
          email: 'operator@example.com',
          passwordHash,
          role: 'OWNER',
          tenant: { id: 'tenant-uuid-456', name: 'Acme Studio', slug: 'acme-studio' },
        }),
      },
    };
    const mockJwt: any = { sign: () => 'mock-token' };
    const authService = new AuthService(mockPrisma, mockJwt);

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'operator@example.com',
          password: 'WrongPassword999!',
        });
      },
      (err: any) => {
        assert.strictEqual(err instanceof UnauthorizedException, true);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );
  });
});




