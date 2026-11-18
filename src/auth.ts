import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
export type AuthUser={id:string;email:string;role:string;agencyId:string;clientId?:string|null;name:string};
@Injectable() export class JwtGuard implements CanActivate { canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest(); const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) throw new UnauthorizedException('Sign in required'); try {req.user=jwt.verify(h.slice(7),process.env.JWT_SECRET||process.env.JWT_ACCESS_SECRET||'dev-access-secret') as AuthUser; return true;}catch{throw new UnauthorizedException('Session expired');}} }
export const CurrentUser=createParamDecorator((_:unknown,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest().user as AuthUser);
