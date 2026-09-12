import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { PrismaService, Tx } from '../core/prisma.service';
import { z } from 'zod';

@Injectable()
export class InventoryService {
  constructor(private readonly db:PrismaService) {}
  async move(tx:Tx,variantId:string,onHandChange:number,reservedChange:number,type:MovementType,reason:string,actorId?:string,reference?:string) {
    const inventory=await tx.inventory.findUnique({where:{variantId_locationId:{variantId,locationId:'main'}}});
    if(!inventory) throw new NotFoundException('Inventory record not found.');
    const after=inventory.onHand+onHandChange,reservedAfter=inventory.reserved+reservedChange;
    if(after<0 || reservedAfter<0 || reservedAfter>after) throw new ConflictException('Insufficient available stock. Please refresh your bag.');
    const changed=await tx.inventory.updateMany({where:{id:inventory.id,onHand:inventory.onHand,reserved:inventory.reserved},data:{onHand:after,reserved:reservedAfter}});
    if(changed.count!==1) throw new ConflictException('Stock changed during the operation. Please retry.');
    await tx.inventoryMovement.create({data:{inventoryId:inventory.id,type,before:inventory.onHand,change:onHandChange,after,reservedBefore:inventory.reserved,reservedChange,reservedAfter,reason,actorId,reference}});
    if(after-reservedAfter<=inventory.lowThreshold && inventory.onHand-inventory.reserved>inventory.lowThreshold) await tx.notification.create({data:{title:'Low inventory',message:`${variantId} is at or below its stock threshold.`}});
    return {onHand:after,reserved:reservedAfter,available:after-reservedAfter};
  }
  async adjust(body:unknown,actorId:string) {
    const data=z.object({variantId:z.string(),quantity:z.number().int().min(-100000).max(100000).refine(q=>q!==0),reason:z.string().trim().min(5).max(500),type:z.enum(['ADJUSTMENT','DAMAGE','LOSS','RETURN','RECEIPT']).default('ADJUSTMENT')}).strict().parse(body);
    if(['DAMAGE','LOSS'].includes(data.type)&&data.quantity>0) throw new BadRequestException('Damage and loss must reduce stock.');
    if(['RETURN','RECEIPT'].includes(data.type)&&data.quantity<0) throw new BadRequestException('Returns and receipts must add stock.');
    return this.db.atomic(async(tx)=>{const variant=await tx.productVariant.findUniqueOrThrow({where:{id:data.variantId},select:{sku:true,product:{select:{name:true}}}});const result=await this.move(tx,data.variantId,data.quantity,0,data.type,data.reason,actorId);await tx.auditLog.create({data:{actorId,action:'inventory.adjust',entity:'variant',entityId:data.variantId,detail:{productName:variant.product.name,sku:variant.sku,before:result.onHand-data.quantity,after:result.onHand,quantity:data.quantity,type:data.type,reason:data.reason}}});return result;});
  }
}
