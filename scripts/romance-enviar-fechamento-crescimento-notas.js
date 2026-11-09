// @central-id romance-enviar-fechamento-crescimento-notas
// @central-name Romance | Enviar para Fechamento - Crescimento de Notas
// @central-version 1.0.0
// @central-match https://sistema.romancemoda.com.br/apex/*
// @central-enabled true

// Modulo da Central GitHub. Nao instalar individualmente no Tampermonkey.
// Mantem a confirmacao explicita antes de atualizar o Firebase.

(function () {
  'use strict';

  const PAGE_ID = '183';
  const REGION_ID = 'R2995421561866842';
  const ACTIONS_BUTTON_ID = `${REGION_ID}_actions_button`;
  const DISTRIBUTOR_SELECT_ID = 'P183_IDREPRESENTANTEFILTRO_N';
  const CUSTOM_BUTTON_ID = 'lm-enviar-fechamento-btn';
  const MODAL_ID = 'lm-fechamento-modal';
  const TOAST_ID = 'lm-fechamento-toast';
  const FIREBASE_BASE = 'https://acompanhamentos-reta-final-default-rtdb.firebaseio.com/crescimentoNotas/estadoPrincipal';

  if (!isTargetPage()) return;

  addStyles();
  installButton();
  watchApexRefreshes();

  function isTargetPage() {
    const pageItem = document.getElementById('pFlowStepId');
    if (pageItem && String(pageItem.value) === PAGE_ID) return true;
    return /(?:\?|:)p?=?2001(?::|%3A)183(?::|%3A)/i.test(location.href) || /p=2001:183:/i.test(location.href);
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\([^)]*inativ[^)]*\)/gi, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function parseBrazilianNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim().replace(/[^\d,.-]/g, '');
    if (!text) return 0;
    if (text.includes(',')) return Number(text.replace(/\./g, '').replace(',', '.')) || 0;
    return Number(text) || 0;
  }

  function formatCurrency(value) {
    return (Number(value) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function requestJson(method, url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        data: body === undefined ? undefined : JSON.stringify(body),
        timeout: 20000,
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`Firebase respondeu ${response.status}: ${response.responseText || 'erro desconhecido'}`));
            return;
          }
          if (!response.responseText) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(response.responseText));
          } catch (_) {
            resolve(response.responseText);
          }
        },
        onerror() {
          reject(new Error('Falha de conexão com o Firebase.'));
        },
        ontimeout() {
          reject(new Error('A conexão com o Firebase excedeu o tempo limite.'));
        }
      });
    });
  }

  function asDistributorEntries(distributors) {
    if (Array.isArray(distributors)) {
      return distributors
        .map((item, index) => ({ index, item }))
        .filter(entry => entry.item && typeof entry.item === 'object');
    }
    if (distributors && typeof distributors === 'object') {
      return Object.entries(distributors)
        .map(([key, item]) => ({ index: key, item }))
        .filter(entry => entry.item && typeof entry.item === 'object');
    }
    return [];
  }

  async function loadRemoteState() {
    const state = await requestJson('GET', `${FIREBASE_BASE}.json`);
    if (!state || !state.distribuidores) {
      throw new Error('O relatório ainda não possui distribuidores cadastrados no Firebase.');
    }
    const semanaInicial = Number.parseInt(state.semanaInicial, 10);
    const semanaFinal = Number.parseInt(state.semanaFinal, 10);
    if (!Number.isFinite(semanaInicial) || !Number.isFinite(semanaFinal) || semanaFinal < semanaInicial) {
      throw new Error('O intervalo de semanas do relatório está inválido.');
    }
    return {
      raw: state,
      semanaInicial,
      semanaFinal,
      entries: asDistributorEntries(state.distribuidores)
    };
  }

  function buildHeaderMap(table) {
    const map = new Map();
    table.querySelectorAll('th[id]').forEach(th => {
      const label = normalizeText(th.textContent);
      if (label) map.set(th.id, label);
    });
    return map;
  }

  function findCellByLabels(row, headerMap, labels) {
    const wanted = labels.map(normalizeText);
    for (const td of row.querySelectorAll(':scope > td')) {
      const headerIds = String(td.getAttribute('headers') || '').split(/\s+/).filter(Boolean);
      const names = headerIds.map(id => headerMap.get(id)).filter(Boolean);
      if (names.some(name => wanted.includes(name))) return td;
    }
    return null;
  }

  function extractWeekFromRow(row, table) {
    const links = [...row.querySelectorAll('a[href]')].map(a => a.getAttribute('href') || '');
    for (const rawHref of links) {
      let href = rawHref;
      try { href = decodeURIComponent(rawHref); } catch (_) {}
      const match = href.match(/[,=:](\d{1,2})\/(20\d{2})(?:[&,'")\s]|$)/i);
      if (match) return { numero: Number(match[1]), ano: Number(match[2]), texto: `${Number(match[1])}/${match[2]}` };
    }

    let current = row.previousElementSibling;
    while (current) {
      const text = String(current.textContent || '').replace(/\s+/g, ' ').trim();
      const match = text.match(/Semana\s*:?\s*(\d{1,2})\s*\/\s*(20\d{2})/i);
      if (match) return { numero: Number(match[1]), ano: Number(match[2]), texto: `${Number(match[1])}/${match[2]}` };
      current = current.previousElementSibling;
    }

    const tableText = String(table.textContent || '').replace(/\s+/g, ' ');
    const match = tableText.match(/Semana\s*:?\s*(\d{1,2})\s*\/\s*(20\d{2})/i);
    return match ? { numero: Number(match[1]), ano: Number(match[2]), texto: `${Number(match[1])}/${match[2]}` } : null;
  }

  function collectSystemData() {
    const select = document.getElementById(DISTRIBUTOR_SELECT_ID);
    if (!select) throw new Error('O filtro de Distribuidor não foi encontrado.');

    const systemId = String(select.value || '').trim();
    const selectedOption = select.options[select.selectedIndex];
    const selectedName = String(selectedOption?.textContent || '').trim();
    if (!systemId || systemId === '-1') {
      throw new Error('Selecione apenas um distribuidor antes de enviar.');
    }

    const tables = [...document.querySelectorAll(`#${REGION_ID} table.a-IRR-table, #${REGION_ID} table[id]`)]
      .filter((table, index, list) => list.indexOf(table) === index);

    for (const table of tables) {
      const headerMap = buildHeaderMap(table);
      for (const row of table.querySelectorAll('tr')) {
        if (!row.querySelector(':scope > td')) continue;
        const idCell = findCellByLabels(row, headerMap, ['ID Distribuidor', 'ID Representante']);
        if (!idCell || String(idCell.textContent || '').trim() !== systemId) continue;

        const nameCell = findCellByLabels(row, headerMap, ['Distribuidor']);
        const totalCell = findCellByLabels(row, headerMap, ['Total cobrança']);
        const notesCell = findCellByLabels(row, headerMap, ['Notas novas']);
        const week = extractWeekFromRow(row, table);

        if (!nameCell) throw new Error('A coluna Distribuidor não foi localizada na linha selecionada.');
        if (!totalCell) throw new Error('A coluna Total cobrança não foi localizada.');
        if (!notesCell) throw new Error('A coluna Notas novas não foi localizada.');
        if (!week) throw new Error('Não foi possível identificar a semana exibida no sistema.');

        const rowName = String(nameCell.textContent || '').replace(/\s+/g, ' ').trim();
        const totalCobranca = parseBrazilianNumber(totalCell.textContent);
        const notasNovas = Math.max(0, Math.trunc(parseBrazilianNumber(notesCell.textContent)));

        if (normalizeText(rowName) !== normalizeText(selectedName)) {
          throw new Error(`O nome filtrado (${selectedName}) não corresponde à linha encontrada (${rowName}). Atualize o filtro e tente novamente.`);
        }

        return {
          systemId,
          name: rowName,
          selectedName,
          totalCobranca,
          notasNovas,
          week
        };
      }
    }

    throw new Error(`Não encontrei no relatório a linha do distribuidor selecionado: ${selectedName}.`);
  }

  function chooseSuggestedDistributor(entries, systemData) {
    const byMappedId = entries.find(entry => String(entry.item.idSistemaRepresentante || '') === systemData.systemId);
    if (byMappedId) return byMappedId;

    const source = normalizeText(systemData.name);
    const exactMatches = entries.filter(entry => normalizeText(entry.item.nome) === source);
    return exactMatches.length === 1 ? exactMatches[0] : null;
  }

  function createDistributorToken(entry) {
    const id = String(entry.item.id || '').trim();
    return id ? `id:${id}` : `index:${entry.index}`;
  }

  function resolveDistributorByToken(entries, token) {
    if (String(token).startsWith('id:')) {
      const id = String(token).slice(3);
      return entries.find(entry => String(entry.item.id || '') === id) || null;
    }
    if (String(token).startsWith('index:')) {
      const index = String(token).slice(6);
      return entries.find(entry => String(entry.index) === index) || null;
    }
    return null;
  }

  function getWeekData(entry, weekNumber, semanaInicial) {
    const weekIndex = weekNumber - semanaInicial;
    const weeks = entry?.item?.semanas;
    const week = Array.isArray(weeks) ? weeks[weekIndex] : (weeks && typeof weeks === 'object' ? weeks[weekIndex] : null);
    return { weekIndex, week: week || {} };
  }

  async function beginSend() {
    const button = document.getElementById(CUSTOM_BUTTON_ID);
    setButtonBusy(button, true, 'Verificando...');
    try {
      const systemData = collectSystemData();
      const remote = await loadRemoteState();
      openConfirmationModal(systemData, remote);
    } catch (error) {
      showToast(error.message || String(error), 'error', 6500);
    } finally {
      setButtonBusy(button, false);
    }
  }

  function openConfirmationModal(systemData, remote) {
    closeModal();

    const suggested = chooseSuggestedDistributor(remote.entries, systemData);
    const detectedInRange = systemData.week.numero >= remote.semanaInicial && systemData.week.numero <= remote.semanaFinal;
    const targetOptions = [...remote.entries]
      .sort((a, b) => String(a.item.nome || '').localeCompare(String(b.item.nome || ''), 'pt-BR'))
      .map(entry => {
        const token = createDistributorToken(entry);
        const selected = suggested && token === createDistributorToken(suggested) ? ' selected' : '';
        return `<option value="${escapeHtml(token)}"${selected}>${escapeHtml(entry.item.nome || 'Sem nome')}</option>`;
      })
      .join('');

    const weekOptions = [];
    for (let week = remote.semanaInicial; week <= remote.semanaFinal; week += 1) {
      const selected = detectedInRange && week === systemData.week.numero ? ' selected' : '';
      weekOptions.push(`<option value="${week}"${selected}>Semana ${week}</option>`);
    }

    const suggestedData = suggested && detectedInRange
      ? getWeekData(suggested, systemData.week.numero, remote.semanaInicial).week
      : {};

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'lm-fechamento-overlay';
    overlay.innerHTML = `
      <div class="lm-fechamento-box" role="dialog" aria-modal="true" aria-labelledby="lm-fechamento-title">
        <div class="lm-fechamento-header">
          <div>
            <h2 id="lm-fechamento-title">Enviar para fechamento</h2>
            <p>Confira o distribuidor e a semana antes de atualizar.</p>
          </div>
          <button type="button" class="lm-close" aria-label="Fechar">×</button>
        </div>
        <div class="lm-fechamento-body">
          <div class="lm-source-card">
            <div><span>Distribuidor no sistema</span><strong>${escapeHtml(systemData.name)}</strong></div>
            <div><span>Semana detectada</span><strong>${escapeHtml(systemData.week.texto)}</strong></div>
          </div>

          <div class="lm-form-grid">
            <label class="lm-field lm-full">
              <span>Nome que será atualizado no relatório</span>
              <select id="lm-target-distributor">
                <option value="">Selecione o distribuidor correto</option>
                ${targetOptions}
              </select>
            </label>
            <label class="lm-field">
              <span>Semana que será atualizada</span>
              <select id="lm-target-week">${weekOptions.join('')}</select>
            </label>
            <div class="lm-field lm-status-field">
              <span>Intervalo configurado</span>
              <strong>Semanas ${remote.semanaInicial} a ${remote.semanaFinal}</strong>
            </div>
          </div>

          ${detectedInRange ? '' : `<div class="lm-warning">A semana ${escapeHtml(systemData.week.texto)} não está dentro do intervalo atual. Escolha manualmente a semana correta.</div>`}
          ${suggested ? '' : `<div class="lm-warning">O nome não teve correspondência exata. Selecione manualmente o distribuidor correto.</div>`}

          <div class="lm-values">
            <div class="lm-value-card">
              <span>Total cobrança → Realizado</span>
              <strong>${formatCurrency(systemData.totalCobranca)}</strong>
              <small id="lm-old-realizado">Atual no relatório: ${formatCurrency(suggestedData.realizado || 0)}</small>
            </div>
            <div class="lm-value-card">
              <span>Notas novas → Qtd Feito</span>
              <strong>${systemData.notasNovas}</strong>
              <small id="lm-old-feito">Atual no relatório: ${Number(suggestedData.feito) || 0}</small>
            </div>
          </div>

          <label class="lm-confirm-check">
            <input type="checkbox" id="lm-confirm-week">
            <span id="lm-confirm-week-text">Confirmo que a semana selecionada está correta.</span>
          </label>
        </div>
        <div class="lm-fechamento-footer">
          <button type="button" class="a-Button lm-cancel">Cancelar</button>
          <button type="button" class="a-Button a-Button--hot lm-submit" disabled>Confirmar e enviar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const closeButton = overlay.querySelector('.lm-close');
    const cancelButton = overlay.querySelector('.lm-cancel');
    const submitButton = overlay.querySelector('.lm-submit');
    const confirmCheck = overlay.querySelector('#lm-confirm-week');
    const targetSelect = overlay.querySelector('#lm-target-distributor');
    const weekSelect = overlay.querySelector('#lm-target-week');

    const updateOldValues = () => {
      const target = resolveDistributorByToken(remote.entries, targetSelect.value);
      const weekNumber = Number(weekSelect.value);
      const data = target ? getWeekData(target, weekNumber, remote.semanaInicial).week : {};
      overlay.querySelector('#lm-old-realizado').textContent = `Atual no relatório: ${formatCurrency(data.realizado || 0)}`;
      overlay.querySelector('#lm-old-feito').textContent = `Atual no relatório: ${Number(data.feito) || 0}`;
      overlay.querySelector('#lm-confirm-week-text').textContent = `Confirmo que a Semana ${weekNumber} está correta para ${target?.item?.nome || 'o distribuidor selecionado'}.`;
      confirmCheck.checked = false;
      updateSubmitState();
    };

    const updateSubmitState = () => {
      submitButton.disabled = !(targetSelect.value && weekSelect.value && confirmCheck.checked);
    };

    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
    targetSelect.addEventListener('change', updateOldValues);
    weekSelect.addEventListener('change', updateOldValues);
    confirmCheck.addEventListener('change', updateSubmitState);
    submitButton.addEventListener('click', () => submitUpdate(systemData, targetSelect.value, Number(weekSelect.value), submitButton));

    updateOldValues();
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  }

  async function submitUpdate(systemData, distributorToken, weekNumber, submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
      const fresh = await loadRemoteState();
      const target = resolveDistributorByToken(fresh.entries, distributorToken);
      if (!target) throw new Error('O distribuidor escolhido não foi encontrado novamente no relatório.');
      if (weekNumber < fresh.semanaInicial || weekNumber > fresh.semanaFinal) {
        throw new Error(`A Semana ${weekNumber} não está mais dentro do intervalo ${fresh.semanaInicial}–${fresh.semanaFinal}.`);
      }

      const normalizedSource = normalizeText(systemData.name);
      const normalizedTarget = normalizeText(target.item.nome);
      const mappedId = String(target.item.idSistemaRepresentante || '');
      if (mappedId && mappedId !== systemData.systemId) {
        throw new Error(`Este nome já está vinculado a outro ID do sistema (${mappedId}). Revise o distribuidor selecionado.`);
      }
      if (!mappedId && normalizedSource !== normalizedTarget) {
        const proceed = window.confirm(
          `O nome do sistema é “${systemData.name}”, mas você selecionou “${target.item.nome}”.\n\nDeseja realmente vincular e atualizar esse nome?`
        );
        if (!proceed) {
          submitButton.textContent = 'Confirmar e enviar';
          submitButton.disabled = false;
          return;
        }
      }

      const { weekIndex } = getWeekData(target, weekNumber, fresh.semanaInicial);
      const timestampServer = { '.sv': 'timestamp' };
      const weekUrl = `${FIREBASE_BASE}/distribuidores/${encodeURIComponent(target.index)}/semanas/${weekIndex}.json`;
      const distributorUrl = `${FIREBASE_BASE}/distribuidores/${encodeURIComponent(target.index)}.json`;

      await requestJson('PATCH', weekUrl, {
        realizado: systemData.totalCobranca,
        feito: systemData.notasNovas,
        atualizadoViaSistemaEm: timestampServer,
        origemSistema: 'Acertos Pendentes - Enviar para fechamento',
        semanaSistema: systemData.week.texto,
        semanaAtualizada: weekNumber,
        nomeSistema: systemData.name,
        idRepresentanteSistema: systemData.systemId
      });

      // Mantém um vínculo pelo ID do sistema para futuras atualizações, mesmo se houver diferença de acentuação no nome.
      try {
        await requestJson('PATCH', distributorUrl, {
          idSistemaRepresentante: systemData.systemId,
          ultimaAtualizacaoSistemaEm: timestampServer
        });
      } catch (metadataError) {
        console.warn('[Enviar para fechamento] Dados enviados, mas o vínculo de ID não pôde ser salvo.', metadataError);
      }

      closeModal();
      showToast(
        `${target.item.nome} atualizado na Semana ${weekNumber}: Realizado ${formatCurrency(systemData.totalCobranca)} e Qtd Feito ${systemData.notasNovas}.`,
        'success',
        7000
      );
      flashButtonSuccess();
    } catch (error) {
      showToast(error.message || String(error), 'error', 7500);
      submitButton.textContent = 'Confirmar e enviar';
      submitButton.disabled = false;
    }
  }

  function setButtonBusy(button, busy, text) {
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="a-Icon icon-refresh lm-spin" aria-hidden="true"></span>${escapeHtml(text || 'Aguarde...')}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
  }

  function flashButtonSuccess() {
    const button = document.getElementById(CUSTOM_BUTTON_ID);
    if (!button) return;
    const original = button.innerHTML;
    button.classList.add('lm-success');
    button.innerHTML = '<span class="a-Icon icon-check" aria-hidden="true"></span>Enviado';
    setTimeout(() => {
      button.classList.remove('lm-success');
      button.innerHTML = original;
    }, 2500);
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 130);
  }

  function showToast(message, type = 'success', duration = 4500) {
    document.getElementById(TOAST_ID)?.remove();
    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = `lm-fechamento-toast ${type === 'error' ? 'is-error' : 'is-success'}`;
    toast.innerHTML = `<span class="a-Icon ${type === 'error' ? 'icon-error' : 'icon-check'}" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 180);
    }, duration);
  }

  function installButton() {
    if (document.getElementById(CUSTOM_BUTTON_ID)) return;
    const actionsButton = document.getElementById(ACTIONS_BUTTON_ID);
    if (!actionsButton) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'a-IRR-actions lm-fechamento-actions';
    wrapper.innerHTML = `
      <button type="button" id="${CUSTOM_BUTTON_ID}" class="a-Button a-IRR-button a-Button--hot lm-fechamento-button" title="Enviar Total cobrança e Notas novas para o relatório Crescimento de Notas">
        <span class="a-Icon icon-send" aria-hidden="true"></span>
        <span>Enviar para fechamento</span>
      </button>`;

    const actionsWrapper = actionsButton.closest('.a-IRR-actions') || actionsButton;
    actionsWrapper.insertAdjacentElement('afterend', wrapper);
    wrapper.querySelector('button').addEventListener('click', beginSend);
  }

  function watchApexRefreshes() {
    const observer = new MutationObserver(() => installButton());
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('apexafterrefresh', () => setTimeout(installButton, 50));
    if (window.apex?.jQuery) {
      window.apex.jQuery(document).on('apexafterrefresh', `#${REGION_ID}`, () => setTimeout(installButton, 50));
    }
  }

  function addStyles() {
    if (document.getElementById('lm-fechamento-styles')) return;
    const style = document.createElement('style');
    style.id = 'lm-fechamento-styles';
    style.textContent = `
      .lm-fechamento-actions { margin-left: 8px; display: inline-flex; align-items: center; }
      .lm-fechamento-button { display: inline-flex !important; align-items: center; gap: 7px; white-space: nowrap; }
      .lm-fechamento-button.lm-success { background: #2f9e44 !important; border-color: #2f9e44 !important; color: #fff !important; }
      .lm-spin { animation: lmSpin .8s linear infinite; }
      @keyframes lmSpin { to { transform: rotate(360deg); } }

      .lm-fechamento-overlay {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 18px; background: rgba(15, 23, 42, .56);
        backdrop-filter: blur(3px); opacity: 0; transition: opacity .13s ease;
        font-family: "Oracle Sans", "Segoe UI", Arial, sans-serif;
      }
      .lm-fechamento-overlay.is-open { opacity: 1; }
      .lm-fechamento-box {
        width: min(680px, 100%); max-height: 92vh; overflow: auto;
        background: #fff; border-radius: 14px; box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
        transform: translateY(10px) scale(.985); transition: transform .13s ease;
      }
      .lm-fechamento-overlay.is-open .lm-fechamento-box { transform: translateY(0) scale(1); }
      .lm-fechamento-header { display: flex; gap: 14px; align-items: flex-start; padding: 20px 22px 15px; border-bottom: 1px solid #e5e7eb; }
      .lm-fechamento-header > div { flex: 1; }
      .lm-fechamento-header h2 { margin: 0; color: #1f2937; font-size: 20px; line-height: 1.2; }
      .lm-fechamento-header p { margin: 5px 0 0; color: #6b7280; font-size: 13px; }
      .lm-close { border: 0; background: #f3f4f6; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; color: #6b7280; font-size: 22px; line-height: 1; }
      .lm-close:hover { background: #fee2e2; color: #b91c1c; }
      .lm-fechamento-body { padding: 18px 22px; }
      .lm-source-card { display: grid; grid-template-columns: 1fr 150px; gap: 12px; padding: 13px; border: 1px solid #c7d2fe; background: #eef2ff; border-radius: 10px; margin-bottom: 16px; }
      .lm-source-card div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .lm-source-card span, .lm-field > span, .lm-value-card span { color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; }
      .lm-source-card strong { color: #3730a3; font-size: 14px; overflow-wrap: anywhere; }
      .lm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .lm-field { display: flex; flex-direction: column; gap: 6px; }
      .lm-field.lm-full { grid-column: 1 / -1; }
      .lm-field select { width: 100%; min-height: 40px; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; background: #fff; color: #111827; font: inherit; }
      .lm-field select:focus { outline: 2px solid rgba(79, 70, 229, .2); border-color: #4f46e5; }
      .lm-status-field { padding: 9px 11px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
      .lm-status-field strong { color: #374151; font-size: 14px; }
      .lm-warning { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 12px; font-weight: 650; }
      .lm-values { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
      .lm-value-card { border: 1px solid #dbeafe; background: #f8fbff; border-radius: 10px; padding: 13px; display: flex; flex-direction: column; gap: 5px; }
      .lm-value-card strong { font-size: 23px; color: #1d4ed8; line-height: 1.15; }
      .lm-value-card small { color: #6b7280; font-size: 11px; }
      .lm-confirm-check { display: flex; align-items: flex-start; gap: 9px; margin-top: 17px; padding: 12px; border-radius: 9px; border: 1px solid #d1d5db; background: #f9fafb; color: #374151; font-size: 13px; font-weight: 650; cursor: pointer; }
      .lm-confirm-check input { margin-top: 2px; width: 17px; height: 17px; accent-color: #4f46e5; }
      .lm-fechamento-footer { display: flex; justify-content: flex-end; gap: 9px; padding: 14px 22px 19px; border-top: 1px solid #e5e7eb; }
      .lm-fechamento-footer button { min-height: 38px; padding-inline: 16px; }
      .lm-fechamento-toast { position: fixed; right: 22px; bottom: 22px; z-index: 1000000; max-width: min(520px, calc(100vw - 44px)); display: flex; gap: 9px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; box-shadow: 0 12px 34px rgba(15, 23, 42, .2); color: #fff; font-family: "Oracle Sans", "Segoe UI", Arial, sans-serif; font-size: 13px; font-weight: 650; opacity: 0; transform: translateY(10px); transition: .18s ease; }
      .lm-fechamento-toast.is-visible { opacity: 1; transform: translateY(0); }
      .lm-fechamento-toast.is-success { background: #15803d; }
      .lm-fechamento-toast.is-error { background: #b91c1c; }
      @media (max-width: 640px) {
        .lm-source-card, .lm-form-grid, .lm-values { grid-template-columns: 1fr; }
        .lm-field.lm-full { grid-column: auto; }
        .lm-fechamento-footer { flex-direction: column-reverse; }
        .lm-fechamento-footer button { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }
})();
