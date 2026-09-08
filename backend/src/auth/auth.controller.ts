import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest, Public } from '../core/auth.guard';
import { RateLimitService } from '../core/rate-limit.service';
import { PrismaService } from '../core/prisma.service';
import { ChangePasswordDto, EmailDto, LoginDto, RegisterDto, ResetDto, TokenDto } from './auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth:AuthService,private readonly rate:RateLimitService,private readonly db:PrismaService) {}
  @Public() @Get('session') bootstrap(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) { return this.auth.bootstrap(req,res); }
  @Public() @Post('register') async register(@Body() dto:RegisterDto,@Req() req:AuthRequest) { await this.rate.check('register',req.ip??'unknown'); return this.auth.register(dto); }
  @Public() @Post('login') async login(@Body() dto:LoginDto,@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) { await this.rate.check('login-ip',req.ip??'unknown',30); await this.rate.check('login-email',dto.email.toLowerCase(),10); return this.auth.login(dto,req,res); }
  @Post('logout') async logout(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) { await this.db.session.deleteMany({where:{id:req.session.id}}); res.clearCookie('bo_session',{path:'/'}); return {message:'Signed out.'}; }
  @Public() @Post('forgot-password') async forgot(@Body() dto:EmailDto,@Req() req:AuthRequest) { await this.rate.check('forgot',req.ip??'unknown',5);return this.auth.forgot(dto.email); }
  @Public() @Post('reset-password') async reset(@Body() dto:ResetDto,@Req() req:AuthRequest) { await this.rate.check('reset',req.ip??'unknown',10);return this.auth.consume(dto.token,'RESET',dto.password); }
  @Public() @Post('verify-email') verify(@Body() dto:TokenDto) {return this.auth.consume(dto.token,'VERIFY');}
  @Post('change-password') change(@Body() dto:ChangePasswordDto,@Req() req:AuthRequest) {return this.auth.change(req,dto.currentPassword,dto.password);}
}

