require('dotenv/config');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const targets=[{id:'prd_iris',name:'Iris',colours:['Black','Gold']},{id:'prd_kite',name:'Kite',colours:['Blue','Black']}];
async function main(){
 if(process.env.NODE_ENV==='production')throw Error('Development demo only');
 const products=await db.product.findMany({where:{id:{in:targets.map(t=>t.id)}},include:{variants:true}});
 for(const target of targets){const p=products.find(p=>p.id===target.id);if(!p||p.name!==target.name||!p.active||!p.variants.length)throw Error('Expected demo product changed; aborting');}
 if(!process.argv.includes('--apply')){console.log(JSON.stringify(products.map(p=>({name:p.name,slug:p.slug,colours:p.variants.map(v=>v.color)}))));return;}
 await db.$transaction(async tx=>{
 for(const target of targets){const product=products.find(p=>p.id===target.id),base=product.variants[0];
 for(const colour of target.colours){
 if(await tx.productVariant.findUnique({where:{productId_color_size:{productId:product.id,color:colour,size:base.size}}}))continue;
 const v=await tx.productVariant.create({data:{productId:product.id,sku:`DEMO-${product.id}-${colour.toUpperCase()}`,color:colour,size:base.size,tone:colour.toLowerCase(),price:base.price,salePrice:base.salePrice,active:true}});
 const inventory=await tx.inventory.create({data:{variantId:v.id,locationId:'main',onHand:6,reserved:0,lowThreshold:2}});
 await tx.inventoryMovement.create({data:{inventoryId:inventory.id,type:'OPENING',before:0,change:6,after:6,reservedBefore:0,reservedChange:0,reservedAfter:0,reason:'User-requested sample stock for multi-colour preview',reference:'demo-colours-2026-09-08'}});
 await tx.auditLog.create({data:{action:'demo.variant.create',entity:'variant',entityId:v.id,detail:{product:product.name,colour,sampleStock:6}}});
 }
 }
 });
 console.log('Sample colours added; existing variants preserved.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
