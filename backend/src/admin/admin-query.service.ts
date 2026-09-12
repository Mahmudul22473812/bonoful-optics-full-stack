import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../core/prisma.service';

export const listQuery=z.object({q:z.string().max(100).default(''),page:z.coerce.number().int().min(1).default(1),status:z.string().optional()});
export const inventoryMatchesStatus=(onHand:number,reserved:number,lowThreshold:number,status?:string)=>{const available=onHand-reserved;return status==='low'?available>0&&available<=lowThreshold:status==='out'?available<=0:true;};
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
  async inventory(query:unknown) {const {q,page,status}=listQuery.parse(query);const rows=await this.db.inventory.findMany({where:{variant:{product:{archivedAt:null},OR:[{sku:{contains:q,mode:'insensitive'}},{product:{name:{contains:q,mode:'insensitive'}}}]}},include:{variant:{include:{product:{select:{name:true}}}},location:true},orderBy:{variant:{sku:'asc'}}});const selected=rows.filter(row=>inventoryMatchesStatus(row.onHand,row.reserved,row.lowThreshold,status));return {items:selected.slice((page-1)*20,page*20).map(i=>({...i,available:i.onHand-i.reserved})),total:selected.length,page};}
  async movements(query:unknown) {const {q,page}=listQuery.parse(query);const where:Prisma.InventoryMovementWhereInput=q?{OR:[{inventory:{variant:{sku:{contains:q,mode:'insensitive'}}}},{reference:{contains:q}}]}:{};const [items,total]=await Promise.all([this.db.inventoryMovement.findMany({where,include:{inventory:{include:{variant:{select:{sku:true,color:true,product:{select:{name:true}}}}}},actor:{select:{name:true}}},orderBy:{createdAt:'desc'},take:20,skip:(page-1)*20}),this.db.inventoryMovement.count({where})]);return {items,total,page};}
  async orders(query:unknown) {const {q,page,status}=listQuery.parse(query);const where:Prisma.OrderWhereInput={...(status?{status:z.nativeEnum(OrderStatus).parse(status)}:{}),OR:[{number:{contains:q,mode:'insensitive'}},{user:{email:{contains:q,mode:'insensitive'}}}]};const [items,total]=await Promise.all([this.db.order.findMany({where,select:{id:true,number:true,status:true,total:true,createdAt:true,user:{select:{name:true,email:true}}},orderBy:{createdAt:'desc'},take:20,skip:(page-1)*20}),this.db.order.count({where})]);return {items,total,page};}
  async audit(query:unknown) {
    const {q,page}=listQuery.parse(query);
    const where:Prisma.AuditLogWhereInput=q?{action:{contains:q,mode:'insensitive'}}:{};
    const [logs,total]=await Promise.all([
      this.db.auditLog.findMany({where,include:{actor:{select:{name:true,role:{select:{name:true}}}}},orderBy:{createdAt:'desc'},skip:(page-1)*20,take:20}),
      this.db.auditLog.count({where}),
    ]);
    const ids=(entity:string)=>logs.filter(log=>log.entity===entity).map(log=>log.entityId);
    const [variants,inventory,products,orders,categories,brands,users,purchases]=await Promise.all([
      this.db.productVariant.findMany({where:{id:{in:ids('variant')}},select:{id:true,sku:true,product:{select:{name:true}}}}),
      this.db.inventory.findMany({where:{id:{in:ids('inventory')}},select:{id:true,variant:{select:{sku:true,product:{select:{name:true}}}}}}),
      this.db.product.findMany({where:{id:{in:ids('product')}},select:{id:true,name:true}}),
      this.db.order.findMany({where:{id:{in:ids('order')}},select:{id:true,number:true}}),
      this.db.category.findMany({where:{id:{in:ids('category')}},select:{id:true,name:true}}),
      this.db.brand.findMany({where:{id:{in:ids('brand')}},select:{id:true,name:true}}),
      this.db.user.findMany({where:{id:{in:ids('user')}},select:{id:true,name:true,email:true}}),
      this.db.purchaseOrder.findMany({where:{id:{in:ids('purchaseOrder')}},select:{id:true,number:true}}),
    ]);
    const labels=new Map<string,string>();
    variants.forEach(row=>labels.set(`variant:${row.id}`,`${row.product.name} (${row.sku})`));
    inventory.forEach(row=>labels.set(`inventory:${row.id}`,`${row.variant.product.name} (${row.variant.sku})`));
    products.forEach(row=>labels.set(`product:${row.id}`,row.name));orders.forEach(row=>labels.set(`order:${row.id}`,row.number));
    categories.forEach(row=>labels.set(`category:${row.id}`,row.name));brands.forEach(row=>labels.set(`brand:${row.id}`,row.name));
    users.forEach(row=>labels.set(`user:${row.id}`,`${row.name} (${row.email})`));purchases.forEach(row=>labels.set(`purchaseOrder:${row.id}`,row.number));
    const title=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/^./,letter=>letter.toUpperCase());
    const descriptions:Record<string,(actor:string,label:string,detail:Record<string,unknown>)=>string>={
      'inventory.adjust':(actor,label,detail)=>`${actor} adjusted stock for ${String(detail.productName??label)}${detail.sku?` (${String(detail.sku)})`:''} from ${String(detail.before??'the previous quantity')} to ${String(detail.after??'the new quantity')}`,
      'inventory.threshold':(actor,label,detail)=>`${actor} changed the low-stock threshold for ${label} to ${String(detail.lowThreshold??'a new value')}`,
      'orders.status':(actor,label,detail)=>`${actor} changed Order ${String(detail.orderNumber??label)} status from ${title(String(detail.from??''))} to ${title(String(detail.to??''))}`,
      'orders.notes':(actor,label)=>`${actor} updated the internal note for Order ${label}`,
      'products.create':(actor,label,detail)=>`${actor} created product ${String(detail.productName??label)}`,
      'products.update':(actor,label,detail)=>`${actor} updated product ${String(detail.productName??label)}`,
      'products.archive':(actor,label)=>`${actor} archived product ${label}`,
      'products.bulk':(actor)=>`${actor} updated the availability of multiple products`,
      'files.upload':(actor)=>`${actor} uploaded a product image`,
      'category.save':(actor,label)=>`${actor} saved category ${label}`,
      'brand.save':(actor,label)=>`${actor} saved brand ${label}`,
      'customers.status':(actor,label,detail)=>`${actor} ${detail.active?'activated':'deactivated'} customer ${label}`,
      'users.manage':(actor,label)=>`${actor} updated team member ${label}`,
      'roles.update':(actor,label)=>`${actor} updated permissions for role ${label}`,
      'purchases.create':(actor,label)=>`${actor} created purchase order ${label}`,
      'purchases.receive':(actor,label)=>`${actor} received stock for purchase order ${label}`,
      'purchases.status':(actor,label,detail)=>`${actor} changed purchase order ${label} to ${title(String(detail.status??''))}`,
      'reviews.moderate':(actor,_label,detail)=>`${actor} ${detail.approved?'approved':'hid'} a customer review`,
      'refunds.settle':(actor,label)=>`${actor} recorded repayment for refund ${label}`,
    };
    return {items:logs.map(log=>{const detail=log.detail&&typeof log.detail==='object'&&!Array.isArray(log.detail)?log.detail as Record<string,unknown>:{};const actor=log.actor?.name??'System';const resourceLabel=labels.get(`${log.entity}:${log.entityId}`)??title(log.entity);return {...log,resourceLabel,description:descriptions[log.action]?.(actor,resourceLabel,detail)??`${actor} performed ${title(log.action.replaceAll('.',' '))} on ${resourceLabel}`};}),total,page};
  }
}
