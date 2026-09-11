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
  supports(channel:'EMAIL'|'PHONE') { return channel==='EMAIL'?!!config.SMTP_URL:!!config.SMS_WEBHOOK_URL; }
  async enqueue(tx:Tx,email:string,subject:string,text:string,userId?:string) {
    await tx.outbox.create({data:{encryptedPayload:encrypt(JSON.stringify({channel:'EMAIL',to:email,subject,text}))}});
    if(userId) await tx.notification.create({data:{userId,title:subject,message:subject}});
  }
  async enqueueSms(tx:Tx,phone:string,text:string,userId?:string) {
    await tx.outbox.create({data:{encryptedPayload:encrypt(JSON.stringify({channel:'PHONE',to:phone,text}))}});
    if(userId) await tx.notification.create({data:{userId,title:'Phone verification code',message:'A phone verification code was requested.'}});
  }
  onModuleInit() { if(config.SMTP_URL||config.SMS_WEBHOOK_URL) this.timer=setInterval(()=>{void this.flush()},5000); }
  onModuleDestroy() { if(this.timer) clearInterval(this.timer); }
  async flush() {
    if((!config.SMTP_URL&&!config.SMS_WEBHOOK_URL) || this.running) return;
    this.running=true;
    const transport=config.SMTP_URL?nodemailer.createTransport(config.SMTP_URL):null;
    try {
      const jobs=await this.db.outbox.findMany({where:{status:'PENDING',nextAttempt:{lte:new Date()},OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-300000)}}]},take:20,orderBy:{createdAt:'asc'}});
      for(const job of jobs) {
        const claim=await this.db.outbox.updateMany({where:{id:job.id,status:'PENDING',OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-300000)}}]},data:{lockedAt:new Date()}});
        if(!claim.count) continue;
        try {
          const payload=JSON.parse(decrypt(job.encryptedPayload).toString()) as {channel?:'EMAIL'|'PHONE';to:string;subject?:string;text:string};
          if(payload.channel==='PHONE') {
            if(!config.SMS_WEBHOOK_URL) throw new Error('SMS delivery is not configured.');
            const response=await fetch(config.SMS_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json',...(config.SMS_WEBHOOK_TOKEN?{Authorization:`Bearer ${config.SMS_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify({to:payload.to,message:payload.text}),signal:AbortSignal.timeout(10000)});
            if(!response.ok) throw new Error('SMS provider rejected delivery.');
          } else {
            if(!transport) throw new Error('Email delivery is not configured.');
            await transport.sendMail({from:config.MAIL_FROM,to:payload.to,subject:payload.subject,text:payload.text});
          }
          await this.db.outbox.update({where:{id:job.id},data:{status:'SENT',encryptedPayload:encrypt('{}'),lockedAt:null}});
        }
        catch { await this.db.outbox.update({where:{id:job.id},data:{attempts:{increment:1},lockedAt:null,nextAttempt:new Date(Date.now()+Math.min(86400000,30000*2**job.attempts)),status:job.attempts>=7?'FAILED':'PENDING'}}); this.logger.warn('Notification delivery failed; retry recorded.'); }
      }
    } finally { transport?.close(); this.running=false; }
  }
}
