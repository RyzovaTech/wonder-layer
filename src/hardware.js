import {detectCapabilities} from "./capabilities.js";

export class WonderHardwareError extends Error {
  constructor(code,device,message,cause){
    super(message,{cause});
    this.name="WonderHardwareError";
    this.code=code;this.device=device;
  }
}
const allowed=new Set(["camera","microphone","geolocation","bluetooth","usb","hid","serial","nfc","clipboard-read","clipboard-write","share","wake-lock","file-open"]);
function capabilityName(kind){
  return ({camera:"camera",microphone:"camera",geolocation:"geolocation",bluetooth:"webBluetooth",
    usb:"webUSB",hid:"webHID",serial:"webSerial",nfc:"webNFC"})[kind]??kind;
}
function classify(error,kind){
  if(error instanceof WonderHardwareError)return error;
  // GeolocationPositionError uses numeric codes rather than DOMException.name.
  const geoDenied=kind==="geolocation"&&error?.code===1;
  const geoTimeout=kind==="geolocation"&&error?.code===3;
  const code=geoDenied||error?.name==="NotAllowedError"||error?.name==="PermissionDeniedError"?"PERMISSION_DENIED":
    geoTimeout?"TIMEOUT":
    error?.name==="AbortError"?"CANCELLED":error?.name==="NotFoundError"?"NOT_FOUND":"DEVICE_ERROR";
  return new WonderHardwareError(code,kind,String(error?.message??error),error);
}
export function createHardwareBridge({env=globalThis}={}){
  const nav=env.navigator??{};
  function state(){
    const caps=detectCapabilities(env);
    return {
      camera:caps.camera,microphone:caps.camera,
      geolocation:caps.geolocation,
      bluetooth:caps.webBluetooth,usb:caps.webUSB,hid:caps.webHID,
      serial:caps.webSerial,nfc:caps.webNFC,
      "clipboard-read":typeof nav.clipboard?.readText==="function",
      "clipboard-write":typeof nav.clipboard?.writeText==="function",
      share:typeof nav.share==="function",
      "wake-lock":typeof nav.wakeLock?.request==="function",
      "file-open":typeof env.showOpenFilePicker==="function",
      secureContext:env.isSecureContext===true
    };
  }
  async function request(kind,options={}){
    if(!allowed.has(kind))throw new WonderHardwareError("UNKNOWN_DEVICE",kind,"Unknown hardware capability");
    if(!options||typeof options!=="object"||Array.isArray(options))
      throw new WonderHardwareError("INVALID_OPTIONS",kind,"Options must be an object");
    if(env.isSecureContext===false)
      throw new WonderHardwareError("INSECURE_CONTEXT",kind,"Hardware access requires a secure context");
    if(state()[kind]!==true)
      throw new WonderHardwareError("UNSUPPORTED",kind,"Browser does not expose "+kind);
    try{
      switch(kind){
        case "camera":
        case "microphone":
          return await nav.mediaDevices.getUserMedia(kind==="camera"?
            {video:options.video??true,audio:options.audio??false}:
            {audio:options.audio??true,video:options.video??false});
        case "geolocation":
          return await new Promise((resolve,reject)=>nav.geolocation.getCurrentPosition(
            resolve,reject,{enableHighAccuracy:options.enableHighAccuracy===true,
              timeout:options.timeout??15000,maximumAge:options.maximumAge??0}));
        case "bluetooth":
          if(!options.acceptAllDevices&&(!Array.isArray(options.filters)||options.filters.length===0))
            throw new WonderHardwareError("INVALID_OPTIONS",kind,"Bluetooth requires filters or acceptAllDevices");
          return await nav.bluetooth.requestDevice(options);
        case "usb":
          return await nav.usb.requestDevice({filters:options.filters??[]});
        case "hid":
          return await nav.hid.requestDevice({filters:options.filters??[]});
        case "serial":
          return await nav.serial.requestPort({filters:options.filters??[]});
        case "nfc": {
          const reader=new env.NDEFReader();
          await reader.scan(options);
          return reader;
        }
        case "clipboard-read":return await nav.clipboard.readText();
        case "clipboard-write":
          if(typeof options.text!=="string")
            throw new WonderHardwareError("INVALID_OPTIONS",kind,"Clipboard requires text");
          await nav.clipboard.writeText(options.text);return true;
        case "share":
          if(!options.data||typeof options.data!=="object")
            throw new WonderHardwareError("INVALID_OPTIONS",kind,"Share requires data");
          await nav.share(options.data);return true;
        case "wake-lock":return await nav.wakeLock.request("screen");
        case "file-open":return await env.showOpenFilePicker(options);
      }
    }catch(error){throw classify(error,kind);}
  }
  return Object.freeze({runtime:"pure-pwa",capabilities:state,request});
}

