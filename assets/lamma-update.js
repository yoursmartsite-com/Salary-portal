(() => {
  const BASE = './';
  const VERSION_KEY = 'lamma_seen_app_version';
  let updateRegistration = null;
  let reloading = false;

  const style = document.createElement('style');
  style.textContent = `
    #lammaUpdateNotice{position:fixed;z-index:10050;inset:0;background:#020611c9;backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:18px;font-family:Cairo,Arial,sans-serif}
    #lammaUpdateNotice.open{display:flex}
    #lammaUpdateNotice .lu-card{width:min(100%,410px);padding:23px;border:1px solid #3a4c72;border-radius:20px;background:linear-gradient(145deg,#14213d,#080f20);box-shadow:0 24px 80px #000b;text-align:center;color:#f5f7ff}
    #lammaUpdateNotice .lu-icon{width:62px;height:62px;margin:0 auto 12px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#5530dd,#16a88e);font-size:29px}
    #lammaUpdateNotice h2{font-size:21px;margin:5px 0 8px}
    #lammaUpdateNotice p{color:#b8c5df;line-height:1.9;margin:0 0 17px;font-size:13px}
    #lammaUpdateNotice .lu-actions{display:flex;gap:9px}
    #lammaUpdateNotice button{flex:1;padding:12px 10px;border:0;border-radius:11px;font:800 13px Cairo,Arial,sans-serif;cursor:pointer}
    #lammaUpdateNow{background:linear-gradient(100deg,#5426e8,#8139ff);color:white}
    #lammaUpdateLater{background:#1b2943;color:#d8e2f5}
    #lammaUpdateNotice .lu-version{font-size:10px;color:#8293b4;margin-top:12px}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'lammaUpdateNotice';
  overlay.innerHTML = '<div class="lu-card" role="dialog" aria-modal="true" aria-labelledby="luTitle"><div class="lu-icon">↻</div><h2 id="luTitle">في تحديث جديد للَمّة</h2><p id="luMessage">حدّث اللعبة عشان توصلك آخر التحسينات والإصلاحات.</p><div class="lu-actions"><button id="lammaUpdateNow" type="button">تحديث الآن</button><button id="lammaUpdateLater" type="button">لاحقًا</button></div><div class="lu-version" id="luVersion"></div></div>';
  document.body.appendChild(overlay);

  function showNotice(info, waitingWorker) {
    const force = info.force === true;
    document.getElementById('luMessage').textContent = info.message || 'في تحديث جديد للَمّة. حدّث عشان توصلك آخر التحسينات والإصلاحات.';
    document.getElementById('luVersion').textContent = info.version ? 'الإصدار ' + info.version : '';
    const later = document.getElementById('lammaUpdateLater');
    later.style.display = force ? 'none' : '';
    overlay.classList.add('open');
    document.getElementById('lammaUpdateNow').onclick = () => {
      const btn = document.getElementById('lammaUpdateNow');
      btn.disabled = true;
      btn.textContent = 'جاري تجهيز التحديث...';
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        if (updateRegistration) updateRegistration.update().catch(() => {});
        setTimeout(() => {
          if (!reloading) location.replace(location.pathname + '?lamma_update=' + encodeURIComponent(info.version || Date.now()));
        }, 1800);
      } else {
        location.replace(location.pathname + '?lamma_update=' + encodeURIComponent(info.version || Date.now()));
      }
    };
    later.onclick = () => {
      localStorage.setItem(VERSION_KEY, info.version || 'later');
      overlay.classList.remove('open');
    };
  }

  async function checkVersion() {
    try {
      const response = await fetch(BASE + 'update.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const info = await response.json();
      if (!info || !info.version) return;
      const seen = localStorage.getItem(VERSION_KEY);
      if (seen !== info.version) showNotice(info, updateRegistration && updateRegistration.waiting);
    } catch (error) {
      console.warn('Lamma update check unavailable:', error);
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        updateRegistration = await navigator.serviceWorker.register(BASE + 'service-worker.js', { updateViaCache: 'none' });
        updateRegistration.update().catch(() => {});
        if (updateRegistration.waiting) {
          const response = await fetch(BASE + 'update.json?t=' + Date.now(), { cache: 'no-store' });
          const info = response.ok ? await response.json() : { version: 'جديد' };
          showNotice(info, updateRegistration.waiting);
        }
        updateRegistration.addEventListener('updatefound', () => {
          const worker = updateRegistration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', async () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              let info = { version: 'جديد', message: 'في تحديث جديد جاهز. اضغط تحديث الآن لتطبيقه.' };
              try {
                const response = await fetch(BASE + 'update.json?t=' + Date.now(), { cache: 'no-store' });
                if (response.ok) info = await response.json();
              } catch (_) {}
              showNotice(info, updateRegistration.waiting || worker);
            }
          });
        });
      } catch (error) {
        console.warn('Lamma service worker registration failed:', error);
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  checkVersion();
  window.addEventListener('focus', checkVersion);
})();