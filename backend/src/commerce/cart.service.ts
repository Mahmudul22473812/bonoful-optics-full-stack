import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { z } from 'zod';
import { productInclude, productView } from '../catalog/catalog.service';

@Injectable()
export class CartService {
  constructor(private readonly db:PrismaService) {}
  async get(sessionId:string,userId?:string) {
    const cart=await this.db.cart.findFirst({where:userId?{userId}:{sessionId},include:{items:{include:{variant:{include:{product:{include:productInclude},inventory:{where:{locationId:'main'}}}}}}}});
    const items=(cart?.items??[]).map(item=>({id:item.id,quantity:item.quantity,variantId:item.variantId,product:{...productView(item.variant.product),variantId:item.variantId,price:item.variant.price/100,salePrice:item.variant.salePrice==null?undefined:item.variant.salePrice/100,color:item.variant.color,size:item.variant.size,stock:item.variant.inventory.reduce((n,i)=>n+i.onHand-i.reserved,0),tone:item.variant.tone},available:item.variant.active&&item.variant.product.active&&!item.variant.product.archivedAt}));
    return {items,subtotal:items.reduce((n,i)=>n+(i.product.salePrice??i.product.price)*i.quantity,0)};
  }
  async change(sessionId:string,body:unknown,userId?:string) {
    const data=z.object({action:z.enum(['add','set','remove']),variantId:z.string(),quantity:z.number().int().min(1).max(50).optional()}).strict().parse(body);
    await this.db.atomic(async(tx)=>{
      const cart=await tx.cart.findFirstOrThrow({where:userId?{userId}:{sessionId}});
      if(data.action==='remove') {await tx.cartItem.deleteMany({where:{cartId:cart.id,variantId:data.variantId}});return;}
      const variant=await tx.productVariant.findFirst({where:{id:data.variantId,active:true,product:{active:true,archivedAt:null}},include:{inventory:{where:{locationId:'main'}}}});
      if(!variant) throw new BadRequestException('This variant is no longer available.');
      const old=await tx.cartItem.findUnique({where:{cartId_variantId:{cartId:cart.id,variantId:variant.id}}});
      const quantity=(data.quantity??1)+(data.action==='add'?(old?.quantity??0):0);
      if(quantity>50||quantity>variant.inventory.reduce((n,i)=>n+i.onHand-i.reserved,0)) throw new BadRequestException('Requested quantity is not available.');
      await tx.cartItem.upsert({where:{cartId_variantId:{cartId:cart.id,variantId:variant.id}},create:{cartId:cart.id,variantId:variant.id,quantity},update:{quantity}});
    });
    return this.get(sessionId,userId);
  }
}
