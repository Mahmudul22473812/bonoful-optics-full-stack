import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AllowGuest, AuthRequest } from '../core/auth.guard';
import { PrismaService } from '../core/prisma.service';
import { productInclude, productView } from '../catalog/catalog.service';
import { CartService } from './cart.service';
import { OrderService, orderInclude, orderView } from './order.service';
import { CheckoutDto } from './order.dto';

@ApiTags('Commerce') @Controller()
export class CommerceController {
  constructor(private readonly db:PrismaService,private readonly cart:CartService,private readonly orders:OrderService) {}
  @AllowGuest() @Get('cart') getCart(@Req() req:AuthRequest) {return this.cart.get(req.session.id,req.actor?.id);}
  @AllowGuest() @Post('cart') changeCart(@Req() req:AuthRequest,@Body() body:unknown) {return this.cart.change(req.session.id,body,req.actor?.id);}
  @Get('wishlist') async wishlist(@Req() req:AuthRequest) {const list=await this.db.wishlist.findUnique({where:{userId:req.actor!.id},include:{items:{include:{product:{include:productInclude}}}}});return {items:list?.items.filter(i=>i.product.active&&!i.product.archivedAt).map(i=>productView(i.product))??[]};}
  @Post('wishlist') async changeWishlist(@Req() req:AuthRequest,@Body() body:unknown) {const {productId,saved}=z.object({productId:z.string(),saved:z.boolean()}).strict().parse(body);await this.db.atomic(async(tx)=>{const wishlist=await tx.wishlist.upsert({where:{userId:req.actor!.id},create:{userId:req.actor!.id},update:{}});if(saved)await tx.wishlistItem.upsert({where:{wishlistId_productId:{wishlistId:wishlist.id,productId}},create:{wishlistId:wishlist.id,productId},update:{}});else await tx.wishlistItem.deleteMany({where:{wishlistId:wishlist.id,productId}});});return this.wishlist(req);}
  @Post('checkout/quote') quote(@Req() req:AuthRequest,@Body() body:unknown) {return this.orders.quote(req,body);}
  @Post('checkout') checkout(@Req() req:AuthRequest,@Body() body:CheckoutDto) {return this.orders.checkout(req,body);}
  @Get('orders') async list(@Req() req:AuthRequest,@Query('page') page='1') {const p=z.coerce.number().int().min(1).parse(page);const where={userId:req.actor!.id};const [items,total]=await Promise.all([this.db.order.findMany({where,include:orderInclude,orderBy:{createdAt:'desc'},take:20,skip:(p-1)*20}),this.db.order.count({where})]);return {items:items.map(orderView),total,page:p};}
  @Get('orders/:id') async get(@Req() req:AuthRequest,@Param('id') id:string) {const order=await this.db.order.findFirst({where:{id,userId:req.actor!.id},include:orderInclude});if(!order)throw new NotFoundException('Order not found.');return orderView(order);}
  @Post('orders/:id/cancel') cancel(@Req() req:AuthRequest,@Param('id') id:string) {return this.orders.transition(id,'CANCELLED',req.actor!.id,{note:'Cancelled by customer'},true);}
}
