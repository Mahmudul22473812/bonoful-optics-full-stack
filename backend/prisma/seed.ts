import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';
import { z } from 'zod';

const db=new PrismaClient();
const permissions=['products.read','products.create','products.update','products.delete','inventory.read','inventory.adjust','orders.read','orders.update','orders.refund','customers.read','customers.manage','users.manage','reports.read','purchases.read','purchases.manage','promotions.manage','reviews.moderate','prescriptions.read','audit.read'];
const items=[
 {id:'arden',name:'Arden',category:'Eyeglasses',brand:'Bonoful Studio',gender:'Unisex',shape:'Round',material:'Acetate',color:'Black',lens:'Prescription ready',price:485000,stock:14,image:'black-round-unsplash.jpg'},
 {id:'nila',name:'Nila',category:'Eyeglasses',brand:'Bonoful Studio',gender:'Women',shape:'Square',material:'Stainless steel',color:'Silver',lens:'Prescription ready',price:520000,stock:8,image:'minimal-metal-28881364.jpg'},
 {id:'solis',name:'Solis',category:'Sunglasses',brand:'Marlowe',gender:'Unisex',shape:'D-frame',material:'Acetate',color:'Black',lens:'Polarized UV400',price:690000,stock:21,image:'sunglasses-11199907.jpg'},
 {id:'kite',name:'Kite',category:'Eyeglasses',brand:'Bonoful Kids',gender:'Kids',shape:'Round',material:'TR90',color:'Crystal',lens:'Prescription ready',price:325000,stock:11,image:'clear-frames-6143506.jpg'},
 {id:'atlas',name:'Atlas',category:'Frames',brand:'North & Co.',gender:'Men',shape:'Round',material:'Acetate',color:'Black',lens:'Prescription ready',price:780000,stock:3,image:'black-round-unsplash.jpg'},
 {id:'asha',name:'Asha',category:'Blue Light Glasses',brand:'Bonoful Studio',gender:'Women',shape:'Geometric',material:'Bio-acetate',color:'Blush',lens:'Blue-filter clear',price:455000,stock:18,image:'geometric-frames-6176179.jpg'},
 {id:'kori',name:'Kori',category:'Reading Glasses',brand:'Kanso',gender:'Unisex',shape:'Round',material:'Acetate',color:'Crystal',lens:'+1.50 reader',price:390000,stock:29,image:'clear-frames-6143506.jpg'},
 {id:'dune',name:'Dune',category:'Sunglasses',brand:'Marlowe',gender:'Men',shape:'D-frame',material:'Stainless steel',color:'Black',lens:'UV400',price:640000,stock:9,image:'sunglasses-11199907.jpg'},
 {id:'megh',name:'Megh',category:'Prescription Glasses',brand:'Kanso',gender:'Unisex',shape:'Square',material:'Stainless steel',color:'Silver',lens:'Progressive compatible',price:820000,stock:0,image:'minimal-metal-28881364.jpg'},
 {id:'iris',name:'Iris',category:'Eyeglasses',brand:'Bonoful Studio',gender:'Women',shape:'Geometric',material:'Bio-acetate',color:'Blush',lens:'Prescription ready',price:570000,stock:6,image:'geometric-frames-6176179.jpg'},
 {id:'shapla',name:'Shapla',category:'Frames',brand:'Bonoful Studio',gender:'Unisex',shape:'Round',material:'Acetate',color:'Crystal',lens:'Prescription ready',price:595000,stock:12,image:'clear-frames-6143506.jpg'},
 {id:'tala',name:'Tala',category:'Blue Light Glasses',brand:'North & Co.',gender:'Men',shape:'Square',material:'Stainless steel',color:'Silver',lens:'Blue-filter clear',price:495000,stock:10,image:'minimal-metal-28881364.jpg'},
];

