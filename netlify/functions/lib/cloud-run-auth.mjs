/* Cloud Run IAM caller identity for the private Stitch Forge staging worker.
 * A Google-signed ID token is retrieved using a restricted service-account
 * credential. This stays server-side and MUST only be set in Netlify's
 * deploy-preview functions context, never in the browser or source control.
 */
import {createSign} from "node:crypto";
const TOKEN_ENDPOINT="https://oauth2.googleapis.com/token";
const BASE64=s=>Buffer.from(s).toString("base64url");
export function cloudRunAudience(endpoint){
 const url=new URL(endpoint);
 if(url.protocol!=="https:"||!url.hostname.endsWith(".run.app")||
    url.hostname==="run.app"||url.port||url.username||url.password||
    url.pathname!=="/v1/digitise"||url.search||url.hash)
  throw Error("Invalid private Cloud Run endpoint");
 // Cloud Run IAM requires the canonical *service* audience even when the
 // HTTPS request targets a traffic-tagged revision (tag---service.run.app).
 // Do not use the tagged URL as the ID-token audience.
 const marker=url.hostname.indexOf('---');
 if(marker<0)return url.origin;
 const tag=url.hostname.slice(0,marker);
 const serviceHost=url.hostname.slice(marker+3);
 if(!/^[a-z][a-z0-9-]{0,62}$/.test(tag)||
    !/^[a-z0-9][a-z0-9.-]*\.run\.app$/.test(serviceHost)||
    serviceHost.includes('---'))
   throw Error("Invalid private Cloud Run traffic-tag URL");
 return 'https://'+serviceHost;
}
export async function acquireCloudRunIdToken(endpoint, credential, {
 fetchImpl=fetch, epoch=Math.floor(Date.now()/1000)
}={}){
 const audience=cloudRunAudience(endpoint);
 let key;
 try{key=JSON.parse(credential||"");}catch{throw Error("Missing private Cloud Run caller credentials");}
 if(key?.type!=="service_account"||
    !/^[a-z0-9._-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/i.test(key.client_email||"")||
    typeof key.private_key!=="string"||!key.private_key.includes("BEGIN PRIVATE KEY"))
  throw Error("Invalid private Cloud Run caller credentials");
 const header={alg:"RS256",typ:"JWT"};
 if(typeof key.private_key_id==="string"&&/^[a-f0-9]{40}$/i.test(key.private_key_id))
  header.kid=key.private_key_id;
 const claim={iss:key.client_email,sub:key.client_email,aud:TOKEN_ENDPOINT,
   iat:epoch,exp:epoch+1800,target_audience:audience};
 const unsigned=BASE64(JSON.stringify(header))+"."+BASE64(JSON.stringify(claim));
 const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();
 let signature;
 try{signature=signer.sign(key.private_key).toString("base64url");}
 catch{throw Error("Could not sign Cloud Run caller identity");}
 const form=new URLSearchParams({
  grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
  assertion:unsigned+"."+signature
 });
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetchImpl(TOKEN_ENDPOINT,{method:"POST",signal:controller.signal,
   headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),
   redirect:"error"});
  if(!response.ok)throw Error("Google rejected private Cloud Run identity");
  const body=await response.json();
  const token=body?.id_token;
  if(typeof token!=="string"||token.length>12000||
     !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
   throw Error("Google did not return a valid Cloud Run ID token");
  return token;
 }finally{clearTimeout(timer);}
}
