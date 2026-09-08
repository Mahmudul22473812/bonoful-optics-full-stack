import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../core/prisma.service';

export const productInclude={brand:true,category:true,images:{orderBy:{position:'asc'}},variants:{where:{active:true},include:{inventory:true}},reviews:{where:{approved:true},select:{id:true,rating:true,body:true,createdAt:true,user:{select:{name:true}}}}} satisfies Prisma.ProductInclude;
export type FullProduct=Prisma.ProductGetPayload<{include:typeof productInclude}>;
export function productView(product:FullProduct) {
  const variant=product.variants[0];
  return {id:product.id,slug:product.slug,name:product.name,description:product.description,brand:product.brand.name,brandId:product.brandId,category:product.category.name,categoryId:product.categoryId,gender:product.gender,shape:product.shape,material:product.material,lens:product.lens,measurements:product.measurements,prescriptionAllowed:product.prescriptionAllowed,active:product.active,featured:product.featured,isNew:Date.now()-product.createdAt.getTime()<30*86400000,isBestSeller:product.featured,price:(variant?.price??0)/100,salePrice:variant?.salePrice==null?undefined:variant.salePrice/100,tone:variant?.tone??'black',color:variant?.color??'',stock:variant?.inventory.reduce((n,i)=>n+i.onHand-i.reserved,0)??0,variantId:variant?.id??'',sku:variant?.sku??'',images:product.images,reviews:product.reviews,variants:product.variants.map(v=>({id:v.id,sku:v.sku,color:v.color,size:v.size,tone:v.tone,price:v.price/100,salePrice:v.salePrice==null?undefined:v.salePrice/100,stock:v.inventory.reduce((n,i)=>n+i.onHand-i.reserved,0)}))};
}
const querySchema=z.object({q:z.string().max(100).optional(),category:z.string().optional(),brand:z.string().optional(),gender:z.string().optional(),shape:z.string().optional(),material:z.string().optional(),color:z.string().optional(),lens:z.string().optional(),min:z.coerce.number().min(0).optional(),max:z.coerce.number().min(0).optional(),sort:z.enum(['newest','price-asc','price-desc','popular','best-selling']).default('newest'),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(12),featured:z.enum(['true','false']).optional(),availability:z.enum(['in-stock','all']).optional()});

@Injectable()
export class CatalogService {
  constructor(private readonly db:PrismaService) {}
  async list(input:unknown) {
    const q=querySchema.parse(input);
    const where:Prisma.ProductWhereInput={active:true,archivedAt:null,variants:{some:{active:true}},...(q.category?{category:{name:q.category}}:{}),...(q.brand?{brand:{name:q.brand}}:{}),...(q.gender?{gender:q.gender}:{}),...(q.shape?{shape:q.shape}:{}),...(q.material?{material:q.material}:{}),...(q.lens?{lens:q.lens}:{}),...(q.featured?{featured:q.featured==='true'}:{})};
    if(q.q) where.OR=[{name:{contains:q.q,mode:'insensitive'}},{description:{contains:q.q,mode:'insensitive'}},{brand:{name:{contains:q.q,mode:'insensitive'}}},{category:{name:{contains:q.q,mode:'insensitive'}}},{variants:{some:{sku:{contains:q.q,mode:'insensitive'}}}}];
    // IDs are filtered and sorted by effective variant price in PostgreSQL, before pagination.
    const candidates=await this.db.product.findMany({where,select:{id:true}});
    if(!candidates.length) return {items:[],total:0,page:q.page,pages:0};
    const ids=candidates.map(p=>p.id);
    const min=q.min==null?0:Math.round(q.min*100),max=q.max==null?2147483647:Math.round(q.max*100);
    const priceSort=q.sort==='price-asc'?Prisma.sql`"effectivePrice" ASC`:q.sort==='price-desc'?Prisma.sql`"effectivePrice" DESC`:q.sort==='popular'?Prisma.sql`"reviewCount" DESC`:q.sort==='best-selling'?Prisma.sql`"sold" DESC`:Prisma.sql`p."createdAt" DESC`;
    const rows=await this.db.$queryRaw<{id:string;count:bigint}[]>(Prisma.sql`SELECT p.id, COUNT(*) OVER() AS count, MIN(COALESCE(v."salePrice",v.price)) AS "effectivePrice", (SELECT COUNT(*) FROM "Review" r WHERE r."productId"=p.id AND r.approved=true) AS "reviewCount", (SELECT COALESCE(SUM(oi.quantity),0) FROM "OrderItem" oi JOIN "ProductVariant" ov ON ov.id=oi."variantId" JOIN "Order" o ON o.id=oi."orderId" WHERE ov."productId"=p.id AND o.status NOT IN ('CANCELLED','REFUNDED')) AS sold FROM "Product" p JOIN "ProductVariant" v ON v."productId"=p.id AND v.active=true WHERE p.id IN (${Prisma.join(ids)}) AND COALESCE(v."salePrice",v.price) BETWEEN ${min} AND ${max} ${q.color?Prisma.sql`AND v.color=${q.color}`:Prisma.empty} ${q.availability==='in-stock'?Prisma.sql`AND EXISTS (SELECT 1 FROM "Inventory" i WHERE i."variantId"=v.id AND i."onHand">i.reserved)`:Prisma.empty} GROUP BY p.id ORDER BY ${priceSort},p.id LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`);
    const items=await this.db.product.findMany({where:{id:{in:rows.map(r=>r.id)}},include:productInclude});
    const total=Number(rows[0]?.count??0);
    return {items:rows.map(row=>productView(items.find(p=>p.id===row.id)!)),total,page:q.page,pages:Math.ceil(total/q.limit)};
  }
  async get(slug:string) {const product=await this.db.product.findFirst({where:{slug,active:true,archivedAt:null},include:productInclude});if(!product) throw new NotFoundException('Product not found.');return productView(product);}
  async facets() { const [categories,brands,attributes]=await Promise.all([this.db.category.findMany({orderBy:{name:'asc'}}),this.db.brand.findMany({orderBy:{name:'asc'}}),this.db.product.findMany({where:{active:true,archivedAt:null},select:{gender:true,shape:true,material:true,lens:true,variants:{select:{color:true}}}})]);return {categories,brands,genders:[...new Set(attributes.map(p=>p.gender))],shapes:[...new Set(attributes.map(p=>p.shape))],materials:[...new Set(attributes.map(p=>p.material))],lenses:[...new Set(attributes.map(p=>p.lens))],colors:[...new Set(attributes.flatMap(p=>p.variants.map(v=>v.color)))]}; }
}

