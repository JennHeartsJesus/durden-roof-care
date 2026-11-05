import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const origins = new Set(['https://durdenroofcare.com','https://www.durdenroofcare.com']);
const services = new Set(['Roof Replacement','Roof Repair','Storm / Hurricane Damage','Commercial Roofing','Inspection / Estimate','Other']);
const limits: Record<string,number> = {name:120,phone:40,email:254,address:240,city:100,state:50,zip:20,service:80,message:4000};
const encoder = new TextEncoder();
const sha256 = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const safeBody = async (req:Request) => {
  const reader=req.body?.getReader(); if(!reader) throw new Error('body');
  const chunks:Uint8Array[]=[]; let length=0;
  for (;;) {
    const {done,value}=await reader.read(); if(done) break;
    length+=value.length; if(length>16000){await reader.cancel();throw new Error('size');}
    chunks.push(value);
  }
  const all=new Uint8Array(length); let at=0;
  for(const part of chunks){all.set(part,at);at+=part.length;}
  return JSON.parse(new TextDecoder().decode(all));
};

export async function handler(req:Request):Promise<Response> {
  const origin=req.headers.get('origin')||'';
  const headers:Record<string,string>={
    'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
  };
  if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(!origins.has(origin))return reply({ok:false,error:'origin'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({ok:false,error:'method'},405);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({ok:false,error:'format'},415);
  let body:Record<string,unknown>;
  try{body=await safeBody(req);}catch{return reply({ok:false,error:'invalid'},400);}
  if(!body||Array.isArray(body)||typeof body!=='object')return reply({ok:false,error:'invalid'},400);
  if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))return reply({ok:false,error:'invalid'},400);
  if(body.website!==''&&body.website!==undefined)return reply({ok:false,error:'invalid'},400);
  const data:Record<string,string>={};
  for(const [field,max] of Object.entries(limits)){
    const value=body[field]??'';
    if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return reply({ok:false,error:'invalid'},400);
    data[field]=value.trim();
  }
  if(!data.name||!data.phone||!data.email||/[\r\n]/.test(data.name+data.email+data.phone)
    ||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ||data.phone.replace(/\D/g,'').length<7||data.phone.replace(/\D/g,'').length>15
    ||!services.has(data.service))return reply({ok:false,error:'invalid'},400);
  data.email=data.email.toLowerCase();
  const key=Deno.env.get('QUOTE_RESEND_API_KEY');
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url=Deno.env.get('SUPABASE_URL');
  // Fail closed before accepting traffic if the deployment is incomplete.
  if(!key||!serviceRole||!url)return reply({ok:false,error:'unavailable'},503);
  const db=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const reference='DRC-'+body.id.slice(0,8).toUpperCase();
  try{
    // IP is used only as a keyed hash. Never persist/log the raw address.
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
    const [payloadHash,ipHash,emailHash]=await Promise.all([
      sha256(JSON.stringify(data)),sha256(serviceRole+':ip:'+ip),sha256(serviceRole+':email:'+data.email)
    ]);
    const {data:reserved,error}=await db.rpc('reserve_website_quote',{
      request_id:body.id,request_payload:data,request_hash:payloadHash,source_hash:ipHash,sender_hash:emailHash
    });
    if(error||!reserved)return reply({ok:false,error:'unavailable'},503);
    if(reserved.outcome==='conflict')return reply({ok:false,error:'conflict'},409);
    if(reserved.outcome==='limited')return reply({ok:false,error:'limited'},429);
    if(reserved.outcome==='duplicate')
      return reply({ok:true,reference,notification:reserved.notification==='accepted'?'accepted':'unconfirmed'});
    if(reserved.outcome!=='created')return reply({ok:false,error:'unavailable'},503);
    // The request is now durable. Email is a notification, not the only copy.
    let providerId:string|null=null; let errorCode='transport';
    try{
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'website-quote/'+body.id},
        body:JSON.stringify({
          from:'Durden Roof Care Website <quotes@durdenroofcare.com>',
          to:['durdenroofcare@gmail.com'],
          reply_to:data.email,
          subject:'New Quote Request - DurdenRoofCare.com',
          text:'New website quote request\nReference: '+reference+'\n\n'+
            Object.entries(data).map(([name,value])=>name.toUpperCase()+': '+(value||'(not supplied)')).join('\n\n')+
            '\n\nA private backup of this request is saved in Supabase > website_quote_requests.',
        }),
        signal:AbortSignal.timeout(12000),
      });
      const result=await response.json();
      if(response.ok&&typeof result.id==='string')providerId=result.id;
      else errorCode='provider_'+response.status;
    }catch{/* Do not print customer data, API credentials or raw provider replies. */}
    const notification=providerId?'accepted':'unconfirmed';
    const {error:updateError}=await db.from('website_quote_requests').update({
      notification_status:notification,provider_id:providerId,
      notified_at:providerId?new Date().toISOString():null,error_code:providerId?null:errorCode,
    }).eq('id',body.id);
    if(updateError)console.error('quote_notification_status_write_failed');
    return reply({ok:true,reference,notification});
  }catch{return reply({ok:false,error:'unavailable'},503);}
}

Deno.serve(handler);
