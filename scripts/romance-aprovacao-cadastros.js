// @central-id romance-aprovacao-cadastros
// @central-name Romance | Aprovação de Cadastros em Lote
// @central-version 1.0.0
// @central-match https://sistema.romancemoda.com.br/*
// @central-enabled true

// Módulo para a Central GitHub. Não instalar individualmente no Tampermonkey.
// A aprovação só começa após clicar no botão Iniciar na página 292.

(() => {
  'use strict';

  // Este script SÓ realiza ações nas páginas 292 e 293 do aplicativo 2001.
  // Não usa Firebase, não modifica outros scripts e não executa sem clicar em Iniciar.
  const KEY = 'romance_aprovacao_cadastros_v1_estado';
  const REGION = '#R269434569061998839';
  const REPORT = `${REGION} .a-IRR-reportView`;
  const CHECK_ALL = '#P293_MARCAR_TODOS';
  const APPROVE = '#B269441447448000911';
  const LIMIT = 500;                  // proteção contra ciclos infinitos
  const DETAILS_TIMEOUT = 12000;
  const MARK_TIMEOUT = 10000;
  const CONFIRM_TIMEOUT = 12000;
  const RETURN_TIMEOUT = 30000;
  const WAIT_LIST_MS = 1800;
  const WAIT_DETAIL_MS = 900;
  const LOG_PREFIX = '[Romance Cadastros V1]';

  const appId = document.querySelector('#pFlowId')?.value;
  const pageId = Number(document.querySelector('#pFlowStepId')?.value || 0);
  if (appId !== '2001' || ![292, 293].includes(pageId)) return;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safeText = v => (v == null ? '' : String(v));
  const clean = t => safeText(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function defaultState() {
    return { active: false, phase: 'idle', total: 0, pendingId: null,
      started: 0, lastAction: 0, error: '', seenAt: 0 };
  }
  function load() {
    try { return { ...defaultState(), ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; }
    catch { return defaultState(); }
  }
  function save(patch) {
    const next = { ...load(), ...patch, lastAction: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(next));
    render();
    return next;
  }
  function log(...msg) { console.info(LOG_PREFIX, ...msg); }

  function stop(message, isError = false) {
    const s = save({ active: false, phase: isError ? 'error' : 'paused', error: message });
    log(isError ? 'ERRO:' : 'PARADO:', message, s);
    if (isError) showMessage('Automação interrompida', message, false);
  }
  function mustBeActive() { return load().active; }
  function fail(message) { if (mustBeActive()) stop(message, true); }

  function render() {
    const panel = $('#rac-panel');
    if (!panel) return;
    const s = load();
    const status = $('#rac-status');
    const count = $('#rac-count');
    const start = $('#rac-start');
    const pause = $('#rac-pause');
    count.textContent = String(s.total);
    const statuses = {
      idle: 'Pronto para iniciar', list: 'Procurando a primeira lupa...',
      detail: 'Abrindo solicitação...', marking: 'Marcando todos os campos...',
      confirming: 'Confirmando aprovação...', returning: 'Aguardando retorno à lista...',
      paused: 'Processo parado', error: 'Interrompido por segurança',
      done: 'Todas as solicitações finalizadas'
    };
    status.textContent = s.error || statuses[s.phase] || 'Aguardando...';
    status.style.color = s.phase === 'error' ? '#ffb6b6' : '#dbeafe';
    start.style.display = pageId === 292 && !s.active ? '' : 'none';
    start.textContent = s.phase === 'paused' || s.phase === 'error' ? '▶ Reiniciar' : '▶ Iniciar';
    pause.style.display = s.active ? '' : 'none';
  }

  function createPanel() {
    if ($('#rac-panel')) return;
    const style = document.createElement('style');
    style.id = 'rac-style';
    style.textContent = `
      #rac-panel{position:fixed;right:18px;top:94px;z-index:2147483000;width:285px;
        box-sizing:border-box;background:#17244a;color:#fff;font:14px/1.35 'Segoe UI',Arial,sans-serif;
        padding:15px 16px;border-radius:13px;box-shadow:0 12px 36px #12213d66;border:1px solid #3c5082}
      #rac-panel *{box-sizing:border-box}#rac-panel .rac-title{font-weight:800;font-size:15px}
      #rac-panel .rac-sub{color:#cbd5e1;font-size:11px;margin:3px 0 10px}
      #rac-panel .rac-status{font-size:12px;margin:9px 0;min-height:31px;overflow-wrap:anywhere}
      #rac-panel .rac-line{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #rac-panel .rac-count{font-weight:bold;color:#a7f3d0;font-size:25px;line-height:1.2}
      #rac-panel .rac-label{font-size:11px;color:#cbd5e1}
      #rac-panel .rac-actions{display:flex;gap:9px;margin-top:13px}
      #rac-panel button{border:0!important;color:white!important;font:700 12px 'Segoe UI',Arial,sans-serif!important;
        padding:10px 12px!important;border-radius:8px!important;cursor:pointer!important;flex:1;box-shadow:none!important}
      #rac-start{background:#148a57!important}#rac-pause{background:#c24136!important}
      #rac-message{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;
        justify-content:center;padding:18px;background:#10182780;font-family:'Segoe UI',Arial,sans-serif}
      #rac-message .rac-card{width:min(480px,96vw);background:#fff;color:#13213a;border-radius:17px;
        box-shadow:0 20px 60px #121d394d;padding:35px 30px;text-align:center}
      #rac-message h2{font-size:27px;font-weight:800;margin:0 0 12px}
      #rac-message p{font-size:15px;line-height:1.55;margin:0 0 16px}
      #rac-message button{background:#17244a;border:0;color:#fff;padding:11px 20px;
        border-radius:9px;font-weight:700;cursor:pointer}
    `;
    document.head.appendChild(style);
    const panel = document.createElement('div');
    panel.id = 'rac-panel';
    panel.innerHTML = `
      <div class="rac-title">✓ Aprovação de Cadastros</div>
      <div class="rac-sub">Automação • páginas 292 e 293</div>
      <div class="rac-line"><div class="rac-label">Aprovações confirmadas</div>
        <span class="rac-count" id="rac-count">0</span></div>
      <div class="rac-status" id="rac-status">Pronto para iniciar</div>
      <div class="rac-actions"><button type="button" id="rac-start">▶ Iniciar</button>
        <button type="button" id="rac-pause">■ Parar</button></div>
    `;
    document.body.appendChild(panel);
    $('#rac-start').addEventListener('click', () => {
      if (load().active) return;
      const old = load();
      // Se já havia aprovação em andamento, é importante conferir o resultado na lista.
      // Iniciar a partir da página 292 começa uma nova execução, mantendo apenas o contador
      // quando a execução anterior foi interrompida durante a confirmação.
      const verify = !!old.pendingId && ['returning', 'confirming', 'paused', 'error'].includes(old.phase);
      save({ active: true, phase: 'list', error: '',
        total: verify ? old.total : 0,
        pendingId: verify ? old.pendingId : null,
        started: Date.now() });
      runList();
    });
    $('#rac-pause').addEventListener('click', () => stop('Interrompido manualmente.'));
    render();
  }

  function showMessage(title, body, finished) {
    $('#rac-message')?.remove();
    const box = document.createElement('div');
    box.id = 'rac-message';
    const card = document.createElement('div');
    card.className = 'rac-card';
    const h2 = document.createElement('h2'); h2.textContent = title;
    const p = document.createElement('p'); p.textContent = body;
    const button = document.createElement('button');
    button.textContent = 'Fechar';
    button.addEventListener('click', () => box.remove());
    card.append(h2, p, button);
    box.appendChild(card);
    document.body.appendChild(box);
  }

  function complete() {
    if (!mustBeActive()) return;
    const total = load().total;
    save({ active: false, phase: 'done', pendingId: null, error: '' });
    log('Fim de atualizações.', total, 'aprovações verificadas.');
    showMessage('Fim de atualizações', `${total} aprovação(ões) confirmada(s) nesta execução. Não há outras lupas pendentes na lista exibida.`, true);
  }

  function listLinks() {
    // Seletores EXTRAÍDOS do HTML da página 292: apenas células da coluna Analisar.
    const links = $$(`${REPORT} .a-IRR-table td[headers~="C269435041330998844"] a[href]`);
    return links.map(link => {
      const row = link.closest('tr');
      const statusCell = $('td[headers~="C269437078658998845"]', row);
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/P293_IDPREATUALIZACAO,P293_IDPESSOA:([^,&]+)/i);
      const validPage = /(?:^|[?&])p=2001:293:/i.test(href);
      const isMagnifier = !!$('img[src*="magnifying_glass"]', link);
      return { link, row, href, id: idMatch?.[1] || null,
        pending: statusCell ? clean(statusCell.textContent) === 'pendente' : false,
        valid: isMagnifier && validPage && !!idMatch };
    }).filter(entry => entry.valid && entry.pending);
  }

  function busy() {
    return !!$('.u-Processing.is-active, .a-IRR-loading, .u-Processing[aria-hidden="false"], #apex_wait_overlay');
  }
  function reportReady() {
    const region = $(REPORT);
    return !!(region && ($('.a-IRR-table', region) || /nenhum dado|no data|dados nao encontrados|nenhum registro/i.test(clean(region.textContent))));
  }
  async function waitUntil(predicate, timeout, tick = 140) {
    const began = Date.now();
    while (Date.now() - began < timeout) {
      if (!mustBeActive()) return false;
      if (predicate()) return true;
      await sleep(tick);
    }
    return false;
  }

  let listWorking = false;
  async function runList() {
    if (listWorking || pageId !== 292 || !mustBeActive()) return;
    listWorking = true;
    try {
      if (!await waitUntil(() => reportReady() && !busy(), DETAILS_TIMEOUT)) {
        fail('A tabela de solicitações não foi carregada. Verifique os filtros ou a conexão.');
        return;
      }
      await sleep(WAIT_LIST_MS);
      if (!mustBeActive()) return;

      let links = listLinks();
      const pendingId = load().pendingId;
      if (pendingId) {
        // Considera aprovada SOMENTE quando o cadastro deixou de constar como pendente.
        if (links.some(e => e.id === pendingId)) {
          stop('A solicitação anterior ainda consta como Pendente. Confira se a aprovação foi salva antes de reiniciar.', true);
          return;
        }
        save({ total: load().total + 1, pendingId: null, phase: 'list', error: '' });
        log('Aprovação verificada:', pendingId);
      }
      if (!mustBeActive()) return;
      if (load().total >= LIMIT) {
        stop(`Limite de segurança de ${LIMIT} aprovações atingido.`, true);
        return;
      }
      links = listLinks();
      if (!links.length) { complete(); return; }
      // Sempre escolhe a PRIMEIRA lupa de cima para baixo.
      const first = links[0];
      save({ phase: 'detail', pendingId: first.id, error: '' });
      log('Abrindo primeira lupa; solicitação', first.id);
      first.link.click();
      await sleep(DETAILS_TIMEOUT);
      if (mustBeActive() && pageId === 292) {
        fail('A lupa foi acionada, mas a página 293 não abriu.');
      }
    } catch (err) { fail(`Erro ao procurar solicitação: ${err.message}`); }
    finally { listWorking = false; }
  }

  let detailWorking = false;
  async function runDetail() {
    if (detailWorking || pageId !== 293 || !mustBeActive()) return;
    detailWorking = true;
    try {
      const state = load();
      if (!['detail', 'marking'].includes(state.phase)) {
        stop('A página de comparação foi aberta fora da etapa esperada. Nenhuma nova aprovação foi enviada.', true);
        return;
      }
      const loaded = await waitUntil(() => $(CHECK_ALL) && $(APPROVE) && $('#P293_IDPREATUALIZACAO'), DETAILS_TIMEOUT);
      if (!loaded) { fail('Não encontrei Marcar Todos ou Aprovar atualização na página 293.'); return; }
      const actualId = $('#P293_IDPREATUALIZACAO').value;
      if (!state.pendingId || actualId !== state.pendingId) {
        fail('O cadastro aberto não corresponde à lupa selecionada. Aprovação cancelada por segurança.');
        return;
      }
      await sleep(WAIT_DETAIL_MS);
      if (!mustBeActive()) return;
      save({ phase: 'marking' });
      const master = $(CHECK_ALL);
      if (!master.checked) {
        master.click(); // Evento nativo: aciona a Dynamic Action Oracle APEX.
      }
      const all = () => $$('input[type="checkbox"][id^="P293_"][id$="_A"]');
      const marked = await waitUntil(() => {
        const subitems = all();
        return !!master.checked && subitems.length > 0 && subitems.every(c => c.checked);
      }, MARK_TIMEOUT);
      if (!marked) {
        fail('O sistema não marcou todos os campos após Marcar Todos. Não foi enviada aprovação.');
        return;
      }
      if (!mustBeActive()) return;
      save({ phase: 'confirming' });
      const button = $(APPROVE);
      if (button.disabled) { fail('O botão de aprovação está desabilitado.'); return; }
      log('Todos os campos marcados. Solicitando aprovação de', actualId);
      button.click(); // A própria aplicação abre a confirmação oficial.
      const clicked = await confirmAPEX();
      if (!clicked) { fail('Não foi possível confirmar a caixa de diálogo de aprovação do sistema.'); return; }
      save({ phase: 'returning' });
      log('Confirmação enviada. Aguardando redirecionamento ao relatório.');
      // A página 293 usa apex.confirm(..., 'APROVAR'), que submete ao servidor.
      // Normalmente a aplicação redireciona para a página 292 após salvar.
      // NÃO clique em Voltar antes de ter evidência da conclusão do servidor.
      await sleep(RETURN_TIMEOUT);
      if (mustBeActive()) fail('O sistema não retornou à lista após a aprovação. Confira o resultado antes de reiniciar.');
    } catch (err) { fail(`Erro na etapa de aprovação: ${err.message}`); }
    finally { detailWorking = false; }
  }

  function isVisible(el) {
    return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function findApexConfirmation() {
    const dialogs = $$('.ui-dialog, [role="dialog"], dialog[open]');
    const dialog = dialogs.find(d => isVisible(d) &&
      /deseja realmente aprovar este cadastro/i.test(clean(d.textContent)));
    if (!dialog) return null;
    // Botões positivos no diálogo específico desta aprovação (não de outras telas).
    const candidates = $$('button, input[type="button"], input[type="submit"]', dialog)
      .filter(isVisible)
      .filter(b => !b.disabled);
    return candidates.find(b => /^(ok|sim|confirmar|aprovar|yes)$/i.test(clean(b.textContent || b.value))) || null;
  }
  async function confirmAPEX() {
    const start = Date.now();
    while (Date.now() - start < CONFIRM_TIMEOUT) {
      if (!mustBeActive()) return false;
      const button = findApexConfirmation();
      if (button) { button.click(); return true; }
      await sleep(160);
    }
    return false;
  }

  createPanel();
  const state = load();
  if (!state.active) return;
  // Nunca reaproveitar execução antiga após muito tempo/sessão possivelmente vencida.
  if (state.started && Date.now() - state.started > 45 * 60 * 1000) {
    stop('A execução ficou aberta por mais de 45 minutos. Inicie novamente para evitar problemas com a sessão.', true);
    return;
  }
  if (pageId === 292) {
    // Retorno da aprovação, ou navegação normal para a lista.
    if (['detail', 'marking'].includes(state.phase)) {
      stop('Retorno à lista sem confirmação da aprovação. Confira o cadastro antes de reiniciar.', true);
    } else {
      save({ phase: 'list' });
      runList();
    }
  } else if (pageId === 293) {
    runDetail();
  }
})();
