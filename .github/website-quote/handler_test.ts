// Offline tests: no requests leave this process and no database is used.
import {assertEquals,assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';
const source=await Deno.readTextFile(new URL('./index.ts',import.meta.url));
let reserve:any={outcome:'created'}, sendCount=0, updates:any[]=[];
let configured=true, storageError=false, providerFails=false;
const trace:string[]=[];
(globalThis as any).__quoteMock={
  env:(name:string)=>name==='QUOTE_RESEND_API_KEY'&&!configured?undefined:name==='SUPABASE_URL'?'https://local.invalid':'TEST_ONLY',
  db:{
    rpc:async()=>{trace.push('saved');return {data:reserve,error:storageError?new Error('test'):null};},
    from:()=>({update:(value:any)=>({eq:async()=>{updates.push(value);return {error:null};}})})
  }
};
const moduleSource=source
  .replace(/import \{createClient\} from '[^']+';/,"const createClient=()=>globalThis.__quoteMock.db;")
  .replaceAll('Deno.env.get(', 'globalThis.__quoteMock.env(')
  .replace('Deno.serve(handler);','');
const {handler}=await import('data:application/typescript,'+encodeURIComponent(moduleSource));
globalThis.fetch=async()=>{
  trace.push('email');sendCount++;
  return new Response(JSON.stringify(providerFails?{message:'test rejection'}:{id:'mock-email-id'}),{status:providerFails?503:200});
};
const valid={id:'03cd96a8-90ef-4f9a-994f-a84002f64635',name:'Test Only',phone:'228-229-4704',email:'test@example.com',service:'Other',website:'',message:'No real submission'};
const request=(body:any,origin='https://durdenroofcare.com',method='POST')=>new Request('https://local.invalid',{method,headers:{origin,'Content-Type':'application/json','x-forwarded-for':'192.0.2.1'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
Deno.test('request validation, durable receipt, no duplicate email and provider failure',async()=>{
  assertEquals((await handler(request(valid,'https://evil.invalid'))).status,403);
  assertEquals((await handler(request(valid,undefined,'GET'))).status,405);
  assertEquals((await handler(request(valid,undefined,'OPTIONS'))).status,204);
  for(const patch of [{name:''},{email:'bad'},{phone:'3'},{website:'bot'},{message:'a'.repeat(4001)},{service:'Unlisted'},{id:'invalid'},{name:4},{email:'x@y.com\nbad'}]){
    assertEquals((await handler(request({...valid,...patch}))).status,400);
  }
  assertEquals(sendCount,0);
  configured=false;assertEquals((await handler(request(valid))).status,503);configured=true;
  storageError=true;assertEquals((await handler(request(valid))).status,503);storageError=false;
  assertEquals(sendCount,0);
  trace.length=0;
  const success=await (await handler(request(valid))).json();
  assertEquals(success,{ok:true,reference:'DRC-03CD96A8',notification:'accepted'});
  assertEquals(trace,['saved','email']);
  assertEquals(updates.at(-1).notification_status,'accepted');
  reserve={outcome:'duplicate',notification:'accepted'};
  assertEquals((await (await handler(request(valid))).json()).notification,'accepted');
  assertEquals(sendCount,1);
  reserve={outcome:'limited'};assertEquals((await handler(request(valid))).status,429);
  reserve={outcome:'conflict'};assertEquals((await handler(request(valid))).status,409);
  assertEquals(sendCount,1);
  reserve={outcome:'created'};providerFails=true;
  const failure=await (await handler(request(valid))).json();
  assertEquals(failure.ok,true);assertEquals(failure.notification,'unconfirmed');
  assertEquals(updates.at(-1).error_code,'provider_503');
  assert(!JSON.stringify(failure).includes('test@example.com'));
});
