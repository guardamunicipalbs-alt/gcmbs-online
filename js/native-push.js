// GCMBS 10.0.75 — integração Push nativa autocontida.
const isNative=()=>Boolean(globalThis.Capacitor?.isNativePlatform?.() || globalThis.Capacitor?.getPlatform?.()==='android');
const plugin=()=>globalThis.Capacitor?.Plugins?.PushNotifications || null;

export async function configurarPushNativo(provider){
  if(!isNative()) return {native:false,configured:false};
  const Push=plugin();
  if(!Push) return {native:true,configured:false,message:'Plugin PushNotifications indisponível no runtime.'};
  try{
    let perm=await Push.checkPermissions();
    if(perm.receive==='prompt') perm=await Push.requestPermissions();
    if(perm.receive!=='granted') return {native:true,configured:false,message:'Permissão de notificações não concedida.'};
    await Push.addListener('registration',async token=>{
      try{
        const deviceKey='gcmbs.mobile.deviceId';
        if(!localStorage.getItem(deviceKey)) localStorage.setItem(deviceKey,crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`);
        await provider.registerPushToken(token.value,{platform:'android',device_id:localStorage.getItem(deviceKey)||'',app_version:'10.0.75'});
        localStorage.setItem('gcmbs.mobile.pushToken',token.value);
      }catch(e){console.error('[GCMBS PUSH] Falha ao registrar token:',e);}
    });
    await Push.addListener('registrationError',err=>console.error('[GCMBS PUSH] registrationError',err));
    await Push.addListener('pushNotificationReceived',()=>window.dispatchEvent(new CustomEvent('gcmbs:push-received')));
    await Push.addListener('pushNotificationActionPerformed',()=>window.dispatchEvent(new CustomEvent('gcmbs:push-opened')));
    await Push.register();
    return {native:true,configured:true};
  }catch(e){
    console.error('[GCMBS PUSH]',e);
    return {native:true,configured:false,message:e?.message||String(e)};
  }
}
