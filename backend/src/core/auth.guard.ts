import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Prisma, Session } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { digest, matches } from './security';
import { config } from './config';

export const Public = () => SetMetadata('public',true);
export const AllowGuest = () => SetMetadata('guest',true);
export const Require = (...permissions:string[]) => SetMetadata('permissions',permissions);
export type Actor = Prisma.UserGetPayload<{include:{role:{include:{permissions:true}}}}>;
export type AuthRequest = Request & { session:Session; actor?:Actor };
export const hasPermission = (actor:Actor,permission:string) => actor.role.permissions.some((p)=>p.permissionId===permission);
export function userView(actor:Actor) { return {id:actor.id,email:actor.email,name:actor.name,phone:actor.phone,verified:!!actor.verifiedAt,role:actor.role.name,roleId:actor.roleId,permissions:actor.role.permissions.map((p)=>p.permissionId)}; }

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db:PrismaService,private readonly reflector:Reflector) {}
  async canActivate(context:ExecutionContext) {
    const request=context.switchToHttp().getRequest<AuthRequest>();
    const publicRoute=this.reflector.getAllAndOverride<boolean>('public',[context.getHandler(),context.getClass()]);
    const unsafe=!['GET','HEAD','OPTIONS'].includes(request.method);
    if(unsafe && request.headers.origin!==config.WEB_ORIGIN) throw new ForbiddenException('Untrusted request origin.');
    const raw = request.cookies?.bo_session as unknown;
    if(typeof raw==='string') {
      const session=await this.db.session.findUnique({where:{tokenHash:digest(raw)},include:{user:{include:{role:{include:{permissions:true}}}}}});
      if(session && session.expiresAt>new Date()) {
        request.session=session;
        if(session.user?.active) request.actor=session.user;
      }
    }
    if(publicRoute) return true;
    if(!request.session) throw new UnauthorizedException('Your session has expired. Refresh and sign in again.');
    if(unsafe) { const csrf=request.headers['x-csrf-token']; if(typeof csrf!=='string'||!matches(csrf,request.session.csrfHash)) throw new ForbiddenException('Invalid request token. Refresh the page.'); }
    const guest=this.reflector.getAllAndOverride<boolean>('guest',[context.getHandler(),context.getClass()]);
    if(!request.actor && !guest) throw new UnauthorizedException('Please sign in to continue.');
    const permissions=this.reflector.getAllAndOverride<string[]>('permissions',[context.getHandler(),context.getClass()])??[];
    if(permissions.some((permission)=>!request.actor||!hasPermission(request.actor,permission))) throw new ForbiddenException('You do not have permission for this action.');
    return true;
  }
}

