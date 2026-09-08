import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutAddressDto {
  @ApiProperty() @IsString() @Length(2,100) name!:string;
  @ApiProperty() @IsString() @Matches(/^[+\d\s()-]{7,25}$/) phone!:string;
  @ApiProperty() @IsString() @Length(5,200) line1!:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,200) line2?:string;
  @ApiProperty() @IsString() @Length(2,80) city!:string;
  @ApiProperty() @IsString() @Length(2,12) postalCode!:string;
  @ApiProperty() @IsIn(['BD']) country!:string;
}
export class CheckoutDto {
  @ApiProperty() @IsUUID() idempotencyKey!:string;
  @ApiProperty() @ValidateNested() @Type(()=>CheckoutAddressDto) shippingAddress!:CheckoutAddressDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(()=>CheckoutAddressDto) billingAddress?:CheckoutAddressDto;
  @ApiProperty({enum:['delivery','pickup']}) @IsIn(['delivery','pickup']) deliveryMethod!:string;
  @ApiProperty({enum:['COD']}) @IsIn(['COD']) paymentMethod!:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,40) coupon?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,500) note?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() prescriptionId?:string;
}

