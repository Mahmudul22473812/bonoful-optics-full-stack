import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../core/prisma.service';

export const listQuery=z.object({q:z.string().max(100).default(''),page:z.coerce.number().int().min(1).default(1),status:z.string().optional()});
@Injectable()
export class AdminQueryService {
  constructor(private readonly db:PrismaService) {}
  async dashboard() {
    const [products,activeProducts,customers,orders,pendingOrders,revenue,stock,recentOrders]=await Promise.all([
      this.db.product.count({where:{archivedAt:null}}),this.db.product.count({where:{active:true,archivedAt:null}}),this.db.user.count({where:{roleId:'customer'}}),this.db.order.count(),this.db.order.count({where:{status:'PENDING'}}),this.db.payment.aggregate({where:{status:'PAID'},_sum:{amount:true}}),this.db.$queryRaw<{low:bigint;out:bigint;units:bigint}[]>`SELECT COUNT(*) FILTER(WHERE "onHand"-reserved<= "lowThreshold" AND "onHand"-reserved>0) AS low, COUNT(*) FILTER(WHERE "onHand"-reserved=0) AS out,COALESCE(SUM("onHand"),0) AS units FROM "Inventory"`,this.db.order.findMany({take:8,orderBy:{createdAt:'desc'},select:{id:true,number:true,status:true,total:true,createdAt:true,user:{select:{name:true}}}})
    ]);
    const revenueSeries=await this.db.$queryRaw<{date:string;total:bigint}[]>`SELECT TO_CHAR("createdAt",'YYYY-MM-DD') AS date,SUM(amount) AS total FROM "Payment" WHERE status='PAID' AND "createdAt">CURRENT_DATE-INTERVAL '30 days' GROUP BY date ORDER BY date`;
    return {products,activeProducts,customers,orders,pendingOrders,revenue:revenue._sum.amount??0,lowStock:Number(stock[0]?.low??0),outOfStock:Number(stock[0]?.out??0),units:Number(stock[0]?.units??0),recentOrders,revenueSeries:revenueSeries.map(r=>({...r,total:Number(r.total)}))};
  }
  async products(query:unknown) {const {q,page}=listQuery.parse(query);const where:Prisma.ProductWhereInput={archivedAt:null,OR:[{name:{contains:q,mode:'insensitive'}},{variants:{some:{sku:{contains:q,mode:'insensitive'}}}}]};const [items,total]=await Promise.all([this.db.product.findMany({where,include:{category:true,brand:true,variants:{include:{inventory:true}},images:true},take:20,skip:(page-1)*20,orderBy:{createdAt:'desc'}}),this.db.product.count({where})]);return {items,total,page};}
  async inventory(query:unknown) {const {q,page,status}=listQuery.parse(query);const rows=await this.db.inventory.findMany({where:{variant:{product:{archivedAt:null},OR:[{sku:{contains:q,mode:'insensitive'}},{product:{name:{contains:q,mode:'insensitive'}}}]}},include:{variant:{include:{product:{select:{name:true}}}},location:true},orderBy:{variant:{sku:'asc'}}});const selected=rows.filter(row=>status==='low'?row.onHand-row.reserved<=row.lowThreshold:status==='out'?row.onHand===row.reserved:true);return {items:selected.slice((page-1)*20,page*20).map(i=>({...i,available:i.onHand-i.reserved})),total:selected.length,page};}
  async movements(query:unknown) {const {q,page}=listQuery.parse(query);const where:Prisma.InventoryMovementWhereInput=q?{OR:[{inventory:{variant:{sku:{contains:q,mode:'insensitive'}}}},{reference:{contains:q}}]}:{};const [items,total]=await Promise.all([this.db.inventoryMovement.findMany({where,include:{inventory:{include:{variant:{select:{sku:true,color:true,product:{select:{name:true}}}}}},actor:{select:{name:true}}},orderBy:{createdAt:'desc'},take:20,skip:(page-1)*20}),this.db.inventoryMovement.count({where})]);return {items,total,page};}
  async orders(query:unknown) {const {q,page,status}=listQuery.parse(query);const where:Prisma.OrderWhereInput={...(status?{status:z.nativeEnum(OrderStatus).parse(status)}:{}),OR:[{number:{contains:q,mode:'insensitive'}},{user:{email:{contains:q,mode:'insensitive'}}}]};const [items,total]=await Promise.all([this.db.order.findMany({where,select:{id:true,number:true,status:true,total:true,createdAt:true,user:{select:{name:true,email:true}}},orderBy:{createdAt:'desc'},take:20,skip:(page-1)*20}),this.db.order.count({where})]);return {items,total,page};}
}

