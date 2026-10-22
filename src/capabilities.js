const present = (object, key) => !!object && key in object;
export function detectCapabilities(env=globalThis) {
  const n=env.navigator??{};
  const storage=n.storage??{};
  return {
    secureContext:env.isSecureContext===true,
    serviceWorker:present(n,"serviceWorker"),
    webGPU:present(n,"gpu"),
    webAssembly:present(env,"WebAssembly"),
    webWorkers:typeof env.Worker==="function",
    indexedDB:present(env,"indexedDB"),
    opfs:typeof storage.getDirectory==="function",
    camera:typeof n.mediaDevices?.getUserMedia==="function",
    geolocation:present(n,"geolocation"),
    webUSB:present(n,"usb"),
    webBluetooth:present(n,"bluetooth"),
    webHID:present(n,"hid"),
    webSerial:present(n,"serial"),
    webNFC:present(env,"NDEFReader"),
    persistentStorage:typeof storage.persist==="function"
  };
}
export async function inspectCapabilities(env=globalThis) {
  const available=detectCapabilities(env);
  const checks={};
  for(const [name,exposed] of Object.entries(available)) {
    checks[name]={state:exposed?"exposed":"unavailable"};
  }
  // Feature presence does not imply hardware access, permission or device support.
  if(available.webGPU) {
    try{
      const adapter=await env.navigator.gpu.requestAdapter();
      checks.webGPU={state:adapter?"adapter-ready":"unavailable",reason:adapter?"Adapter obtained; workload still unverified":"No adapter"};
    }catch(error){checks.webGPU={state:"error",reason:String(error?.message??error)};}
  }
  try {
    if(env.navigator?.storage?.estimate) {
      const estimate=await env.navigator.storage.estimate();
      checks.storage={state:"measured",quota:estimate.quota??null,usage:estimate.usage??null};
    } else checks.storage={state:"unavailable"};
  }catch(error){checks.storage={state:"error",reason:String(error?.message??error)};}
  try {
    const persistent=!!(await env.navigator?.storage?.persisted?.());
    checks.persistence={state:persistent?"granted":"not-granted"};
  }catch(error){checks.persistence={state:"error",reason:String(error?.message??error)};}
  return {
    available,checks,policy:{nativeWrapperRequired:false,permissionBypass:false,guaranteedBackgroundTasks:false},
    checkedAt:new Date().toISOString()
  };
}

