import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class SafeErrors implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    let status = 500;
    let message: string | string[] = 'We could not complete this request. Please try again.';
    if (error instanceof HttpException) { status = error.getStatus(); const body=error.getResponse(); message=typeof body==='string'?body:(body as {message?:string|string[]}).message ?? error.message; }
    else if (error instanceof ZodError) { status=400; message=error.issues.map((issue)=>`${issue.path.join('.')}: ${issue.message}`); }
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code==='P2002') { status=409; message='A record with those details already exists.'; }
      if (error.code==='P2025') { status=404; message='That record was not found.'; }
      if (error.code==='P2003') { status=400; message='A referenced record is invalid or still in use.'; }
    }
    if(status===500) this.logger.error({requestId,kind:error instanceof Error?error.name:'UnknownError'});
    response.status(status).json({error:{status,message,requestId}});
  }
}

