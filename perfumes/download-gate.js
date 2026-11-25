(()=>{try{
  const key="zr_android_download_unlocked_v1";
  const ua=navigator.userAgent||"";
  const nativeApp=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==="function"&&window.Capacitor.isNativePlatform())||/;\s*wv\)|\bwv\b/i.test(ua)||window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  if(nativeApp||localStorage.getItem(key)==="1")return;
  const apk="https://github.com/yoursmartsite-com/Salary-portal/releases/download/android-latest/app-debug.apk";
  const style=document.createElement("style");
  style.textContent="#zr-download-gate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 50% 0,#30291f,#090909 72%);font-family:Cairo,Arial,sans-serif;color:#fff8ed;direction:rtl}#zr-download-gate *{box-sizing:border-box}#zr-download-gate .zr-card{width:min(100%,440px);padding:34px 24px;text-align:center;border:1px solid #c99a62;border-radius:26px;background:linear-gradient(145deg,#201d18,#101010);box-shadow:0 24px 80px #000b}#zr-download-gate .zr-mark{width:76px;height:76px;margin:0 auto 15px;border:1px solid #d6a65d;border-radius:22px;display:grid;place-items:center;color:#e6c487;font:700 42px Amiri,serif}#zr-download-gate .zr-brand{font-size:11px;letter-spacing:3px;color:#d6a65d;font-weight:800}#zr-download-gate h1{font:700 29px Amiri,serif;margin:9px 0 5px}#zr-download-gate p{font-size:13px;line-height:2;color:#d0c5b5;margin:12px 0 22px}#zr-download-gate .zr-download{display:block;width:100%;padding:15px 12px;border-radius:13px;background:linear-gradient(120deg,#bd8845,#f0ce8c);color:#21170d;text-decoration:none;font-weight:900;font-size:15px}#zr-download-gate .zr-note{font-size:10px;color:#a99c88;margin-top:16px}";
  document.head.appendChild(style);
  const gate=document.createElement("div");gate.id="zr-download-gate";
  gate.innerHTML='<main class="zr-card"><div class="zr-mark">ز</div><div class="zr-brand">ZEIN & RAHAF</div><h1>تطبيق زين ورهف للعطور</h1><p>قبل ما تدخل المتجر، حمّل تطبيق زين ورهف واستمتع بتجربة تسوق أسهل وأسرع من موبايلك.</p><a class="zr-download" id="zr-download-button" href="'+apk+'" target="_blank" rel="noopener">⬇ تحميل التطبيق الآن</a><div class="zr-note">ملف التثبيت متاح لأجهزة Android فقط · APK</div></main>';
  document.body.appendChild(gate);
  gate.querySelector("#zr-download-button").addEventListener("click",()=>{try{localStorage.setItem(key,"1")}catch(e){}gate.remove()},{once:true});
}catch(e){console.warn("Download gate unavailable",e)}})();