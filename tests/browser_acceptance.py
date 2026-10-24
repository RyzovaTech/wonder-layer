"""PWA real-browser acceptance. Requires pip install playwright; playwright install chromium."""
import argparse
import contextlib
import http.server
import json
import hashlib
import tempfile
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *_):
        pass

@contextlib.contextmanager
def local_server():
    class Server(http.server.ThreadingHTTPServer):
        allow_reuse_address = True
    srv = Server(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{srv.server_address[1]}/examples/basic-pwa/"
    finally:
        srv.shutdown()
        srv.server_close()
        thread.join(timeout=3)

def run(browser_name="chromium", executable_path=None, profile="desktop", channel=None):
    from playwright.sync_api import sync_playwright
    report = {"schema": "wonder-phase6-browser-v3", "date": datetime.now(timezone.utc).isoformat(),
              "browser": browser_name, "profile": profile, "channel": channel,
              "checks": [], "status": "not-run"}
    ctx = None
    try:
        with local_server() as url, tempfile.TemporaryDirectory() as user_profile, sync_playwright() as p:
            profile_mode=profile
            if profile_mode not in ("desktop","mobile"):
                raise ValueError("Unsupported browser profile")
            if browser_name=="firefox" and profile_mode=="mobile":
                raise ValueError("Playwright Firefox does not support mobile context emulation")
            browser = getattr(p, browser_name)
            launch_args={"headless":True,"service_workers":"allow","accept_downloads":True}
            if executable_path: launch_args["executable_path"]=executable_path
            if channel:
                if browser_name!="chromium": raise ValueError("Browser channel is only supported for Chromium")
                launch_args["channel"]=channel
            if profile_mode=="mobile":
                launch_args.update(is_mobile=True,has_touch=True,
                    viewport={"width":390,"height":844},device_scale_factor=3)
            ctx = browser.launch_persistent_context(user_profile, **launch_args)
            page = ctx.new_page()
            def check(name, fn):
                try:
                    detail=fn()
                except Exception as exc:
                    report["checks"].append({"name":name,"status":"fail",
                                             "error":str(exc)[:1500]})
                    raise
                check_status="unsupported" if isinstance(detail, dict) and detail.get("state")=="unsupported" else "pass"
                report["checks"].append({"name": name, "status": check_status, "detail": detail})
            def navigation():
                response = page.goto(url, wait_until="load", timeout=25000)
                assert response and response.ok, "Page failed to load"
                return {"http": response.status, "title": page.title()}
            check("online_navigation", navigation)
            report["userAgent"] = page.evaluate("navigator.userAgent")
            report["runtime"] = page.evaluate("""() => ({
              viewport:{width:innerWidth,height:innerHeight},
              touchPoints:navigator.maxTouchPoints,
              secureContext:isSecureContext,
              standalone:matchMedia("(display-mode: standalone)").matches
            })""")
            if profile_mode=="mobile":
                # Linux WebKit may report 0 maxTouchPoints even with a touch-enabled
                # Playwright context. Verify configured viewport independently,
                # and record browser-reported touch as evidence rather than invent it.
                browser_viewport=page.viewport_size
                report["runtime"]["playwrightViewport"]=browser_viewport
                report["runtime"]["reportedTouchSupport"]=report["runtime"]["touchPoints"]>0
                if browser_viewport is None or browser_viewport["width"]>500:
                    raise AssertionError("Mobile viewport configuration was not applied")
            def controlled():
                page.reload(wait_until="load")
                page.wait_for_function("() => !!navigator.serviceWorker?.controller", timeout=15000)
                return page.evaluate("navigator.serviceWorker.controller.scriptURL")
            check("service_worker_control", controlled)
            def ui_keyboard_and_responsive_layout():
                title=page.locator("h1")
                assert title.is_visible(), "Hero title missing"
                assert page.locator("html").get_attribute("lang")=="en", "Document language missing"
                assert page.locator("textarea#note").get_attribute("id")=="note"
                dimensions=page.evaluate("""() => ({
                  screen: document.documentElement.clientWidth,
                  scroll: document.documentElement.scrollWidth,
                  controls: Array.from(document.querySelectorAll("button")).length
                })""")
                assert dimensions["scroll"]<=dimensions["screen"]+3, "Horizontal overflow in application"
                assert dimensions["controls"]>=8
                return dimensions
            check("basic_accessibility_and_layout",ui_keyboard_and_responsive_layout)
            def save():
                page.locator("#note").fill("wonder-phase2-offline-proof")
                page.locator("#save").click()
                page.get_by_text("Saved on this device.", exact=False).wait_for(timeout=12000)
                return "saved locally"
            check("indexeddb_write", save)
            def recoverable_backup():
                with page.expect_download(timeout=12000) as pending:
                    page.locator("#export").click()
                with tempfile.TemporaryDirectory() as tmp:
                    target=Path(tmp)/"backup.json"
                    pending.value.save_as(target)
                    backup=json.loads(target.read_text(encoding="utf8"))
                assert backup["format"]=="ryzova-wonder-recovery"
                assert backup["version"]==2 and backup["algorithm"]=="SHA-256"
                normalized=sorted(backup["records"],key=lambda r:r["id"])
                payload=json.dumps(normalized,ensure_ascii=False,separators=(",",":"))
                checksum=hashlib.sha256(payload.encode("utf8")).hexdigest()
                assert checksum==backup["checksum"], "backup checksum mismatch"
                assert any(r["id"]=="local-note" for r in backup["records"])
                return {"records":len(backup["records"]),"integrity":"sha256"}
            check("version2_backup_checksum",recoverable_backup)
            def unsaved_update_guard():
                page.locator("#note").fill("UNSAVED user typing")
                page.locator("#apply-update").click()
                page.get_by_text("Save your current note locally before activating the update.",exact=False).wait_for(timeout=10000)
                page.locator("#load").click()
                page.wait_for_function("() => document.querySelector('#note').value==='wonder-phase2-offline-proof'",timeout=10000)
                return "unsaved in-memory edits cannot trigger worker update"
            check("unsaved_changes_block_activation",unsaved_update_guard)
            def storage_health():
                page.locator("#storage-check").click()
                page.wait_for_function("""() => document.querySelector("#storage-status").textContent.includes('"evictionPossible"')""",timeout=12000)
                health=json.loads(page.locator("#storage-status").inner_text())
                assert "evictionPossible" in health
                return {"quota":health.get("quota"),"persisted":health.get("persisted")}
            check("storage_health_report",storage_health)
            def compute():
                page.locator("#count").select_option("65536")
                page.locator("#compute").click()
                page.wait_for_function("""() => {
                    const s=document.querySelector("#compute-status").textContent;
                    return s.includes('"backend"') || s.startsWith("Compute failed:");
                }""", timeout=50000)
                data = json.loads(page.locator("#compute-status").inner_text())
                assert data["backend"] in ("gpu", "wasm", "worker", "js")
                assert abs(data["firstValues"][0]-2)<0.001
                return {"backend": data["backend"], "ms": data["elapsedMs"], "fallbacks": data["failedAttempts"]}
            check("adaptive_compute", compute)

            def explicit_backend_parity():
                return page.evaluate("""async () => {
                    const {createAdaptiveEngine} = await import("/src/wonder.js");
                    const input=Float32Array.from({length:4096},(_,i)=>(i%101)/4);
                    const engine=createAdaptiveEngine();
                    const result={};
                    for(const backend of ["js","wasm","worker"]){
                      if(backend==="worker" && typeof Worker==="undefined"){
                        result.worker={state:"unsupported"};continue;
                      }
                      const started=performance.now();
                      const output=await engine.run(input,{prefer:backend});
                      if(output.backend!==backend)throw Error("Unexpected backend: "+output.backend);
                      for(let i=0;i<input.length;i++){
                        const expected=Math.fround(Math.fround(input[i]*1.5)+2);
                        if(Math.abs(output.data[i]-expected)>0.001)
                          throw Error(backend+" mismatch at "+i);
                      }
                      result[backend]={state:"verified",elapsedMs:Number((performance.now()-started).toFixed(3))};
                    }
                    const gpuAvailable=typeof navigator.gpu?.requestAdapter==="function";
                    let adapter=null;
                    if(gpuAvailable)adapter=await navigator.gpu.requestAdapter();
                    if(!adapter){result.gpu={state:"unsupported",reason:"No WebGPU adapter"};}
                    else{
                      const large=Float32Array.from({length:65536},(_,i)=>(i%101)/4);
                      const gpu=await engine.run(large,{prefer:"gpu"});
                      if(gpu.backend!=="gpu")throw Error("GPU dispatch did not execute");
                      result.gpu={state:"verified",elements:large.length,elapsedMs:gpu.durationMs};
                    }
                    return result;
                }""")
            check("explicit_backend_numerical_parity",explicit_backend_parity)
            def corrupted_backup_rejected():
                return page.evaluate("""async () => {
                    const {createWonderLayer} = await import("/src/wonder.js");
                    const wonder=await createWonderLayer({dbName:"wonder-phase6-recovery-proof"});
                    try{
                      await wonder.store.save("keep","safe");
                      const original=await wonder.backup();
                      const modified=original.replace("safe","tampered");
                      let rejected=false;
                      try{await wonder.recovery.restore(modified);}catch(e){
                        rejected=/checksum mismatch/.test(String(e.message));
                      }
                      const rows=await wonder.store.listRecords();
                      if(!rejected||rows.length!==1||rows[0].content!=="safe")
                        throw Error("Corrupted backup changed storage");
                      return {integrity:"verified",recordPreserved:true};
                    }finally{wonder.close();}
                }""")
            check("corrupted_backup_preserves_data",corrupted_backup_rejected)
            def sync_data_exfiltration_guard():
                return page.evaluate("""async () => {
                  const {createWonderLayer}=await import("/src/wonder.js");
                  const layer=await createWonderLayer({dbName:"wonder-phase7-exfil-proof"});
                  const originalFetch=window.fetch;
                  let calls=0;
                  try{
                    await layer.store.save("local-secret","never uploaded");
                    window.fetch=async()=>{calls++;throw Error("Unexpected outgoing fetch");};
                    let blocked=false;
                    try{await layer.store.sync("https://untrusted.example.invalid/collect");}
                    catch(error){blocked=/Cross-origin sync is forbidden/.test(String(error.message));}
                    const pending=await layer.store.pending();
                    const saved=await layer.store.listRecords();
                    if(!blocked||calls!==0||pending.length!==1||
                       saved[0].content!=="never uploaded")throw Error("Local sync exfil guard failed");
                    return {blocked:true,fetchCalls:0,recordRetained:true};
                  }finally{window.fetch=originalFetch;layer.close();}
                }""")
            check("cross_origin_sync_has_no_network_or_data_loss",sync_data_exfiltration_guard)
            def device_lab_no_automatic_permissions():
                lab=ctx.new_page()
                try:
                    response=lab.goto(url.split("/examples/")[0]+"/examples/device-lab/",
                                      wait_until="load",timeout=25000)
                    assert response and response.ok, "Physical device lab page unavailable"
                    lab.locator("#tests button[data-test]").first.wait_for(timeout=15000)
                    assert lab.locator("#tests button[data-test]").count()>=8
                    lab.wait_for_function("""() => document.querySelector("#context")?.textContent.includes("Secure browser context")""",
                                          timeout=10000)
                    assert "Nothing requested" in lab.locator("#status").inner_text()
                    return {"deviceLabLoaded":True,"permissionRequestedWithoutClick":False}
                finally:
                    lab.close()
            check("device_lab_loads_without_permission_prompts",device_lab_no_automatic_permissions)
            def device_lab_synthetic_offline_recovery():
                lab=ctx.new_page()
                try:
                    address=url.split("/examples/")[0]+"/examples/device-lab/"
                    response=lab.goto(address,wait_until="load",timeout=25000)
                    assert response and response.ok
                    lab.wait_for_function("""() => !!navigator.serviceWorker?.controller""",timeout=20000)
                    lab.locator("#save-synthetic").click()
                    lab.get_by_text("Saved synthetic value locally.",exact=False).wait_for(timeout=20000)
                    ctx.set_offline(True)
                    try:
                        lab.reload(wait_until="load",timeout=20000)
                        lab.locator("#read-synthetic").click()
                        lab.get_by_text("PASS: synthetic value recovered",exact=False).wait_for(timeout=20000)
                    finally:
                        ctx.set_offline(False)
                    return {"offlinePwaShell":True,"syntheticIndexedDBRetained":True,
                            "noRealUserData":True}
                finally:
                    lab.close()
            check("device_lab_synthetic_offline_recovery",device_lab_synthetic_offline_recovery)
            def pwa_manifest_assets():
                return page.evaluate("""async () => {
                  const link=document.querySelector('link[rel="manifest"]');
                  if(!link)throw Error("Missing manifest");
                  const response=await fetch(link.href);
                  if(!response.ok)throw Error("Manifest unavailable");
                  const manifest=await response.json();
                  if(manifest.display!=="standalone" || !manifest.icons?.length)
                    throw Error("Unexpected manifest configuration");
                  const checked=[];
                  for(const icon of manifest.icons){
                    const r=await fetch(new URL(icon.src,response.url));
                    if(!r.ok)throw Error("Missing icon: "+icon.src);
                    const bytes=await r.arrayBuffer();
                    if(bytes.byteLength<100)throw Error("Invalid tiny icon: "+icon.src);
                    checked.push({size:icon.sizes,bytes:bytes.byteLength});
                  }
                  return {manifestValid:true,icons:checked};
                }""")
            check("manifest_and_install_icon_assets",pwa_manifest_assets)
            def geolocation_permission_flow():
                if browser_name!="chromium":
                    return {"state":"unsupported","reason":"Only Chromium geolocation override validated in this CI"}
                if not page.evaluate("!!navigator.geolocation"):
                    return {"state":"unsupported","reason":"Geolocation API not exposed"}
                origin=url.split("/examples/")[0]
                ctx.set_geolocation({"latitude":0,"longitude":0,"accuracy":11})
                ctx.grant_permissions(["geolocation"],origin=origin)
                page.locator("#geo-test").click()
                page.get_by_text("Location obtained; reported accuracy: 11 meters.",exact=False).wait_for(timeout=15000)
                ctx.grant_permissions([],origin=origin)
                page.reload(wait_until="load")
                permission_state=page.evaluate("""async () => {
                    try {return (await navigator.permissions.query({name:"geolocation"})).state}
                    catch {return "unqueryable"}
                }""")
                if permission_state!="denied":
                    # Browser-managed permission profiles vary (notably managed Edge).
                    # Treat an unverified deny override as UNSUPPORTED, never as PASS.
                    return {"state":"unsupported",
                            "reason":"Browser did not expose deterministic denied permission after override",
                            "permissionState":permission_state,
                            "permissionGranted":True,"permissionDenied":False}
                page.locator("#geo-test").click()
                page.wait_for_function("""() => {
                    const status=document.querySelector("#hardware-status")?.textContent??"";
                    return status.startsWith("PERMISSION_DENIED:") ||
                           status.startsWith("TIMEOUT:") ||
                           status.startsWith("DEVICE_ERROR:") ||
                           status.startsWith("Location obtained;");
                }""",timeout=15000)
                outcome=page.locator("#hardware-status").inner_text()
                assert outcome.startswith("PERMISSION_DENIED:"), (
                    "Denied permission was not classified as PERMISSION_DENIED: "+outcome)
                return {"state":"verified","permissionGranted":True,"permissionDenied":True,
                        "coordinatesStored":False}
            check("geolocation_permission_granted_and_denied",geolocation_permission_flow)


            def opfs():
                return page.evaluate("""async () => {
                    if (!navigator.storage?.getDirectory) return {state:"unsupported"};
                    const root=await navigator.storage.getDirectory();
                    const h=await root.getFileHandle("wonder-phase2.txt",{create:true});
                    const w=await h.createWritable(); await w.write("opfs-proof"); await w.close();
                    const text=await(await h.getFile()).text();
                    if(text!=="opfs-proof") throw Error("OPFS mismatch");
                    return {state:"verified"};
                }""")
            check("opfs_roundtrip_if_supported", opfs)
            def offline():
                ctx.set_offline(True)
                page.reload(wait_until="load", timeout=20000)
                page.locator("#load").click()
                page.wait_for_function("() => document.querySelector('#note').value.includes('wonder-phase2-offline-proof')", timeout=12000)
                return "offline reload and local record recovered"
            check("offline_reload", offline)
            def restart():
                nonlocal ctx, page
                ctx.close()
                restart_args={"headless":True,"offline":True,"service_workers":"allow"}
                if executable_path: restart_args["executable_path"]=executable_path
                if channel: restart_args["channel"]=channel
                if profile_mode=="mobile":
                    restart_args.update(is_mobile=True,has_touch=True,
                        viewport={"width":390,"height":844},device_scale_factor=3)
                ctx=browser.launch_persistent_context(user_profile, **restart_args)
                page=ctx.new_page()
                page.goto(url,wait_until="load",timeout=20000)
                page.locator("#load").click()
                page.wait_for_function("() => document.querySelector('#note').value.includes('wonder-phase2-offline-proof')", timeout=12000)
                return "cold browser reopen offline succeeded"
            check("cold_offline_restart", restart)
            report["status"]="pass"
    except Exception as exc:
        msg=str(exc)
        blocked=any(word in msg for word in ("ERR_BLOCKED_BY_ADMINISTRATOR", "Executable doesn't exist", "Could not find executable", "BrowserType.launch"))
        report["status"]="blocked" if blocked else "fail"
        report["error"]=msg[:1000]
        report["trace"]=traceback.format_exc()[-2000:]
    finally:
        if ctx:
            with contextlib.suppress(Exception): ctx.close()
    return report

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--browser", choices=("chromium","firefox","webkit"), default="chromium")
    parser.add_argument("--profile",choices=("desktop","mobile"),default="desktop",
                        help="Mobile emulation is available for Chromium and WebKit only")
    parser.add_argument("--output", default="results/phase6-browser-acceptance.json")
    parser.add_argument("--executable-path", default=None, help="Optional existing browser binary; OS policies still apply")
    parser.add_argument("--channel",default=None,help="Optional Chromium browser channel, e.g. msedge")
    args=parser.parse_args()
    report=run(args.browser,args.executable_path,args.profile,args.channel)
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"status":report["status"],"checks":report["checks"],"error":report.get("error")},indent=2))
    raise SystemExit(0 if report["status"]=="pass" else 2 if report["status"]=="blocked" else 1)
