import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty() @IsEmail() email!:string;
  @ApiProperty() @IsString() @Length(1,128) password!:string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty() @IsString() @Length(2,100) name!:string;
  @ApiProperty({required:false}) @IsOptional() @IsString() @Matches(/^\+?[1-9]\d{7,14}$/,{message:'Use an international phone number, for example +8801XXXXXXXXX.'}) phone?:string;
  @ApiProperty({enum:['EMAIL','PHONE']}) @IsIn(['EMAIL','PHONE']) verificationMethod:'EMAIL'|'PHONE'='EMAIL';
  @ApiProperty() @Length(12,128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,{message:'Use at least 12 characters with upper case, lower case and a number.'}) declare password:string;
}
export class OtpRequestDto {
  @ApiProperty() @IsString() @Length(3,254)
  @ValidateIf(value=>value.method==='EMAIL') @IsEmail({}, {message:'Enter a valid email address.'})
  @ValidateIf(value=>value.method==='PHONE') @Matches(/^\+?[1-9]\d{7,14}$/,{message:'Use an international phone number, for example +8801XXXXXXXXX.'})
  identifier!:string;
  @ApiProperty({enum:['EMAIL','PHONE']}) @IsIn(['EMAIL','PHONE']) method!:'EMAIL'|'PHONE';
}
export class OtpVerifyDto extends OtpRequestDto {
  @ApiProperty() @IsString() @Matches(/^\d{6}$/,{message:'Enter the six-digit OTP.'}) otp!:string;
}
export class EmailDto { @ApiProperty() @IsEmail() email!:string; }
export class TokenDto { @ApiProperty() @IsString() @Length(64,64) token!:string; }
export class ResetDto extends TokenDto { @ApiProperty() @IsString() @Length(12,128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/) password!:string; }
export class ChangePasswordDto { @ApiProperty() @IsString() currentPassword!:string; @ApiProperty() @IsString() @Length(12,128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/) password!:string; }
