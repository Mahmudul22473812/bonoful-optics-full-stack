import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CatalogService } from './catalog.service';
import { AuthRequest, Public } from '../core/auth.guard';
import { PrismaService } from '../core/prisma.service';
import { RateLimitService } from '../core/rate-limit.service';

@ApiTags('Catalog') @Controller()
export class CatalogController {
  constructor(private readonly catalog:CatalogService,private readonly db:PrismaService,private readonly rate:RateLimitService) {}
  @Public() @Get('products') list(@Query() query:Record<string,string>) {return this.catalog.list(query);}
  @Public() @Get('products/:slug') get(@Param('slug') slug:string) {return this.catalog.get(slug);}
  @Public() @Get('catalog/facets') facets() {return this.catalog.facets();}
  @Public() @Get('categories') categories() {return this.db.category.findMany();}
  @Public() @Get('brands') brands() {return this.db.brand.findMany();}
  @Post('products/:id/reviews') async review(@Param('id') productId:string,@Body() body:unknown,@Req() req:AuthRequest) {
    const data=z.object({rating:z.number().int().min(1).max(5),body:z.string().trim().min(10).max(2000)}).strict().parse(body);
    await this.rate.check('review',req.actor!.id,10,60);
    return this.db.review.upsert({where:{userId_productId:{userId:req.actor!.id,productId}},create:{...data,userId:req.actor!.id,productId},update:{...data,approved:false}});
  }
}
