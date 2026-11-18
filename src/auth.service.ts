import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs'; import * as jwt from 'jsonwebtoken'; import { randomUUID, createHash } from 'crypto';
@Injectable() export class AuthService {
 constructor(private db:PrismaService){}
 private access(user:any){return jwt.sign({id:user.id,email:user.email,role:user.role,agencyId:user.agencyId,clientId:user.clientId,name:user.name},process.env.JWT_SECRET||process.env.JWT_ACCESS_SECRET||'dev-access-secret',{expiresIn:'15m'});}
 async login(email:string,password:string){const user=await this.db.user.findUnique({where:{email}}); if(!user||!(await bcrypt.compare(password,user.passwordHash)))throw new UnauthorizedException('Invalid email or password'); const raw=randomUUID()+randomUUID(); await this.db.refreshToken.create({data:{tokenHash:createHash('sha256').update(raw).digest('hex'),userId:user.id,expiresAt:new Date(Date.now()+30*86400000)}}); return {accessToken:this.access(user),refreshToken:raw,user:{id:user.id,name:user.name,email:user.email,role:user.role,clientId:user.clientId}};}
 async refresh(raw:string){if(!raw)throw new BadRequestException('Refresh token required');const tokenHash=createHash('sha256').update(raw).digest('hex');const record=await this.db.refreshToken.findUnique({where:{tokenHash},include:{user:true}});if(!record||record.expiresAt<new Date())throw new UnauthorizedException('Invalid refresh token');await this.db.refreshToken.delete({where:{id:record.id}});const next=randomUUID()+randomUUID();await this.db.refreshToken.create({data:{tokenHash:createHash('sha256').update(next).digest('hex'),userId:record.userId,expiresAt:new Date(Date.now()+30*86400000)}});return {accessToken:this.access(record.user),refreshToken:next};}
 async logout(raw:string){if(raw)await this.db.refreshToken.deleteMany({where:{tokenHash:createHash('sha256').update(raw).digest('hex')}});return {success:true};}
}
