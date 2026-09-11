import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest, Public } from '../core/auth.guard';
import { RateLimitService } from '../core/rate-limit.service';
import { PrismaService } from '../core/prisma.service';
import { ChangePasswordDto, EmailDto, LoginDto, OtpRequestDto, OtpVerifyDto, RegisterDto, ResetDto } from './auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth:AuthService,private readonly rate:RateLimitService,private readonly db:PrismaService) {}
  @Public() @Get('session') bootstrap(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) { return this.auth.bootstrap(req,res); }
  @Public() @Post('register') async register(@Body() dto:RegisterDto,@Req() req:AuthRequest) { await this.rate.check('register-ip',req.ip??'unknown',5,30); await this.rate.check('register-email',dto.email.toLowerCase(),3,30); return this.auth.register(dto); }
  @Public() @Post('login') async login(@Body() dto:LoginDto,@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) { await this.rate.check('login-ip',req.ip??'unknown',30); await this.rate.check('login-email',dto.email.toLowerCase(),10); return this.auth.login(dto,req,res); }
  @Post('logout') async logout(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) { await this.db.session.deleteMany({where:{id:req.session.id}}); res.clearCookie('bo_session',{path:'/'}); return {message:'Signed out.'}; }
  @Public() @Post('forgot-password') async forgot(@Body() dto:EmailDto,@Req() req:AuthRequest) { await this.rate.check('forgot',req.ip??'unknown',5);return this.auth.forgot(dto.email); }
  @Public() @Post('reset-password') async reset(@Body() dto:ResetDto,@Req() req:AuthRequest) { await this.rate.check('reset',req.ip??'unknown',10);return this.auth.consume(dto.token,'RESET',dto.password); }
  @Public() @Post('request-verification-otp') async requestOtp(@Body() dto:OtpRequestDto,@Req() req:AuthRequest) { const key=dto.identifier.toLowerCase().replace(/[\s()-]/g,''); await this.rate.check('otp-send-ip',req.ip??'unknown',10,60); await this.rate.check('otp-send-account',`${dto.method}:${key}`,5,60); return this.auth.resendOtp(dto.identifier,dto.method); }
  @Public() @Post('verify-account-otp') async verifyOtp(@Body() dto:OtpVerifyDto,@Req() req:AuthRequest) { const key=dto.identifier.toLowerCase().replace(/[\s()-]/g,''); await this.rate.check('otp-verify-ip',req.ip??'unknown',30,15); await this.rate.check('otp-verify-account',`${dto.method}:${key}`,10,15); return this.auth.verifyOtp(dto.identifier,dto.method,dto.otp); }
  @Post('change-password') change(@Body() dto:ChangePasswordDto,@Req() req:AuthRequest) {return this.auth.change(req,dto.currentPassword,dto.password);}
}
