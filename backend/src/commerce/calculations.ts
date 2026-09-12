import { BadRequestException } from '@nestjs/common';

export function calculateTotals(lines:{unitPrice:number;quantity:number;eligible?:boolean}[],coupon:{type:string;value:number;minimum:number}|null,taxBps:number,delivery:string,fee:number,freeMinimum:number) {
  if(!lines.length||lines.some(l=>!Number.isSafeInteger(l.unitPrice)||l.unitPrice<0||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>50)) throw new BadRequestException('Invalid cart quantities or prices.');
  const subtotal=lines.reduce((n,l)=>n+l.unitPrice*l.quantity,0);
  if(subtotal>100000000) throw new BadRequestException('Order exceeds the supported limit.');
  if(coupon&&subtotal<coupon.minimum) throw new BadRequestException('Coupon minimum order value is not met.');
  const eligible=lines.reduce((n,l)=>n+(l.eligible===false?0:l.unitPrice*l.quantity),0);
  if(coupon&&!eligible) throw new BadRequestException('This coupon does not apply to items in your bag.');
  const discount=coupon?Math.min(eligible,coupon.type==='PERCENT'?Math.floor(eligible*coupon.value/100):coupon.value):0;
  const tax=Math.round((subtotal-discount)*taxBps/10000);
  const shipping=delivery==='pickup'||subtotal>=freeMinimum?0:fee;
  return {subtotal,discount,tax,shipping,total:subtotal-discount+tax+shipping};
}
export const transitions:Record<string,string[]>={PENDING:['CONFIRMED','CANCELLED'],CONFIRMED:['PROCESSING','CANCELLED'],PROCESSING:['READY','CANCELLED'],READY:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:['REFUNDED'],CANCELLED:[],REFUNDED:[]};

export function reachableOrderStatuses(status:string) {
  const found:string[]=[];
  const visit=(current:string)=>{for(const next of transitions[current]??[])if(!found.includes(next)){found.push(next);visit(next);}};
  visit(status);
  return found;
}
