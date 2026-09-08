import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty() @IsEmail() email!:string;
  @ApiProperty() @IsString() @Length(1,128) password!:string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty() @IsString() @Length(2,100) name!:string;
  @ApiProperty() @Length(12,128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,{message:'Use at least 12 characters with upper case, lower case and a number.'}) declare password:string;
}
export class EmailDto { @ApiProperty() @IsEmail() email!:string; }
export class TokenDto { @ApiProperty() @IsString() @Length(64,64) token!:string; }
export class ResetDto extends TokenDto { @ApiProperty() @IsString() @Length(12,128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/) password!:string; }
export class ChangePasswordDto { @ApiProperty() @IsString() currentPassword!:string; @ApiProperty() @IsString() @Length(12,128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/) password!:string; }
