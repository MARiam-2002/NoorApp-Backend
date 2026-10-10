export function addEmailVerificationOpenApi(spec: any) {
 const schemas=spec.components.schemas;
 schemas.EmailVerificationPending={type:'object',required:['verificationRequired','verificationId','expiresAt','resendAfterSeconds','codeLength'],properties:{verificationRequired:{type:'boolean',enum:[true]},verificationId:{type:'string',format:'uuid'},expiresAt:{type:'string',format:'date-time'},resendAfterSeconds:{type:'integer',example:60},codeLength:{type:'integer',enum:[6]}}};
 const result=(schema:any)=>({description:'Success',content:{'application/json':{schema:{allOf:[{$ref:'#/components/schemas/ApiResponse'},{type:'object',properties:{data:schema}}]}}}});
 const errors={400:{description:'Invalid input, expired code, replay or five failed attempts'},429:{description:'Rate limit or resend cooldown'},503:{description:'Email provider unavailable; registration is not completed'}};
 spec.paths['/auth/sign-up'] ||= {};
 spec.paths['/auth/sign-up'].post={tags:['Auth'],summary:'Start email-verified registration',description:'Sends a six-digit code valid for ten minutes. No account or tokens are created until verification. Accepts Gmail and other valid email providers. Existing accounts are unaffected.',requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/SignupRequest'}}}},responses:{202:result({$ref:'#/components/schemas/EmailVerificationPending'}),409:{description:'Email already registered'},...errors},security:[]};
 for(const [path,verify] of [['/auth/verify-email',true],['/auth/resend-verification',false]] as const) {
 const properties:any={verificationId:{type:'string',format:'uuid'}};if(verify)properties.code={type:'string',pattern:'^[0-9]{6}$',example:'012345'};
 spec.paths[path]={post:{tags:['Auth'],summary:verify?'Verify email and create account; then log in':'Resend verification code',security:[],requestBody:{required:true,content:{'application/json':{schema:{type:'object',additionalProperties:false,required:verify?['verificationId','code']:['verificationId'],properties}}}},responses:{[verify?200:202]:result(verify?{type:'object',properties:{emailVerified:{type:'boolean',enum:[true]},loginRequired:{type:'boolean',enum:[true]}}}:{$ref:'#/components/schemas/EmailVerificationPending'}),...errors}}};
 }
}
