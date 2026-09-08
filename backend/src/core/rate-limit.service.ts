import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { digest } from './security';

@Injectable()
export class RateLimitService {
  constructor(private readonly db:PrismaService) {}
  async check(scope:string,identity:string,max=8,minutes=15) {
    const key=digest(`${scope}:${identity}`);
    const now=new Date();
    const reset=new Date(now.getTime()+minutes*60000);
    const count=await this.db.atomic(async(tx)=>{
      const current=await tx.rateLimit.findUnique({where:{key}});
      if(!current) return (await tx.rateLimit.create({data:{key,resetsAt:reset}})).count;
      if(current.resetsAt<=now) return (await tx.rateLimit.update({where:{key},data:{count:1,resetsAt:reset}})).count;
      return (await tx.rateLimit.update({where:{key},data:{count:{increment:1}}})).count;
    });
    if(count>max) throw new HttpException('Too many attempts. Please try again later.',429);
  }
}

