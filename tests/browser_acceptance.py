"""PWA real-browser acceptance. Requires pip install playwright; playwright install chromium."""
import argparse
import contextlib
import http.server
import json
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

def run(browser_name="chromium"):
    from playwright.sync_api import sync_playwright
    report = {"schema": "wonder-phase2-browser-v1", "date": datetime.now(timezone.utc).isoformat(),
              "browser": browser_name, "checks": [], "status": "not-run"}
    ctx = None
    try:
        with local_server() as url, tempfile.TemporaryDirectory() as profile, sync_playwright() as p:
            browser = getattr(p, browser_name)
            ctx = browser.launch_persistent_context(profile, headless=True, service_workers="allow", accept_downloads=True)
            page = ctx.new_page()
            def check(name, fn):
                detail = fn()
                report["checks"].append({"name": name, "status": "pass", "detail": detail})
            def navigation():
                response = page.goto(url, wait_until="load", timeout=25000)
                assert response and response.ok, "Page failed to load"
                return {"http": response.status, "title": page.title()}
            check("online_navigation", navigation)
            report["userAgent"] = page.evaluate("navigator.userAgent")
            def controlled():
                page.reload(wait_until="load")
                page.wait_for_function("() => !!navigator.serviceWorker?.controller", timeout=15000)
                return page.evaluate("navigator.serviceWorker.controller.scriptURL")
            check("service_worker_control", controlled)
            def save():
                page.locator("#note").fill("wonder-phase2-offline-proof")
                page.locator("#save").click()
                page.get_by_text("Saved on this device.", exact=False).wait_for(timeout=12000)
                return "saved locally"
            check("indexeddb_write", save)
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
                ctx=browser.launch_persistent_context(profile, headless=True, offline=True, service_workers="allow")
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
    parser.add_argument("--output", default="results/phase2-browser-acceptance.json")
    args=parser.parse_args()
    report=run(args.browser)
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"status":report["status"],"checks":report["checks"],"error":report.get("error")},indent=2))
    raise SystemExit(0 if report["status"]=="pass" else 2 if report["status"]=="blocked" else 1)
