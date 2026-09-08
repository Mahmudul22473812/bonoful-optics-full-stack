import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { NotificationService } from '../core/notification.service';
import { AuthRequest, userView } from '../core/auth.guard';
import { digest, token } from '../core/security';
import { createHmac } from 'node:crypto';
import { config } from '../core/config';
import { hash, verify, argon2id } from 'argon2';
import type { Response } from 'express';
import { LoginDto, RegisterDto } from './auth.dto';

export const hashPassword = (value:string) => hash(value,{type:argon2id,memoryCost:65536,timeCost:3,parallelism:1});

@Injectable()
export class AuthService {
  constructor(private readonly db:PrismaService,private readonly mail:NotificationService) {}
  async bootstrap(req:AuthRequest,res:Response) {
    if(req.session) {
      const csrf=this.csrf(req.session.tokenHash);
      await this.db.session.update({where:{id:req.session.id},data:{csrfHash:digest(csrf)}});
      return {csrf,user:req.actor?userView(req.actor):null};
    }
    const csrf=await this.createSession(res);
    return {csrf,user:null};
  }
  private csrf(tokenHash:string) { return createHmac('sha256',Buffer.from(config.DATA_KEY,'hex')).update(`csrf:${tokenHash}`).digest('hex'); }
  private async createSession(res:Response,userId?:string,oldId?:string) {
    const raw=token();
    const csrf=this.csrf(digest(raw));
    const expiresAt=new Date(Date.now()+7*86400000);
    await this.db.atomic(async(tx)=>{
      const session=await tx.session.create({data:{tokenHash:digest(raw),csrfHash:digest(csrf),userId,expiresAt}});
      const guestCart=oldId?await tx.cart.findUnique({where:{sessionId:oldId},include:{items:true}}):null;
      const userCart=userId?await tx.cart.findFirst({where:{userId},orderBy:{updatedAt:'desc'},include:{items:true}}):null;
      const cart=userCart??await tx.cart.create({data:{sessionId:userId?null:session.id,userId}});
      const merged=new Map<string,number>();
      for(const item of [...(userCart?.items??[]),...(guestCart&&!guestCart.userId?guestCart.items:[])]) merged.set(item.variantId,Math.min(50,(merged.get(item.variantId)??0)+item.quantity));
      await tx.cartItem.deleteMany({where:{cartId:cart.id}});
      if(merged.size) await tx.cartItem.createMany({data:[...merged].map(([variantId,quantity])=>({cartId:cart.id,variantId,quantity}))});
      if(userId) await tx.cart.update({where:{id:cart.id},data:{sessionId:null}});
      if(guestCart&&!guestCart.userId) await tx.cart.delete({where:{id:guestCart.id}});
      if(oldId) await tx.session.deleteMany({where:{id:oldId}});
    });
    res.cookie('bo_session',raw,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',path:'/',expires:expiresAt});
    return csrf;
  }
  async register(dto:RegisterDto) {
    const email=dto.email.trim().toLowerCase();
    const passwordHash=await hashPassword(dto.password);
    await this.db.atomic(async(tx)=>{
      const user=await tx.user.create({data:{email,name:dto.name.trim(),passwordHash,roleId:'customer'}});
      const raw=token();
      await tx.authToken.create({data:{userId:user.id,tokenHash:digest(raw),kind:'VERIFY',expiresAt:new Date(Date.now()+86400000)}});
      await this.mail.enqueue(tx,email,'Verify your Bonoful Optics email',`Verify your email: ${config.WEB_ORIGIN}/verify-email?token=${raw}`,user.id);
    });
    return {message:'Account created. Check your email for a verification link, then sign in.'};
  }
  async login(dto:LoginDto,req:AuthRequest,res:Response) {
    const user=await this.db.user.findUnique({where:{email:dto.email.trim().toLowerCase()},include:{role:{include:{permissions:true}}}});
    // Hash a non-user input as well so unknown accounts do not get a fast path.
    const valid=user?await verify(user.passwordHash,dto.password):await hashPassword(dto.password).then(()=>false);
    if(!user||!valid||!user.active) throw new UnauthorizedException('Email or password is incorrect.');
    const csrf=await this.createSession(res,user.id,req.session?.id);
    return {user:userView(user),csrf};
  }
  async forgot(email:string) {
    const user=await this.db.user.findUnique({where:{email:email.trim().toLowerCase()}});
    if(user?.active) await this.db.atomic(async(tx)=>{
      const raw=token();
      await tx.authToken.updateMany({where:{userId:user.id,kind:'RESET',usedAt:null},data:{usedAt:new Date()}});
      await tx.authToken.create({data:{userId:user.id,kind:'RESET',tokenHash:digest(raw),expiresAt:new Date(Date.now()+30*60000)}});
      await this.mail.enqueue(tx,user.email,'Reset your Bonoful Optics password',`This link expires in 30 minutes: ${config.WEB_ORIGIN}/reset-password?token=${raw}`);
    });
    return {message:'If that email is registered, a reset link has been queued.'};
  }
  async consume(raw:string,kind:'VERIFY'|'RESET',password?:string) {
    const passwordHash=password?await hashPassword(password):undefined;
    await this.db.atomic(async(tx)=>{
      const record=await tx.authToken.findUnique({where:{tokenHash:digest(raw)}});
      if(!record||record.kind!==kind||record.usedAt||record.expiresAt<=new Date()) throw new BadRequestException('This link is invalid or has expired.');
      await tx.authToken.update({where:{id:record.id},data:{usedAt:new Date()}});
      await tx.user.update({where:{id:record.userId},data:kind==='VERIFY'?{verifiedAt:new Date()}:{passwordHash}});
      if(kind==='RESET') await tx.session.deleteMany({where:{userId:record.userId}});
    });
    return {message:kind==='VERIFY'?'Email verified. You can sign in.':'Password reset. Sign in with your new password.'};
  }
  async change(req:AuthRequest,current:string,password:string) {
    if(!req.actor||!await verify(req.actor.passwordHash,current)) throw new BadRequestException('Current password is incorrect.');
    const passwordHash=await hashPassword(password);
    await this.db.atomic(async(tx)=>{await tx.user.update({where:{id:req.actor!.id},data:{passwordHash}});await tx.session.deleteMany({where:{userId:req.actor!.id,id:{not:req.session.id}}});});
    return {message:'Password changed. Other sessions have been signed out.'};
  }
}
