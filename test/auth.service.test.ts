import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../src/auth.service';
import { JwtGuard } from '../src/auth';
import { hashPassword, verifyPassword } from '../src/password';

process.env.JWT_ACCESS_SECRET ||= 'test-only-access-secret-that-is-at-least-32-bytes-long';

const user = {
  id: 'user_1',
  name: 'Admin User',
  email: 'admin@example.com',
  passwordHash: '',
  role: 'ADMIN' as const,
  agencyId: 'agency_1',
  clientId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

test('login normalizes email, verifies bcrypt, and returns only safe user fields', async () => {
  const password = 'a-strong-test-password';
  const storedUser = { ...user, passwordHash: await hashPassword(password) };
  const created: any[] = [];
  const db: any = {
    user: { findUnique: async ({ where }: any) => where.email === storedUser.email ? storedUser : null },
    refreshToken: { create: async ({ data }: any) => created.push(data) },
  };
  const service = new AuthService(db);

  const result = await service.login('  ADMIN@EXAMPLE.COM ', password);
  const claims = jwt.verify(result.accessToken, process.env.JWT_ACCESS_SECRET!, { algorithms: ['HS256'] }) as any;

  assert.equal(result.user.email, storedUser.email);
  assert.equal('passwordHash' in result.user, false);
  assert.equal(claims.id, storedUser.id);
  assert.ok(claims.exp - claims.iat <= 15 * 60);
  assert.equal(created.length, 1);
  assert.equal(created[0].tokenHash, tokenHash(result.refreshToken));
  assert.notEqual(created[0].tokenHash, result.refreshToken);
  assert.ok(created[0].expiresAt.getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000);
});

test('login rejects unknown users and incorrect passwords with 401', async () => {
  const db: any = { user: { findUnique: async () => null } };
  const service = new AuthService(db);
  await assert.rejects(service.login('nobody@example.com', 'wrong-password'), UnauthorizedException);

  const storedUser = { ...user, passwordHash: await hashPassword('correct-password') };
  db.user.findUnique = async () => storedUser;
  await assert.rejects(service.login('admin@example.com', 'incorrect-password'), UnauthorizedException);
});

test('password helpers use bcrypt hashes that verify without returning plaintext', async () => {
  const password = 'another-strong-test-password';
  const passwordHash = await hashPassword(password);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong-password', passwordHash), false);
});

test('registration normalizes email, creates an agency admin, and starts a session', async () => {
  const createdUser = { ...user, email: 'new.owner@example.com', name: 'New Owner', passwordHash: 'hash' };
  const createData: any[] = [];
  const transaction: any = {
    agency: { create: async ({ data }: any) => ({ id: 'new_agency', ...data }) },
    user: { create: async ({ data }: any) => { createData.push(data); return createdUser; } },
  };
  const db: any = {
    user: { findUnique: async () => null },
    refreshToken: { create: async () => undefined },
    $transaction: async (work: any) => work(transaction),
  };

  const result = await new AuthService(db).register(' New Owner ', ' NEW.OWNER@EXAMPLE.COM ', 'a-strong-password', ' New Agency ');

  assert.equal(createData[0].email, 'new.owner@example.com');
  assert.equal(createData[0].name, 'New Owner');
  assert.equal(createData[0].agencyId, 'new_agency');
  assert.equal(createData[0].role, 'ADMIN');
  assert.ok(createData[0].passwordHash.startsWith('$2'));
  assert.equal('passwordHash' in result.user, false);
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
});

test('registration rejects duplicate emails with 409', async () => {
  const db: any = { user: { findUnique: async () => user } };
  await assert.rejects(new AuthService(db).register('Another', 'ADMIN@example.com', 'password123', 'Agency'), (error: any) => error.getStatus() === 409);
});

test('refresh rotation stores only hashes and rejects concurrent reuse', async () => {
  const oldRaw = 'old-refresh-token-value-that-is-long-enough-to-test';
  let current: any = { id: 'refresh_1', tokenHash: tokenHash(oldRaw), userId: user.id, user, expiresAt: new Date(Date.now() + 60_000) };
  const stored: any[] = [];
  const transaction: any = {
    refreshToken: {
      findUnique: async ({ where }: any) => current?.tokenHash === where.tokenHash ? current : null,
      deleteMany: async ({ where }: any) => {
        if (current?.id === where.id && current.tokenHash === where.tokenHash && current.expiresAt > where.expiresAt.gt) {
          current = null;
          return { count: 1 };
        }
        return { count: 0 };
      },
      create: async ({ data }: any) => { current = { id: 'refresh_2', ...data, user }; stored.push(data); },
    },
  };
  const db: any = {
    refreshToken: { deleteMany: async () => undefined },
    $transaction: async (work: any) => work(transaction),
  };
  const service = new AuthService(db);
  const results = await Promise.allSettled([service.refresh(oldRaw), service.refresh(oldRaw)]);

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const accepted = results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].tokenHash, tokenHash(accepted.value.refreshToken));
  assert.notEqual(stored[0].tokenHash, accepted.value.refreshToken);
});

test('refresh rejects expired tokens and logout revokes by token hash', async () => {
  const raw = 'refresh-token-value-that-is-long-enough-to-test';
  const deletes: any[] = [];
  const transaction: any = {
    refreshToken: {
      findUnique: async () => ({ id: 'expired', tokenHash: tokenHash(raw), user, userId: user.id, expiresAt: new Date(Date.now() - 1) }),
      deleteMany: async (query: any) => { deletes.push(query); return { count: 1 }; },
    },
  };
  const db: any = {
    refreshToken: { deleteMany: async (query: any) => { deletes.push(query); } },
    $transaction: async (work: any) => work(transaction),
  };
  const service = new AuthService(db);

  await assert.rejects(service.refresh(raw), UnauthorizedException);
  await service.logout(raw);
  assert.equal(deletes.at(-1).where.tokenHash, tokenHash(raw));
});

test('JWT guard accepts access tokens signed with JWT_ACCESS_SECRET', () => {
  const accessToken = jwt.sign({ id: user.id, role: user.role, agencyId: user.agencyId }, process.env.JWT_ACCESS_SECRET!, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
  const request: any = { headers: { authorization: 'Bearer ' + accessToken } };
  const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

  assert.equal(new JwtGuard().canActivate(context), true);
  assert.equal(request.user.id, user.id);
});

test('JWT guard rejects expired or malformed access tokens', () => {
  const expiredToken = jwt.sign({ id: user.id }, process.env.JWT_ACCESS_SECRET!, { algorithm: 'HS256', expiresIn: -1 });
  const guard = new JwtGuard();
  const contextFor = (authorization: string): any => ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  });

  assert.throws(() => guard.canActivate(contextFor('Bearer ' + expiredToken)), UnauthorizedException);
  assert.throws(() => guard.canActivate(contextFor('Bearer not-a-jwt')), UnauthorizedException);
  assert.throws(() => guard.canActivate(contextFor('')), UnauthorizedException);
});
