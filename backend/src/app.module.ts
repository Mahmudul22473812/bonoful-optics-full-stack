import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './core/prisma.service';
import { AuthGuard } from './core/auth.guard';
import { RateLimitService } from './core/rate-limit.service';
import { NotificationService } from './core/notification.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { CommerceController } from './commerce/commerce.controller';
import { CartService } from './commerce/cart.service';
import { OrderService } from './commerce/order.service';
import { InventoryService } from './inventory/inventory.service';
import { AdminController } from './admin/admin.controller';
import { AdminQueryService } from './admin/admin-query.service';
import { ProductAdminService } from './admin/product-admin.service';
import { PurchasingService } from './admin/purchasing.service';
import { AccountController } from './account/account.controller';

@Module({controllers:[AuthController,CatalogController,CommerceController,AdminController,AccountController],providers:[PrismaService,RateLimitService,NotificationService,AuthService,CatalogService,CartService,OrderService,InventoryService,AdminQueryService,ProductAdminService,PurchasingService,{provide:APP_GUARD,useClass:AuthGuard}]})
export class AppModule {}

