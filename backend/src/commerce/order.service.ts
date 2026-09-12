import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PrismaService, Tx } from '../core/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../core/notification.service';
import { AuthRequest } from '../core/auth.guard';
import { config } from '../core/config';
import { calculateTotals, reachableOrderStatuses } from './calculations';
import { CheckoutDto } from './order.dto';

export const orderInclude={items:true,histories:{orderBy:{createdAt:'asc'},select:{status:true,note:true,createdAt:true}},payments:{select:{id:true,status:true,provider:true,amount:true,refunds:true}}} satisfies Prisma.OrderInclude;
export const orderView=(order:Prisma.OrderGetPayload<{include:typeof orderInclude}>)=>{
  const {internalNote:_,idempotencyKey:__,...visible}=order;
  return {...visible,items:order.items.map(({prescriptionId:___,...item})=>item)};
};

@Injectable()
export class OrderService {
  constructor(private readonly db:PrismaService,private readonly inventory:InventoryService,private readonly notifications:NotificationService) {}
  private async quoteIn(tx:Tx,userId:string,sessionId:string,code:string|undefined,deliveryMethod:string) {
    const cart=await tx.cart.findFirst({where:{userId},include:{items:{include:{variant:{include:{product:true,inventory:{where:{locationId:'main'}}}}}}}});
    if(!cart?.items.length) throw new BadRequestException('Your bag is empty.');
    for(const item of cart.items) if(!item.variant.active||!item.variant.product.active||item.variant.product.archivedAt||item.quantity>item.variant.inventory.reduce((n,i)=>n+i.onHand-i.reserved,0)) throw new ConflictException(`${item.variant.product.name} is no longer available in the requested quantity.`);
    const coupon=code?await tx.coupon.findUnique({where:{code:code.trim().toUpperCase()},include:{products:true,categories:true}}):null;
    if(code && (!coupon||!coupon.active||coupon.startsAt>new Date()||coupon.endsAt<=new Date())) throw new BadRequestException('This coupon is invalid or has expired.');
    if(coupon) {
      const [all,own]=await Promise.all([tx.couponUsage.count({where:{couponId:coupon.id}}),tx.couponUsage.count({where:{couponId:coupon.id,userId}})]);
      if(all>=coupon.usageLimit||own>=coupon.perCustomerLimit) throw new BadRequestException('Coupon usage limit reached.');
    }
    const totals=calculateTotals(cart.items.map(item=>({unitPrice:item.variant.salePrice??item.variant.price,quantity:item.quantity,eligible:!coupon||(!coupon.products.length&&!coupon.categories.length)||coupon.products.some(p=>p.productId===item.variant.productId)||coupon.categories.some(c=>c.categoryId===item.variant.product.categoryId)})),coupon,config.TAX_BPS,deliveryMethod,config.SHIPPING_FEE,config.FREE_SHIPPING_MINIMUM);
    return {cart,coupon,totals};
  }
  async quote(req:AuthRequest,body:unknown) {const q=z.object({coupon:z.string().max(40).optional(),deliveryMethod:z.enum(['delivery','pickup']).default('delivery')}).strict().parse(body);return this.db.atomic(async(tx)=>(await this.quoteIn(tx,req.actor!.id,req.session.id,q.coupon,q.deliveryMethod)).totals);}
  async checkout(req:AuthRequest,data:CheckoutDto) {
    if(!req.actor!.verifiedAt) throw new BadRequestException('Verify your email before placing an order.');
    try {
      return await this.db.atomic(async(tx)=>{
        const existing=await tx.order.findUnique({where:{idempotencyKey:data.idempotencyKey},include:orderInclude});
        if(existing) {if(existing.userId!==req.actor!.id) throw new ConflictException('Invalid checkout key.');return orderView(existing);}
        const {cart,coupon,totals}=await this.quoteIn(tx,req.actor!.id,req.session.id,data.coupon,data.deliveryMethod);
        if(data.prescriptionId && !await tx.prescription.findFirst({where:{id:data.prescriptionId,userId:req.actor!.id}})) throw new BadRequestException('Prescription not found.');
        if(data.prescriptionId && !cart.items.some(i=>i.variant.product.prescriptionAllowed)) throw new BadRequestException('These products do not accept a prescription.');
        const order=await tx.order.create({data:{number:`BO-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`,idempotencyKey:data.idempotencyKey,userId:req.actor!.id,...totals,shippingAddress:{...data.shippingAddress},billingAddress:{...(data.billingAddress??data.shippingAddress)},deliveryMethod:data.deliveryMethod,customerNote:data.note,items:{create:cart.items.map(item=>({variantId:item.variantId,quantity:item.quantity,name:item.variant.product.name,sku:item.variant.sku,color:item.variant.color,size:item.variant.size,unitPrice:item.variant.salePrice??item.variant.price,prescriptionId:item.variant.product.prescriptionAllowed?data.prescriptionId:undefined}))},histories:{create:{status:'PENDING',actorId:req.actor!.id,note:'Order placed'}},payments:{create:{provider:'COD',amount:totals.total,status:'PENDING'}}}});
        for(const item of [...cart.items].sort((a,b)=>a.variantId.localeCompare(b.variantId))) await this.inventory.move(tx,item.variantId,0,item.quantity,'RESERVATION','Checkout reservation',req.actor!.id,order.id);
        if(coupon) await tx.couponUsage.create({data:{couponId:coupon.id,userId:req.actor!.id,orderId:order.id}});
        await tx.cartItem.deleteMany({where:{cartId:cart.id}});
        await this.notifications.enqueue(tx,req.actor!.email,`Order ${order.number} received`,`Thank you. Track your order at ${config.WEB_ORIGIN}/account/orders/${order.id}`,req.actor!.id);
        return orderView(await tx.order.findUniqueOrThrow({where:{id:order.id},include:orderInclude}));
      });
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002') {const existing=await this.db.order.findFirst({where:{idempotencyKey:data.idempotencyKey,userId:req.actor!.id},include:orderInclude});if(existing)return orderView(existing);}
      throw error;
    }
  }
  async transition(id:string,status:OrderStatus,actorId:string,body:unknown,customer=false) {
    const data=z.object({note:z.string().trim().max(500).optional(),trackingNumber:z.string().trim().max(100).optional(),restock:z.boolean().default(false)}).strict().parse(body);
    return this.db.atomic(async(tx)=>{
      const order=await tx.order.findFirst({where:{id,...(customer?{userId:actorId}:{})},include:{items:true,user:true,payments:true}});
      if(!order) throw new NotFoundException('Order not found.');
      if(customer && (status!=='CANCELLED'||!['PENDING','CONFIRMED'].includes(order.status))) throw new BadRequestException('This order can no longer be cancelled online.');
      if(!reachableOrderStatuses(order.status).includes(status)) throw new BadRequestException(`Cannot change ${order.status} to ${status}.`);
      if(status==='REFUNDED' && !data.note) throw new BadRequestException('A refund reason is required.');
      const fulfilsNow=['SHIPPED','DELIVERED','REFUNDED'].includes(status)&&!['SHIPPED','DELIVERED','REFUNDED'].includes(order.status);
      for(const item of [...order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId))) {
        if(status==='CANCELLED') await this.inventory.move(tx,item.variantId,0,-item.quantity,'RELEASE','Order cancelled',actorId,id);
        if(fulfilsNow) await this.inventory.move(tx,item.variantId,-item.quantity,-item.quantity,'SHIPMENT','Order fulfilled',actorId,id);
        if(status==='REFUNDED'&&data.restock) await this.inventory.move(tx,item.variantId,item.quantity,0,'RETURN',data.note!,actorId,id);
      }
      if(status==='CANCELLED') {await tx.couponUsage.deleteMany({where:{orderId:id}});await tx.payment.updateMany({where:{orderId:id,status:'PENDING'},data:{status:'CANCELLED'}});}
      if(status==='DELIVERED') await tx.payment.updateMany({where:{orderId:id,provider:'COD',status:'PENDING'},data:{status:'PAID'}});
      if(status==='REFUNDED') { const payment=order.payments.find(p=>p.status==='PAID');if(!payment)throw new BadRequestException('No settled payment to refund.');await tx.refund.create({data:{paymentId:payment.id,amount:payment.amount,reason:data.note!,restocked:data.restock,status:'REQUESTED'}});await tx.payment.update({where:{id:payment.id},data:{status:'REFUND_PENDING'}}); }
      await tx.order.update({where:{id},data:{status,trackingNumber:data.trackingNumber,histories:{create:{status,note:data.note??'Status updated',actorId}}}});
      await tx.auditLog.create({data:{actorId,action:'orders.status',entity:'order',entityId:id,detail:{orderNumber:order.number,from:order.status,to:status,restock:data.restock}}});
      await this.notifications.enqueue(tx,order.user.email,`${order.number}: ${status.toLowerCase()}`,`Your order status is now ${status.toLowerCase()}.`,order.userId);
      return orderView(await tx.order.findUniqueOrThrow({where:{id},include:orderInclude}));
    });
  }
}
