import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from './prisma.service';
import { hashPassword, verifyPassword } from './password';

const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

type SessionUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'agencyId' | 'clientId'>;

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}

  private accessToken(user: SessionUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agencyId,
        clientId: user.clientId,
        name: user.name,
      },
      process.env.JWT_ACCESS_SECRET!,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
  }

  private publicUser(user: SessionUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    };
  }

  private async createSession(user: SessionUser) {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.db.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
      },
    });

    return {
      accessToken: this.accessToken(user),
      refreshToken,
      user: this.publicUser(user),
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.db.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  async register(name: string, email: string, password: string, agencyName: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await hashPassword(password);
    let user: User;
    try {
      user = await this.db.$transaction(async (transaction) => {
        const agency = await transaction.agency.create({ data: { name: agencyName.trim() } });
        return transaction.user.create({
          data: {
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            role: Role.ADMIN,
            agencyId: agency.id,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    return this.createSession(user);
  }

  async createClientAccount(input: {
    name: string;
    email: string;
    password: string;
    agencyId: string;
    clientId: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    try {
      const user = await this.db.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash: await hashPassword(input.password),
          role: Role.CLIENT,
          agencyId: input.agencyId,
          clientId: input.clientId,
        },
        select: { id: true, email: true, role: true },
      });
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async refresh(rawToken: string) {
    if (!rawToken) throw new BadRequestException('Refresh token required');

    const tokenHash = hashRefreshToken(rawToken);
    const now = new Date();
    const nextRefreshToken = randomBytes(32).toString('base64url');
    const user = await this.db.$transaction(async (transaction) => {
      const record = await transaction.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!record || record.expiresAt <= now) throw new UnauthorizedException('Invalid refresh token');

      // Claim the current token exactly once. Concurrent reuse sees count 0 and fails.
      const claimed = await transaction.refreshToken.deleteMany({
        where: { id: record.id, tokenHash, expiresAt: { gt: now } },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Invalid refresh token');

      await transaction.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(nextRefreshToken),
          userId: record.userId,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
        },
      });

      return record.user;
    });

    return {
      accessToken: this.accessToken(user),
      refreshToken: nextRefreshToken,
      user: this.publicUser(user),
    };
  }

  async logout(rawToken?: string) {
    if (rawToken) {
      await this.db.refreshToken.deleteMany({ where: { tokenHash: hashRefreshToken(rawToken) } });
    }
    return { success: true };
  }
}
