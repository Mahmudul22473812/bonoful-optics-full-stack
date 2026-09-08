import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../core/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

const purchaseSchema=z.object({supplierId:z.string(),expectedAt:z.iso.datetime().optional(),notes:z.string().max(1000).optional(),status:z.enum(['DRAFT','ORDERED']).default('ORDERED'),items:z.array(z.object({variantId:z.string(),quantity:z.number().int().min(1).max(100000),unitCost:z.number().int().min(0).max(10000000)})).min(1).max(100)}).strict();
@Injectable()
export class PurchasingService {
  constructor(private readonly db:PrismaService,private readonly stock:InventoryService) {}
  async create(body:unknown,actorId:string) {const {items,...data}=purchaseSchema.parse(body);if(new Set(items.map(i=>i.variantId)).size!==items.length) throw new BadRequestException('Each variant may appear only once.');return this.db.atomic(async(tx)=>{const po=await tx.purchaseOrder.create({data:{...data,number:`PO-${randomUUID().slice(0,8).toUpperCase()}`,items:{create:items}},include:{items:true}});for(const item of items) await tx.supplierProduct.upsert({where:{supplierId_variantId:{supplierId:data.supplierId,variantId:item.variantId}},create:{supplierId:data.supplierId,variantId:item.variantId,cost:item.unitCost},update:{cost:item.unitCost}});await tx.auditLog.create({data:{actorId,action:'purchases.create',entity:'purchaseOrder',entityId:po.id}});return po;});}
  async receive(id:string,body:unknown,actorId:string) {
    const data=z.object({items:z.array(z.object({itemId:z.string(),quantity:z.number().int().min(1).max(100000)})).min(1).max(100)}).strict().parse(body);
    if(new Set(data.items.map(i=>i.itemId)).size!==data.items.length) throw new BadRequestException('Duplicate receipt lines.');
    return this.db.atomic(async(tx)=>{
      const po=await tx.purchaseOrder.findUniqueOrThrow({where:{id},include:{items:true}});
      if(!['ORDERED','PARTIALLY_RECEIVED'].includes(po.status)) throw new BadRequestException('This purchase order cannot receive stock.');
      for(const receipt of data.items) {
        const item=po.items.find(i=>i.id===receipt.itemId);
        if(!item||receipt.quantity>item.quantity-item.received) throw new BadRequestException('Received quantity exceeds the outstanding quantity.');
        await tx.purchaseOrderItem.update({where:{id:item.id},data:{received:{increment:receipt.quantity}}});
        await this.stock.move(tx,item.variantId,receipt.quantity,0,'RECEIPT',`Received ${po.number}`,actorId,id);
      }
      const remaining=await tx.purchaseOrderItem.findMany({where:{purchaseOrderId:id}});
      const updated=await tx.purchaseOrder.update({where:{id},data:{status:remaining.every(i=>i.received===i.quantity)?'RECEIVED':'PARTIALLY_RECEIVED'},include:{items:true}});
      await tx.auditLog.create({data:{actorId,action:'purchases.receive',entity:'purchaseOrder',entityId:id,detail:data}});
      return updated;
    });
  }
  async status(id:string,status:'ORDERED'|'CANCELLED',actorId:string) {return this.db.atomic(async(tx)=>{const po=await tx.purchaseOrder.findUniqueOrThrow({where:{id}});if((status==='ORDERED'&&po.status!=='DRAFT')||(status==='CANCELLED'&&!['DRAFT','ORDERED'].includes(po.status))) throw new BadRequestException('Invalid purchase status change.');const updated=await tx.purchaseOrder.update({where:{id},data:{status}});await tx.auditLog.create({data:{actorId,action:'purchases.status',entity:'purchaseOrder',entityId:id,detail:{status}}});return updated;});}
}

