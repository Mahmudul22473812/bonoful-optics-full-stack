import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { PrismaService, Tx } from './prisma.service';
import { config } from './config';
import { decrypt, encrypt } from './security';

@Injectable()
export class NotificationService implements OnModuleInit,OnModuleDestroy {
  private timer?:NodeJS.Timeout;
  private running=false;
  private readonly logger=new Logger('Notifications');
  constructor(private readonly db:PrismaService) {}
  async enqueue(tx:Tx,email:string,subject:string,text:string,userId?:string) {
    await tx.outbox.create({data:{encryptedPayload:encrypt(JSON.stringify({to:email,subject,text}))}});
    if(userId) await tx.notification.create({data:{userId,title:subject,message:subject}});
  }
  onModuleInit() { if(config.SMTP_URL) this.timer=setInterval(()=>{void this.flush()},15000); }
  onModuleDestroy() { if(this.timer) clearInterval(this.timer); }
  async flush() {
    if(!config.SMTP_URL || this.running) return;
    this.running=true;
    const transport=nodemailer.createTransport(config.SMTP_URL);
    try {
      const jobs=await this.db.outbox.findMany({where:{status:'PENDING',nextAttempt:{lte:new Date()},OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-300000)}}]},take:20,orderBy:{createdAt:'asc'}});
      for(const job of jobs) {
        const claim=await this.db.outbox.updateMany({where:{id:job.id,status:'PENDING',OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-300000)}}]},data:{lockedAt:new Date()}});
        if(!claim.count) continue;
        try { const payload=JSON.parse(decrypt(job.encryptedPayload).toString()) as {to:string;subject:string;text:string}; await transport.sendMail({from:config.MAIL_FROM,...payload}); await this.db.outbox.update({where:{id:job.id},data:{status:'SENT',encryptedPayload:encrypt('{}'),lockedAt:null}}); }
        catch { await this.db.outbox.update({where:{id:job.id},data:{attempts:{increment:1},lockedAt:null,nextAttempt:new Date(Date.now()+Math.min(86400000,30000*2**job.attempts)),status:job.attempts>=7?'FAILED':'PENDING'}}); this.logger.warn('Email delivery failed; retry recorded.'); }
      }
    } finally { transport.close(); this.running=false; }
  }
}

