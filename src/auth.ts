import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
export type AuthUser={id:string;email:string;role:string;agencyId:string;clientId?:string|null;name:string};
@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const authorization = request.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) throw new UnauthorizedException('Sign in required');

    try {
      request.user = jwt.verify(authorization.slice(7), process.env.JWT_ACCESS_SECRET!, {
        algorithms: ['HS256'],
      }) as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Session expired');
    }
  }
}

export const CurrentUser=createParamDecorator((_:unknown,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest().user as AuthUser);
