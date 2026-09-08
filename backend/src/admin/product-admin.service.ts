import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../core/prisma.service';

const safeImage=z.string().refine(value=>value.startsWith('/media/')||/^\/api\/v1\/files\/[a-zA-Z0-9_-]+$/.test(value),'Use an uploaded image or a catalog asset.');
const variantSchema=z.object({id:z.string().optional(),sku:z.string().trim().min(3).max(60),color:z.string().min(1).max(50),size:z.string().min(1).max(40),tone:z.string().max(30).default('black'),price:z.number().int().min(100).max(10000000),salePrice:z.number().int().min(0).nullable().optional(),active:z.boolean().default(true)}).refine(v=>v.salePrice==null||v.salePrice<v.price,'Sale price must be below regular price.');
export const productSchema=z.object({name:z.string().trim().min(2).max(120),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(140),description:z.string().trim().min(10).max(10000),categoryId:z.string(),brandId:z.string(),gender:z.enum(['Women','Men','Unisex','Kids']),shape:z.string().min(1).max(50),material:z.string().min(1).max(80),lens:z.string().min(1).max(80),measurements:z.string().min(1).max(40),prescriptionAllowed:z.boolean().default(true),featured:z.boolean().default(false),active:z.boolean().default(true),seoTitle:z.string().max(70).optional(),seoDescription:z.string().max(180).optional(),variants:z.array(variantSchema).min(1).max(50),images:z.array(z.object({url:safeImage,alt:z.string().min(1).max(200),color:z.string().trim().max(80).nullable().optional()})).max(12)}).strict();

@Injectable()
export class ProductAdminService {
  constructor(private readonly db:PrismaService) {}
  async save(body:unknown,actorId:string,id?:string) {
    const {variants,images,...data}=productSchema.parse(body);
    return this.db.atomic(async(tx)=>{
      const product=id?await tx.product.update({where:{id},data}):await tx.product.create({data});
      const ids:string[]=[];
      for(const variant of variants) {
        const {id:variantId,...values}=variant;
        const row=variantId?await tx.productVariant.update({where:{id:variantId,productId:product.id},data:values}):await tx.productVariant.create({data:{...values,productId:product.id}});
        ids.push(row.id);
        await tx.inventory.upsert({where:{variantId_locationId:{variantId:row.id,locationId:'main'}},create:{variantId:row.id,locationId:'main'},update:{}});
      }
      await tx.productVariant.updateMany({where:{productId:product.id,id:{notIn:ids}},data:{active:false}});
      await tx.productImage.deleteMany({where:{productId:product.id}});
      if(images.length) await tx.productImage.createMany({data:images.map((image,position)=>({...image,position,productId:product.id}))});
      await tx.auditLog.create({data:{actorId,action:id?'products.update':'products.create',entity:'product',entityId:product.id}});
      return product;
    });
  }
  async archive(id:string,actorId:string) {return this.db.atomic(async(tx)=>{const result=await tx.product.update({where:{id},data:{active:false,archivedAt:new Date()}});await tx.auditLog.create({data:{actorId,action:'products.archive',entity:'product',entityId:id}});return result;});}
  async bulk(body:unknown,actorId:string) {const data=z.object({ids:z.array(z.string()).min(1).max(100),active:z.boolean()}).strict().parse(body);return this.db.atomic(async(tx)=>{const result=await tx.product.updateMany({where:{id:{in:data.ids},archivedAt:null},data:{active:data.active}});await tx.auditLog.create({data:{actorId,action:'products.bulk',entity:'product',entityId:'bulk',detail:data}});return result;});}
}