async function seed() {
  if(process.env.NODE_ENV==='production'&&process.env.ALLOW_PRODUCTION_SEED!=='true') throw new Error('Development seed is disabled in production.');
  for(const id of permissions)await db.permission.upsert({where:{id},create:{id,description:id.replace('.',' · ')},update:{}});
  const roles=[{id:'customer',name:'Customer',grants:[]},{id:'staff',name:'Staff',grants:['products.read','orders.read','orders.update','customers.read','reports.read']},{id:'inventory_manager',name:'Inventory Manager',grants:['products.read','products.create','products.update','inventory.read','inventory.adjust','purchases.read','purchases.manage','reports.read']},{id:'admin',name:'Admin',grants:permissions.filter(p=>p!=='users.manage')},{id:'super_admin',name:'Super Admin',grants:permissions}];
  for(const role of roles){await db.role.upsert({where:{id:role.id},create:{id:role.id,name:role.name},update:{}});for(const permissionId of role.grants)await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId}},create:{roleId:role.id,permissionId},update:{}});}
  const accounts=[{prefix:'ADMIN',roleId:'super_admin',name:'Bonoful Administrator'},{prefix:'STAFF',roleId:'staff',name:'Nadia Rahman'},{prefix:'CUSTOMER',roleId:'customer',name:'Farhana Rahman'}];
  for(const account of accounts){const email=z.email().parse(process.env[`SEED_${account.prefix}_EMAIL`]);const password=z.string().min(12).parse(process.env[`SEED_${account.prefix}_PASSWORD`]);await db.user.upsert({where:{email},create:{email,name:account.name,roleId:account.roleId,passwordHash:await hash(password,{type:argon2id,memoryCost:65536,timeCost:3,parallelism:1}),verifiedAt:new Date()},update:{}});}
  await db.location.upsert({where:{id:'main'},create:{id:'main',name:'Dhanmondi flagship'},update:{}});
  const categories=['Eyeglasses','Sunglasses','Prescription Glasses','Blue Light Glasses','Reading Glasses','Contact Lenses','Frames','Accessories'];
  for(const name of categories)await db.category.upsert({where:{name},create:{name,slug:name.toLowerCase().replaceAll(' ','-')},update:{}});
  for(const item of items) {
    const brand=await db.brand.upsert({where:{name:item.brand},create:{name:item.brand,slug:item.brand.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')},update:{}});
    const category=await db.category.findUniqueOrThrow({where:{name:item.category}});
    const productId=`prd_${item.id}`,variantId=`var_${item.id}`;
    const exists=await db.product.findUnique({where:{id:productId}});if(exists)continue;
    await db.product.create({data:{id:productId,name:item.name,slug:item.id,description:`${item.name} brings a considered ${item.shape.toLowerCase()} silhouette to everyday eyewear. Its ${item.material.toLowerCase()} construction balances comfort and character. Visit our optical team for a precise fit and lens consultation.`,categoryId:category.id,brandId:brand.id,gender:item.gender,shape:item.shape,material:item.material,lens:item.lens,measurements:item.gender==='Kids'?'45–17–130':'50–20–145',prescriptionAllowed:item.category!=='Sunglasses',featured:['arden','solis','atlas','shapla'].includes(item.id),images:{create:[{url:`/media/${item.image}`,alt:`${item.color} ${item.shape.toLowerCase()} ${item.name} frame`,position:0}]},variants:{create:{id:variantId,sku:`BO-${item.id.toUpperCase()}-M`,color:item.color,size:'Medium',price:item.price,salePrice:item.id==='solis'?625000:null,tone:'black',inventory:{create:{locationId:'main',onHand:item.stock,lowThreshold:5,movements:{create:{type:'OPENING',before:0,change:item.stock,after:item.stock,reservedBefore:0,reservedChange:0,reservedAfter:0,reason:'Development opening balance'}}}}}}}});
  }
  const supplier=await db.supplier.upsert({where:{id:'sup_eastern'},create:{id:'sup_eastern',name:'Eastern Optical Distribution',email:'orders@example.com',phone:'+880 1700 000 010',address:'Development supplier · Dhaka'},update:{}});
  await db.supplierProduct.upsert({where:{supplierId_variantId:{supplierId:supplier.id,variantId:'var_atlas'}},create:{supplierId:supplier.id,variantId:'var_atlas',cost:440000},update:{}});
  await db.purchaseOrder.upsert({where:{id:'po_initial'},create:{id:'po_initial',number:'PO-2026-1008',supplierId:supplier.id,status:'ORDERED',expectedAt:new Date(Date.now()+5*86400000),items:{create:[{variantId:'var_atlas',quantity:12,unitCost:440000},{variantId:'var_nila',quantity:8,unitCost:280000}]}},update:{}});
  const customer=await db.user.findUniqueOrThrow({where:{email:process.env.SEED_CUSTOMER_EMAIL!}});
  await db.address.upsert({where:{id:'addr_seed'},create:{id:'addr_seed',userId:customer.id,label:'Home',name:customer.name,phone:'+880 1700 000 020',line1:'House 24, Road 7',city:'Dhaka',postalCode:'1209',country:'BD',isDefault:true},update:{}});
  for(const [productId,body] of [['prd_arden','The frame feels balanced and the team took time to get the fit right.'],['prd_nila','Lightweight and comfortable for the whole working day.']])await db.review.upsert({where:{userId_productId:{userId:customer.id,productId}},create:{userId:customer.id,productId,body,rating:5,approved:true},update:{}});
  await db.coupon.upsert({where:{code:'WELCOME10'},create:{code:'WELCOME10',type:'PERCENT',value:10,minimum:300000,startsAt:new Date('2026-01-01'),endsAt:new Date('2028-01-01'),usageLimit:1000,perCustomerLimit:1},update:{}});
  if(!await db.order.findUnique({where:{id:'ord_seed'}}))await db.$transaction(async(tx)=>{
    await tx.order.create({data:{id:'ord_seed',number:'BO-2026-1001',idempotencyKey:'dev-seed-1001',userId:customer.id,status:'DELIVERED',subtotal:485000,discount:0,tax:0,shipping:12000,total:497000,shippingAddress:{name:customer.name,line1:'House 24, Road 7',city:'Dhaka',postalCode:'1209',country:'BD'},billingAddress:{name:customer.name,line1:'House 24, Road 7',city:'Dhaka',postalCode:'1209',country:'BD'},deliveryMethod:'delivery',items:{create:{variantId:'var_arden',name:'Arden',sku:'BO-ARDEN-M',color:'Black',size:'Medium',unitPrice:485000,quantity:1}},histories:{create:[{status:'PENDING',note:'Development sample order'},{status:'CONFIRMED'},{status:'PROCESSING'},{status:'READY'},{status:'SHIPPED'},{status:'DELIVERED'}]},payments:{create:{provider:'COD',amount:497000,status:'PAID'}}}});
    const stock=await tx.inventory.findUniqueOrThrow({where:{variantId_locationId:{variantId:'var_arden',locationId:'main'}}});await tx.inventory.update({where:{id:stock.id},data:{onHand:{decrement:1}}});await tx.inventoryMovement.create({data:{inventoryId:stock.id,type:'SHIPMENT',before:stock.onHand,change:-1,after:stock.onHand-1,reservedBefore:0,reservedChange:0,reservedAfter:0,reason:'Development historical order',reference:'ord_seed'}});
  });
  console.log('Development catalog, roles, accounts, inventory, supplier, purchase order and sample order seeded.');
}
seed().finally(()=>db.$disconnect());
