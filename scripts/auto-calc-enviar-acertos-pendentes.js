// @central-id auto-calc-enviar-acertos-pendentes
// @central-name Auto Calc - Enviar Acertos Pendentes
// @central-version 3.9.0
// @central-match https://sistema.romancemoda.com.br/apex/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function () {
  'use strict';

  const DB_BASE = 'https://acompanhamentos-reta-final-default-rtdb.firebaseio.com';
  const ROOT_PATH = ['Auto-calc'];
  const BUTTON_ID = 'tm-auto-calc-send-button';
  const MAPPING_KEY = 'autoCalcNameMappingsV39';
  const REQUIRED_COLUMNS = [
    'distribuidor',
    'regiao',
    'debitos recebidos',
    'acertadas',
    'notas novas',
    'total cobranca',
    'debitos pendentes'
  ];

  const CANONICAL_COLUMNS = [
    ['id distribuidor', 'id dIstribuidor'],
    ['distribuidor'],
    ['regiao'],
    ['ult atualizacao', 'ultima atualizacao'],
    ['cobranca'],
    ['debitos recebidos'],
    ['deb rec outr distr', 'deb rec outro distr'],
    ['acertadas'],
    ['para atender'],
    ['notas novas'],
    ['notas adicionais'],
    ['prox sem', 'proxima sem'],
    ['notas em aberto'],
    ['total cobranca'],
    ['liberar prox semana'],
    ['distribuidor que atendeu'],
    ['perc venda'],
    ['cons que nao continuaram'],
    ['cadastros p atualizar'],
    ['alvo'],
    ['correcoes a fazer'],
    ['debitos pendentes'],
    ['valor receb outro dist'],
    ['notas c saldo negativo']
  ];

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizeName(value) {
    return normalizeText(String(value ?? '').replace(/\((?:inativ[oa]|ativo)\)/gi, ''));
  }

  function nameTokens(value) {
    const ignored = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
    return normalizeName(value).split(' ').filter(token => token && !ignored.has(token));
  }

  function parseMoneyBR(value) {
    const cleaned = String(value ?? '')
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const number = Number.parseFloat(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  function parseInteger(value) {
    const cleaned = String(value ?? '').replace(/[^0-9-]/g, '');
    const number = Number.parseInt(cleaned, 10);
    return Number.isFinite(number) ? number : 0;
  }

  function formatMoneyBR(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
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

  function isPage183() {
    const pageItem = document.getElementById('pFlowStepId');
    if (pageItem && String(pageItem.value) === '183') return true;
    return /(?:\?|&)p=2001:183(?::|&|$)/i.test(location.search + location.hash);
  }

  function firebaseUrl(segments) {
    return `${DB_BASE}/${segments.map(segment => encodeURIComponent(String(segment))).join('/')}.json`;
  }

  function firebaseRequest(segments, method = 'GET', data = undefined) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: firebaseUrl(segments),
        headers: data === undefined ? {} : { 'Content-Type': 'application/json; charset=UTF-8' },
        data: data === undefined ? undefined : JSON.stringify(data),
        timeout: 30000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            if (!response.responseText) {
              resolve(null);
              return;
            }
            try {
              resolve(JSON.parse(response.responseText));
            } catch {
              resolve(response.responseText);
            }
            return;
          }
          reject(new Error(`Firebase respondeu ${response.status}: ${response.responseText || 'sem detalhes'}`));
        },
        onerror() {
          reject(new Error('Não foi possível conectar ao Firebase.'));
        },
        ontimeout() {
          reject(new Error('A conexão com o Firebase excedeu o tempo limite.'));
        }
      });
    });
  }

  function showToast(message, type = 'success', duration = 3600) {
    let container = document.getElementById('tm-auto-calc-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tm-auto-calc-toast-container';
      Object.assign(container.style, {
        position: 'fixed',
        top: '18px',
        right: '18px',
        zIndex: '1000000',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '430px'
      });
      document.body.appendChild(container);
    }

    const colors = {
      success: ['#047857', '#ecfdf5'],
      error: ['#b91c1c', '#fef2f2'],
      info: ['#1d4ed8', '#eff6ff'],
      warning: ['#b45309', '#fffbeb']
    };
    const [border, background] = colors[type] || colors.info;
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      background,
      color: '#111827',
      border: `1px solid ${border}`,
      borderLeft: `6px solid ${border}`,
      borderRadius: '9px',
      padding: '12px 14px',
      boxShadow: '0 12px 28px rgba(0,0,0,.18)',
      fontFamily: 'Oracle Sans, Segoe UI, sans-serif',
      fontSize: '14px',
      lineHeight: '1.35'
    });
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function showDetails(title, html) {
    const overlay = document.createElement('div');
    overlay.id = 'tm-auto-calc-details-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(15,23,42,.55)',
      zIndex: '1000001',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    });
    overlay.innerHTML = `
      <div style="width:min(650px,96vw);max-height:85vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,.28);font-family:Oracle Sans,Segoe UI,sans-serif;color:#111827;">
        <div style="padding:16px 18px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:15px;">
          <strong style="font-size:17px;">${escapeHtml(title)}</strong>
          <button type="button" data-close style="border:0;background:#f3f4f6;border-radius:7px;padding:7px 10px;cursor:pointer;">Fechar</button>
        </div>
        <div style="padding:18px;line-height:1.5;">${html}</div>
      </div>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-close]')) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function findReportTable() {
    const tables = [...document.querySelectorAll('table.a-IRR-table')];
    return tables.find(table => {
      const labels = [...table.querySelectorAll('th[id]')].map(th => normalizeText(th.textContent));
      return REQUIRED_COLUMNS.every(required => labels.includes(required));
    }) || null;
  }

  function getValue(record, aliases) {
    for (const alias of aliases) {
      const normalized = normalizeText(alias);
      if (Object.prototype.hasOwnProperty.call(record.values, normalized)) {
        return record.values[normalized];
      }
    }
    return '';
  }

  function extractRecords() {
    const table = findReportTable();
    if (!table) {
      throw new Error('A tabela de Acertos Distribuidores não foi encontrada ou está sem as colunas necessárias.');
    }

    const labelById = new Map();
    table.querySelectorAll('th[id]').forEach(th => {
      const label = normalizeText(th.textContent);
      if (label) labelById.set(th.id, label);
    });

    const records = [];
    let currentWeek = '';

    [...table.querySelectorAll('tr')].forEach(row => {
      const cells = [...row.querySelectorAll(':scope > td')];
      if (!cells.length) {
        const groupHeader = row.querySelector(':scope > th[colspan]');
        if (groupHeader) {
          currentWeek = groupHeader.textContent.replace(/^\s*semana\s*:\s*/i, '').trim();
        }
        return;
      }

      const values = {};
      cells.forEach(cell => {
        const headerIds = String(cell.getAttribute('headers') || '').split(/\s+/).filter(Boolean);
        const columnId = headerIds.find(id => labelById.has(id) && !labelById.get(id).startsWith('semana'));
        if (!columnId) return;
        values[labelById.get(columnId)] = cell.textContent.replace(/\u00a0/g, ' ').trim();
      });

      const distributor = values.distribuidor || '';
      if (!distributor) return;

      const record = { values, week: currentWeek };
      record.matrixRow = CANONICAL_COLUMNS.map(aliases => getValue(record, aliases));
      records.push(record);
    });

    if (!records.length) {
      throw new Error('Nenhuma linha de distribuidor foi encontrada. Aplique o filtro e aguarde o relatório carregar.');
    }
    return records;
  }

  function aggregateRecords(records) {
    const groups = new Map();

    for (const record of records) {
      const fullName = getValue(record, ['distribuidor']).trim();
      const key = normalizeName(fullName);
      if (!key) continue;

      if (!groups.has(key)) {
        groups.set(key, {
          sourceName: fullName,
          region: getValue(record, ['regiao']).trim() || '-',
          total: 0,
          received: 0,
          pending: 0,
          notes: 0,
          settled: 0,
          weeks: new Set(),
          matrix: []
        });
      }

      const group = groups.get(key);
      group.total += parseMoneyBR(getValue(record, ['total cobranca']));
      group.received += parseMoneyBR(getValue(record, ['debitos recebidos']));
      group.pending += parseMoneyBR(getValue(record, ['debitos pendentes']));
      group.notes += parseInteger(getValue(record, ['notas novas']));
      group.settled += parseInteger(getValue(record, ['acertadas']));
      if (record.week) group.weeks.add(record.week);
      group.matrix.push(record.matrixRow);
    }

    return [...groups.values()].map(group => ({
      ...group,
      weekLabel: [...group.weeks].join(', '),
      ticket: group.settled > 0 ? Math.round(group.total / group.settled) : 0
    }));
  }

  function getStoredMappings() {
    const value = GM_getValue(MAPPING_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function saveStoredMapping(sourceName, targetName) {
    const mappings = getStoredMappings();
    mappings[normalizeName(sourceName)] = targetName;
    GM_setValue(MAPPING_KEY, mappings);
  }

  function resolveTargetAutomatically(sourceName, names, dataByProfile) {
    const sourceNormalized = normalizeName(sourceName);
    const mappings = getStoredMappings();
    if (mappings[sourceNormalized] && names.includes(mappings[sourceNormalized])) {
      return mappings[sourceNormalized];
    }

    const fullNameMatches = names.filter(profile => {
      const savedFullName = dataByProfile?.[profile]?.nomeCompleto;
      return savedFullName && normalizeName(savedFullName) === sourceNormalized;
    });
    if (fullNameMatches.length === 1) return fullNameMatches[0];

    const exactProfileMatches = names.filter(profile => normalizeName(profile) === sourceNormalized);
    if (exactProfileMatches.length === 1) return exactProfileMatches[0];

    const sourceTokens = new Set(nameTokens(sourceName));
    const scored = names.map(profile => {
      const tokens = nameTokens(profile);
      if (!tokens.length) return { profile, score: 0 };
      const allIncluded = tokens.every(token => sourceTokens.has(token));
      if (!allIncluded) return { profile, score: 0 };
      return { profile, score: 50 + (tokens.length * 10) };
    }).filter(item => item.score > 0);

    if (!scored.length) return null;
    const bestScore = Math.max(...scored.map(item => item.score));
    const best = scored.filter(item => item.score === bestScore);
    return best.length === 1 ? best[0].profile : null;
  }

  function chooseTargetProfile(sourceName, names) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(15,23,42,.58)',
        zIndex: '1000002',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      });

      const options = names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      overlay.innerHTML = `
        <form style="width:min(520px,96vw);background:#fff;border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,.3);font-family:Oracle Sans,Segoe UI,sans-serif;color:#111827;overflow:hidden;">
          <div style="padding:16px 18px;border-bottom:1px solid #e5e7eb;"><strong style="font-size:17px;">Relacionar distribuidor</strong></div>
          <div style="padding:18px;">
            <p style="margin:0 0 13px;line-height:1.45;">O nome <strong>${escapeHtml(sourceName)}</strong> ainda não pôde ser ligado automaticamente a um perfil do Auto Calc.</p>
            <label style="display:block;font-weight:700;margin-bottom:7px;">Perfil no Auto Calc</label>
            <select required style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;">
              <option value="">Selecione...</option>${options}
            </select>
            <p style="font-size:12px;color:#64748b;margin:9px 0 0;">A escolha ficará salva para os próximos envios deste nome.</p>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:9px;padding:13px 18px;background:#f8fafc;border-top:1px solid #e5e7eb;">
            <button type="button" data-cancel style="padding:9px 14px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;">Cancelar</button>
            <button type="submit" style="padding:9px 14px;border:0;background:#047857;color:#fff;border-radius:8px;font-weight:700;cursor:pointer;">Confirmar</button>
          </div>
        </form>`;

      const form = overlay.querySelector('form');
      const select = overlay.querySelector('select');
      overlay.querySelector('[data-cancel]').addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        const selected = select.value;
        if (!selected) return;
        overlay.remove();
        saveStoredMapping(sourceName, selected);
        resolve(selected);
      });
      document.body.appendChild(overlay);
      select.focus();
    });
  }

  function normalizeNames(rawNames) {
    if (Array.isArray(rawNames)) return rawNames.filter(Boolean).map(String);
    if (rawNames && typeof rawNames === 'object') return Object.values(rawNames).filter(Boolean).map(String);
    return [];
  }

  async function updateProfile(targetProfile, group) {
    const updatedAt = new Date().toISOString();
    const dataPatch = {
      total: formatMoneyBR(group.total),
      debRecebidos: formatMoneyBR(group.received),
      debPendentes: formatMoneyBR(group.pending),
      notas: String(group.notes),
      ticket: String(group.ticket),
      regiao: group.region || '-',
      nomeCompleto: group.sourceName,
      atualizadoVia: 'Tampermonkey • Acertos Pendentes',
      atualizadoEm: updatedAt,
      semanaOrigem: group.weekLabel || ''
    };

    await firebaseRequest([...ROOT_PATH, 'dados', targetProfile], 'PATCH', dataPatch);
    await firebaseRequest([...ROOT_PATH, 'preencher', targetProfile], 'PUT', group.matrix);
    return dataPatch;
  }

  function summarizeResult(results) {
    const rows = results.map(result => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>${escapeHtml(result.target)}</strong><br><small style="color:#64748b;">${escapeHtml(result.source)}</small></td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(result.total)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(result.notes)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(result.week || '-')}</td>
      </tr>`).join('');

    showDetails('Envio concluído', `
      <p style="margin-top:0;">Os dados abaixo foram enviados ao Auto Calc. Os lançamentos manuais e as observações existentes foram preservados.</p>
      <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:9px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;">Perfil</th><th style="padding:8px;text-align:right;">Total</th><th style="padding:8px;">Notas</th><th style="padding:8px;">Semana</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`);
  }

  async function sendToAutoCalc() {
    const button = document.getElementById(BUTTON_ID);
    if (!button || button.disabled) return;

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="a-Icon icon-refresh" aria-hidden="true"></span> Enviando...';

    try {
      const records = extractRecords();
      const groups = aggregateRecords(records);
      const root = await firebaseRequest(ROOT_PATH, 'GET') || {};
      const names = normalizeNames(root.nomes);
      const dataByProfile = root.dados || {};

      if (!names.length) {
        throw new Error('A lista de distribuidores do Auto Calc está vazia. Abra o Auto Calc uma vez antes de enviar.');
      }

      const results = [];
      for (const group of groups) {
        let target = resolveTargetAutomatically(group.sourceName, names, dataByProfile);
        if (!target) target = await chooseTargetProfile(group.sourceName, names);
        if (!target) throw new Error(`O envio de ${group.sourceName} foi cancelado porque nenhum perfil foi selecionado.`);

        const saved = await updateProfile(target, group);
        results.push({
          source: group.sourceName,
          target,
          total: saved.total,
          notes: saved.notas,
          week: saved.semanaOrigem
        });
      }

      showToast(`${results.length} perfil(is) atualizado(s) no Auto Calc.`, 'success');
      summarizeResult(results);
    } catch (error) {
      console.error('[Auto Calc]', error);
      showToast(error.message || 'Não foi possível enviar os dados ao Auto Calc.', 'error', 7000);
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  function injectButton() {
    if (!isPage183() || document.getElementById(BUTTON_ID)) return;

    const actionsButton = document.querySelector('button.a-IRR-button--actions');
    if (!actionsButton) return;

    const actionsWrapper = actionsButton.closest('.a-IRR-actions') || actionsButton.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'a-IRR-actions tm-auto-calc-actions';
    wrapper.style.marginLeft = '8px';

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'a-Button a-IRR-button';
    button.title = 'Enviar os dados visíveis para o Auto Calc';
    button.setAttribute('aria-label', 'Enviar para o Auto Calc');
    Object.assign(button.style, {
      background: '#047857',
      borderColor: '#047857',
      color: '#ffffff',
      fontWeight: '700',
      whiteSpace: 'nowrap'
    });
    button.innerHTML = '<span class="a-Icon icon-upload" aria-hidden="true"></span> Enviar p/ Auto Calc';
    button.addEventListener('click', sendToAutoCalc);
    wrapper.appendChild(button);
    actionsWrapper.insertAdjacentElement('afterend', wrapper);
  }

  if (!isPage183()) return;

  injectButton();
  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(injectButton, 2000);
})();
