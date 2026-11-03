// @central-id nexus-compra-ticket-loader-matriz
// @central-name NEXUS Compra & Ticket Loader - MATRIZ
// @central-version 1.0.0
// @central-match https://sistema.romancemoda.com.br/apex/*
// @central-enabled true

// Módulo compatível com a Central GitHub V1.8. Não instale isoladamente.
// O release e o manifest.json do NEXUS continuam sendo lidos do repositório original.
// API.storage isola os caches deste módulo dos caches de outros módulos da Central.
// Mantenha apenas a versão da Central OU o userscript original ativo, nunca ambos.
((GM_getValue, GM_setValue, GM_deleteValue) => {
(() => {
    'use strict';
    const CONFIG = {
        repo: 'jhonesfeliciano/nexus-compra-ticket', branch: 'main',
        firebaseBase: 'https://acompanhamentos-reta-final-default-rtdb.firebaseio.com',
        integrationPath: 'Ciclo-semanas-integracao',
        mainDataPath: 'Ciclo-semanas-setores',
        timeoutMs: 30000, waitTargetMs: 120000, minCodeBytes: 4000,
        chooserId: 'nexus-compra-ticket-matriz-chooser',
        styleId: 'nexus-compra-ticket-matriz-style',
        lastChannelKey: 'nexusCompraTicketMatrizLastChannel',
        channels: {
            teresina: { label:'TERESINA', cacheKey:'nexusCompraTicketMatrizCache_teresina' },
            palmas: { label:'PALMAS', cacheKey:'nexusCompraTicketMatrizCache_palmas' }
        }
    };
    let channelLoaded = '';


    function normalizeHeader(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ').trim().toUpperCase();
    }

    function headerTokens(cell) {
        return String(cell?.getAttribute('headers') || '')
            .split(/\s+/).map(normalizeHeader).filter(Boolean);
    }

    function cellByHeader(row, aliases) {
        const wanted = aliases.map(normalizeHeader);
        return [...row.querySelectorAll('td')].find(td => {
            const tokens = headerTokens(td);
            return tokens.some(token => wanted.includes(token));
        }) || null;
    }

    function findReportTable() {
        const aliases = {
            week: ['SEMANA'],
            region: ['REGIAO', 'REGIÃO'],
            total: ['TOTALGERAL'],
            ticket: ['C5407196655334160411']
        };
        const tables = [...document.querySelectorAll('table')];
        const exact = tables.find(table => {
            const rows = [...table.querySelectorAll('tbody tr')];
            return rows.some(tr =>
                cellByHeader(tr, aliases.week) &&
                cellByHeader(tr, aliases.region) &&
                cellByHeader(tr, aliases.total) &&
                cellByHeader(tr, aliases.ticket)
            );
        });
        if (exact) return exact;
        return tables.find(table => {
            const headers = [...table.querySelectorAll('thead th')]
                .map(th => normalizeHeader(th.innerText || th.textContent));
            return headers.some(h => h === 'SEMANA') &&
                headers.some(h => h === 'REGIAO') &&
                headers.some(h => h === 'TOTAL') &&
                headers.some(h => h.includes('TICKET MEDIO'));
        }) || null;
    }

    function isTargetReportPage() {
        return Boolean(findReportTable());
    }


    registerMenus();
    waitForTargetPage(CONFIG.waitTargetMs).then(found => {
        if (!found) { console.info('[NEXUS Compra & Ticket/MATRIZ] Grade de Cobranças não detectada; loader inativo.'); return; }
        return bootstrap();
    }).catch(error => { console.error(error); if (isTargetReportPage()) showChooser(error.message || String(error), 'error'); });

    function waitForTargetPage(timeoutMs) {
        if (isTargetReportPage()) return Promise.resolve(true);
        return new Promise(resolve => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (isTargetReportPage()) { clearInterval(timer); resolve(true); }
                else if (Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(false); }
            }, 700);
        });
    }

    async function bootstrap() {
        const detection = await detectPendingRequestChannel();
        if (detection.channel) return loadChannel(detection.channel, 'solicitação Compra/Ticket pendente');
        const msg = detection.ambiguous
            ? `A solicitação para “${detection.request?.profile || 'distribuidor'}” pode pertencer a mais de um perfil. Escolha TERESINA ou PALMAS.`
            : 'Nenhuma solicitação Compra/Ticket pendente foi identificada. Escolha qual perfil a Matriz deve operar.';
        showChooser(msg, detection.ambiguous ? 'warning' : 'info');
    }

    async function detectPendingRequestChannel() {
        const [requestsRaw, terRaw, palRaw] = await Promise.all([
            firebaseGet(`${CONFIG.integrationPath}/requests`),
            firebaseGet(`${CONFIG.mainDataPath}/teresina/profiles`),
            firebaseGet(`${CONFIG.mainDataPath}/palmas/profiles`)
        ]);
        const names = { teresina: extractProfileNames(terRaw), palmas: extractProfileNames(palRaw) };
        const requests = flattenRequests(requestsRaw)
            .filter(r => r?.status === 'pending' && r?.type === 'purchaseMetrics' && r?.profile)
            .sort((a,b) => Number(b.requestedAt || 0) - Number(a.requestedAt || 0));
        if (!requests.length) return { channel:'', request:null, ambiguous:false };
        for (const request of requests) {
            const explicit = normalizeChannel(request.ecosystemKey || request.workspaceKey || request.dataKey || '');
            if (explicit) return { channel:explicit, request, ambiguous:false };
            const target = normalizeName(request.profile);
            const matches = Object.entries(names).filter(([, arr]) => arr.some(n => normalizeName(n) === target)).map(([k]) => k);
            if (matches.length === 1) return { channel:matches[0], request, ambiguous:false };
            if (matches.length > 1) return { channel:'', request, ambiguous:true };
        }
        return { channel:'', request:requests[0], ambiguous:false };
    }

    function extractProfileNames(raw) {
        const vals = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
        return [...new Set(vals.map(item => typeof item === 'string' || typeof item === 'number' ? String(item).trim() : String(item?.name || item?.nome || item?.profile || item?.value || '').trim()).filter(Boolean))];
    }
    function flattenRequests(raw) {
        if (!raw || typeof raw !== 'object') return [];
        const out=[]; const walk=(node,key='')=>{
            if (!node || typeof node !== 'object') return;
            if ('requestId' in node || 'profile' in node || 'status' in node) { out.push({key,...node}); return; }
            Object.entries(node).forEach(([k,v]) => walk(v, key ? `${key}/${k}` : k));
        }; walk(raw); return out;
    }
    function normalizeName(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
    function normalizeChannel(v) {
        const n = normalizeName(v).replace(/\s+/g,'');
        if (n.includes('teresina')) return 'teresina';
        if (n.includes('palmas')) return 'palmas';
        return '';
    }

    async function loadChannel(channel, reason) {
        channel = normalizeChannel(channel);
        if (!channel || !CONFIG.channels[channel] || channelLoaded) return;
        removeChooser(); channelLoaded = channel; GM_setValue(CONFIG.lastChannelKey, channel);
        const cfg = CONFIG.channels[channel]; const cache = GM_getValue(cfg.cacheKey, null);
        try {
            const base = `https://raw.githubusercontent.com/${CONFIG.repo}/${CONFIG.branch}`;
            const manifest = await requestJson(`${base}/manifest.json?ts=${Date.now()}`);
            const release = manifest?.channels?.[channel];
            if (!release?.version || !release?.path) throw new Error(`Canal ${channel} ausente no manifest.json.`);
            const code = await requestText(`${base}/${String(release.path).replace(/^\/+/, '')}?ts=${Date.now()}`);
            validateCode(code);
            if (release.sha256) { const actual = await sha256(code); if (actual && actual !== String(release.sha256).toLowerCase()) throw new Error('SHA-256 diferente do manifest.json.'); }
            executeCode(code, `nexus-compra-ticket-${channel}-${release.version}-matriz.js`);
            GM_setValue(cfg.cacheKey, {version:release.version,path:release.path,sha256:release.sha256||'',code,savedAt:Date.now()});
            console.info(`[NEXUS Compra & Ticket/MATRIZ] ${cfg.label} ${release.version} carregado (${reason}).`);
        } catch (err) {
            console.warn(`[NEXUS Compra & Ticket/MATRIZ] Falha remota em ${cfg.label}; tentando cache.`, err);
            if (cache?.code) { try { validateCode(cache.code); executeCode(cache.code, `nexus-compra-ticket-${channel}-cache-matriz.js`); return; } catch(e){console.error(e);} }
            channelLoaded=''; showChooser(`Falha ao carregar ${cfg.label}: ${err.message || err}`, 'error');
        }
    }

    function showChooser(message, kind='info') {
        if (!isTargetReportPage()) return;
        removeChooser(); ensureStyle();
        const last = normalizeChannel(GM_getValue(CONFIG.lastChannelKey,''));
        const box=document.createElement('section'); box.id=CONFIG.chooserId;
        box.innerHTML=`<div class="nctm-head"><div><strong>NEXUS MATRIZ</strong><small>Compra & Ticket • GitHub</small></div><button class="nctm-min">−</button></div>
        <div class="nctm-body"><div class="nctm-status" data-kind="${kind}">${escapeHtml(message)}</div><label>Perfil que será operado</label>
        <select id="nctm-channel"><option value="">Selecione...</option><option value="teresina" ${last==='teresina'?'selected':''}>TERESINA</option><option value="palmas" ${last==='palmas'?'selected':''}>PALMAS</option></select>
        <button id="nctm-load">Carregar perfil selecionado</button><p>Apenas um canal é carregado por vez. Solicitações Compra/Ticket com ecossistema identificado são abertas automaticamente.</p></div>`;
        document.body.appendChild(box);
        box.querySelector('.nctm-min').onclick=()=>box.classList.toggle('collapsed');
        box.querySelector('#nctm-load').onclick=()=>{ const ch=box.querySelector('#nctm-channel').value; if(!ch)return; loadChannel(ch,'seleção manual da Matriz'); };
    }
    function removeChooser() { document.getElementById(CONFIG.chooserId)?.remove(); }
    function ensureStyle() {
        if(document.getElementById(CONFIG.styleId))return; const s=document.createElement('style');s.id=CONFIG.styleId;s.textContent=`
        #${CONFIG.chooserId}{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(390px,calc(100vw - 28px));background:#fff;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 18px 50px rgba(15,23,42,.28);overflow:hidden;color:#0f172a;font:13px Arial,sans-serif}
        #${CONFIG.chooserId} *{box-sizing:border-box} #${CONFIG.chooserId} .nctm-head{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;background:#0f172a;color:#fff}
        #${CONFIG.chooserId} small{display:block;font-size:10px;opacity:.8;margin-top:2px} #${CONFIG.chooserId} .nctm-min{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:8px;width:30px;height:30px;cursor:pointer}
        #${CONFIG.chooserId} .nctm-body{padding:14px} #${CONFIG.chooserId}.collapsed .nctm-body{display:none} #${CONFIG.chooserId} label{display:block;font-weight:800;margin:10px 0 5px}
        #${CONFIG.chooserId} select{width:100%;height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;background:#fff} #${CONFIG.chooserId} #nctm-load{width:100%;height:44px;border:0;border-radius:10px;margin-top:10px;background:#7c3aed;color:#fff;font-weight:800;cursor:pointer}
        #${CONFIG.chooserId} .nctm-status{padding:9px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;line-height:1.4} #${CONFIG.chooserId} .nctm-status[data-kind=warning]{background:#fffbeb;color:#92400e} #${CONFIG.chooserId} .nctm-status[data-kind=error]{background:#fff1f2;color:#be123c} #${CONFIG.chooserId} p{font-size:11px;color:#64748b;line-height:1.4;margin:9px 0 0}`;
        document.head.appendChild(s);
    }
    function escapeHtml(v) { return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

    function firebaseGet(path) { return requestJson(`https://${new URL(CONFIG.firebaseBase).host}/${String(path).replace(/^\/+/, '')}.json?ts=${Date.now()}`); }
    function requestText(url) { return new Promise((resolve,reject)=>GM_xmlhttpRequest({method:'GET',url,timeout:CONFIG.timeoutMs,headers:{'Cache-Control':'no-cache'},onload:r=>r.status>=200&&r.status<300?resolve(String(r.responseText||'')):reject(new Error(`HTTP ${r.status}`)),onerror:()=>reject(new Error('Falha de rede.')),ontimeout:()=>reject(new Error('Tempo esgotado.'))})); }
    async function requestJson(url) { const t=await requestText(url); try{return JSON.parse(t)}catch{throw new Error('JSON inválido.')} }
    function validateCode(code) { if(typeof code!=='string'||code.length<CONFIG.minCodeBytes)throw new Error('Código remoto vazio ou muito pequeno.'); new Function('GM_getValue','GM_setValue','GM_deleteValue','GM_xmlhttpRequest','GM_registerMenuCommand','GM_addStyle',code); }
    function executeCode(code,name) { new Function('GM_getValue','GM_setValue','GM_deleteValue','GM_xmlhttpRequest','GM_registerMenuCommand','GM_addStyle',`${code}\n//# sourceURL=${name}`)(GM_getValue,GM_setValue,GM_deleteValue,GM_xmlhttpRequest,GM_registerMenuCommand,GM_addStyle); }
    async function sha256(text) { try{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch{return''} }
    function registerMenus() { if(typeof GM_registerMenuCommand!=='function')return; GM_registerMenuCommand('Matriz Compra & Ticket - escolher TERESINA/PALMAS',()=>{if(!isTargetReportPage())return window.alert('Abra primeiro a página da grade de Cobranças.');showChooser('Escolha manualmente o perfil que a Matriz deve operar.','info')}); Object.entries(CONFIG.channels).forEach(([ch,cfg])=>GM_registerMenuCommand(`Limpar cache Matriz Compra & Ticket - ${cfg.label}`,()=>GM_deleteValue(cfg.cacheKey))); }
})();
})(
  (key, fallback = null) => API.storage.get(key, fallback),
  (key, value) => API.storage.set(key, value),
  key => API.storage.delete(key)
);
