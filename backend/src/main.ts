import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { SafeErrors } from './core/errors';
import { config } from './core/config';

export async function createApp() {
  const app=await NestFactory.create(AppModule,{bodyParser:false});
  app.use(helmet());
  app.use(json({limit:'1mb'}));app.use(urlencoded({extended:false,limit:'10kb'}));
  app.use(cookieParser());
  app.enableCors({origin:config.WEB_ORIGIN,credentials:true,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token']});
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalFilters(new SafeErrors());
  app.enableShutdownHooks();
  const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Bonoful Optics API').setDescription('Versioned optical commerce API. Obtain a session and CSRF token at GET /api/v1/auth/session. Unsafe requests require WEB_ORIGIN and X-CSRF-Token. Administration permissions are checked by the backend. All monetary values in order/admin requests are integer paisa.').setVersion('1.0.0').addCookieAuth('bo_session').addApiKey({type:'apiKey',in:'header',name:'X-CSRF-Token'},'csrf').build());
  SwaggerModule.setup('api/docs',app,document,{jsonDocumentUrl:'api/openapi.json'});
  return app;
}
if(require.main===module) void createApp().then(app=>app.listen(config.PORT,config.HOST)).catch(()=>{process.stderr.write('API startup failed. Check environment configuration and database connectivity.\n');process.exit(1);});
