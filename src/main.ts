import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
async function bootstrap(){ const app=await NestFactory.create(AppModule); app.setGlobalPrefix('api'); const allowedOrigins=new Set([...(process.env.WEB_ORIGIN||'http://localhost:3000').split(',').map(origin=>origin.trim()).filter(Boolean),'http://localhost:3000','https://content-calendar-frontend-six.vercel.app']); app.enableCors({origin:(origin,callback)=>callback(null,!origin||allowedOrigins.has(origin)),credentials:true}); app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true})); await app.listen(process.env.PORT||4000); }
bootstrap();
