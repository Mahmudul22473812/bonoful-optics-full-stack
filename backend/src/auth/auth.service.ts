import { BadRequestException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { NotificationService } from '../core/notification.service';
import { AuthRequest, userView } from '../core/auth.guard';
import { digest, token } from '../core/security';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../core/config';
import { hash, verify, argon2id } from 'argon2';
import type { Response } from 'express';
import { LoginDto, RegisterDto } from './auth.dto';
import type { Tx } from '../core/prisma.service';
import type { User, VerificationChannel } from '@prisma/client';

export const hashPassword = (value:string) => hash(value,{type:argon2id,memoryCost:65536,timeCost:3,parallelism:1});
const OTP_TTL_MS=10*60_000;
const OTP_COOLDOWN_MS=60_000;
const OTP_MAX_ATTEMPTS=5;

export const generateVerificationOtp=()=>randomInt(0,1_000_000).toString().padStart(6,'0');
export const verificationOtpHash=(dataKey:string,userId:string,code:string)=>createHmac('sha256',Buffer.from(dataKey,'hex')).update(`otp:${userId}:ACCOUNT_VERIFY:${code}`).digest('hex');
export const verificationOtpMatches=(dataKey:string,userId:string,code:string,codeHash:string)=>{
  const expected=Buffer.from(codeHash,'hex'),received=Buffer.from(verificationOtpHash(dataKey,userId,code),'hex');
  return expected.length===received.length&&timingSafeEqual(expected,received);
};

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
  private otpHash(userId:string,code:string) { return verificationOtpHash(config.DATA_KEY,userId,code); }
  private normalizeIdentifier(value:string,channel:VerificationChannel) { return channel==='EMAIL'?value.trim().toLowerCase():value.replace(/[\s()-]/g,''); }
  private mask(value:string,channel:VerificationChannel) {
    if(channel==='EMAIL') { const [name,domain]=value.split('@'); return `${name.slice(0,2)}${'*'.repeat(Math.max(2,name.length-2))}@${domain}`; }
    return `${value.slice(0,3)}${'*'.repeat(Math.max(4,value.length-6))}${value.slice(-3)}`;
  }
  private async issueOtp(tx:Tx,user:User,channel:VerificationChannel,enforceCooldown:boolean) {
    if(config.NODE_ENV==='production'&&!this.mail.supports(channel)) throw new ServiceUnavailableException(channel==='EMAIL'?'Email verification is temporarily unavailable.':'Phone verification is temporarily unavailable.');
    const latest=await tx.verificationOtp.findFirst({where:{userId:user.id,purpose:'ACCOUNT_VERIFY',channel},orderBy:{createdAt:'desc'}});
    if(enforceCooldown&&latest&&latest.createdAt.getTime()+OTP_COOLDOWN_MS>Date.now()) {
      const retryAfter=Math.ceil((latest.createdAt.getTime()+OTP_COOLDOWN_MS-Date.now())/1000);
      throw new HttpException({message:'Please wait before requesting another OTP.',retryAfter},429);
    }
    const otp=generateVerificationOtp();
    await tx.verificationOtp.updateMany({where:{userId:user.id,purpose:'ACCOUNT_VERIFY',usedAt:null},data:{usedAt:new Date()}});
    await tx.verificationOtp.create({data:{userId:user.id,channel,purpose:'ACCOUNT_VERIFY',codeHash:this.otpHash(user.id,otp),expiresAt:new Date(Date.now()+OTP_TTL_MS)}});
    if(channel==='EMAIL') await this.mail.enqueue(tx,user.email,'Your Bonoful Optics verification code',`Your verification code is ${otp}. It expires in 10 minutes. If you did not request this code, ignore this message.`,user.id);
    else await this.mail.enqueueSms(tx,user.phone!,`Your Bonoful Optics verification code is ${otp}. It expires in 10 minutes.`,user.id);
    return {message:'OTP sent successfully.',method:channel,identifier:this.mask(channel==='EMAIL'?user.email:user.phone!,channel),cooldownSeconds:60};
  }
  async register(dto:RegisterDto) {
    const email=dto.email.trim().toLowerCase();
    const channel=dto.verificationMethod as VerificationChannel;
    const phone=dto.phone?this.normalizeIdentifier(dto.phone,'PHONE'):undefined;
    if(channel==='PHONE'&&!phone) throw new BadRequestException('A phone number is required for phone verification.');
    const passwordHash=await hashPassword(dto.password);
    return this.db.atomic(async(tx)=>{
      const user=await tx.user.create({data:{email,phone,name:dto.name.trim(),passwordHash,roleId:'customer'}});
      return this.issueOtp(tx,user,channel,false);
    });
  }
  async resendOtp(identifier:string,channel:VerificationChannel) {
    const value=this.normalizeIdentifier(identifier,channel);
    const user=await this.db.user.findFirst({where:channel==='EMAIL'?{email:value}:{phone:value}});
    if(!user||!user.active) return {message:'OTP sent successfully.',method:channel,identifier:this.mask(value,channel),cooldownSeconds:60};
    if(user.verifiedAt) return {message:'OTP sent successfully.',method:channel,identifier:this.mask(value,channel),cooldownSeconds:60};
    return this.db.atomic(tx=>this.issueOtp(tx,user,channel,true));
  }
  async verifyOtp(identifier:string,channel:VerificationChannel,otp:string) {
    const value=this.normalizeIdentifier(identifier,channel);
    const user=await this.db.user.findFirst({where:channel==='EMAIL'?{email:value}:{phone:value}});
    if(!user||!user.active) throw new BadRequestException('Incorrect OTP.');
    if(user.verifiedAt) return {message:'Account verified successfully.'};
    const result=await this.db.atomic(async tx=>{
      const record=await tx.verificationOtp.findFirst({where:{userId:user.id,purpose:'ACCOUNT_VERIFY',channel,usedAt:null},orderBy:{createdAt:'desc'}});
      if(!record) return {error:'Incorrect OTP.',status:400};
      if(record.expiresAt<=new Date()) { await tx.verificationOtp.update({where:{id:record.id},data:{usedAt:new Date()}}); return {error:'OTP expired. Request a new code.',status:400}; }
      if(record.attempts>=OTP_MAX_ATTEMPTS) { await tx.verificationOtp.update({where:{id:record.id},data:{usedAt:new Date()}}); return {error:'Too many incorrect attempts. Request a new OTP.',status:429}; }
      if(!verificationOtpMatches(config.DATA_KEY,user.id,otp,record.codeHash)) {
        const attempts=record.attempts+1;
        await tx.verificationOtp.update({where:{id:record.id},data:{attempts,...(attempts>=OTP_MAX_ATTEMPTS?{usedAt:new Date()}:{})}});
        return {error:attempts>=OTP_MAX_ATTEMPTS?'Too many incorrect attempts. Request a new OTP.':'Incorrect OTP.',status:attempts>=OTP_MAX_ATTEMPTS?429:400};
      }
      const consumed=await tx.verificationOtp.updateMany({where:{id:record.id,usedAt:null},data:{usedAt:new Date()}});
      if(consumed.count!==1) return {error:'Incorrect OTP.',status:400};
      await tx.verificationOtp.updateMany({where:{userId:user.id,purpose:'ACCOUNT_VERIFY',usedAt:null},data:{usedAt:new Date()}});
      const verifiedAt=new Date();
      await tx.user.update({where:{id:user.id},data:{verifiedAt,...(channel==='PHONE'?{phoneVerifiedAt:verifiedAt}:{emailVerifiedAt:verifiedAt})}});
      return {message:'Account verified successfully.'};
    });
    if('error' in result&&result.error) throw new HttpException(result.error,result.status??400);
    return result;
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
  async consume(raw:string,kind:'RESET',password?:string) {
    const passwordHash=password?await hashPassword(password):undefined;
    await this.db.atomic(async(tx)=>{
      const record=await tx.authToken.findUnique({where:{tokenHash:digest(raw)}});
      if(!record||record.kind!==kind||record.usedAt||record.expiresAt<=new Date()) throw new BadRequestException('This link is invalid or has expired.');
      await tx.authToken.update({where:{id:record.id},data:{usedAt:new Date()}});
      await tx.user.update({where:{id:record.userId},data:{passwordHash}});
      await tx.session.deleteMany({where:{userId:record.userId}});
    });
    return {message:'Password reset. Sign in with your new password.'};
  }
  async change(req:AuthRequest,current:string,password:string) {
    if(!req.actor||!await verify(req.actor.passwordHash,current)) throw new BadRequestException('Current password is incorrect.');
    const passwordHash=await hashPassword(password);
    await this.db.atomic(async(tx)=>{await tx.user.update({where:{id:req.actor!.id},data:{passwordHash}});await tx.session.deleteMany({where:{userId:req.actor!.id,id:{not:req.session.id}}});});
    return {message:'Password changed. Other sessions have been signed out.'};
  }
}
