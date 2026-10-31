// ==UserScript==
// @name         Central GitHub | Script Mestre
// @namespace    central-github-tampermonkey
// @version      1.6.0
// @description  Central V1.6: arraste direto, clique para mover, duplo clique para abrir o painel.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // >>> ALTERE APENAS ESTA LINHA ANTES DE INSTALAR <<<
  const REPOSITORIO = 'jhonesfeliciano/central-tampermonkey';

  const RAMO = 'main';
  const INTERVALO_MS = 3 * 60 * 1000;
  const PREFIXO = 'central-github-v1:';
  const REPO_VALIDO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(REPOSITORIO) &&
    !REPOSITORIO.startsWith('SEU_USUARIO/');
  const BASE = REPO_VALIDO
    ? `https://raw.githubusercontent.com/${REPOSITORIO}/${RAMO}/`
    : '';

  const executados = new Map();
  const atualizacoesPendentes = new Set();
  const falhas = new Map();
  let catalogo = null;
  let sincronizando = false;
  let ultimaSincronizacao = null;
  let aviso = '';
  let painelAberto = false;
  let interfaceUI = null;

  const log = (...args) => console.log('[CENTRAL GITHUB]', ...args);
  const erro = (...args) => console.error('[CENTRAL GITHUB]', ...args);

  function requisitar(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 20000,
        headers: { 'Cache-Control': 'no-cache' },
        onload: response => {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.responseText);
          } else {
            reject(new Error(`HTTP ${response.status} em ${url.split('?')[0]}`));
          }
        },
        onerror: () => reject(new Error('Erro de rede ao consultar GitHub')),
        ontimeout: () => reject(new Error('Tempo esgotado ao consultar GitHub')),
      });
    });
  }

  function corresponde(padrao, pagina) {
    if (typeof padrao !== 'string' || !/^https?:\/\//.test(padrao)) return false;
    try {
      const regex = '^' + padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$';
      return new RegExp(regex).test(pagina);
    } catch { return false; }
  }

  function validarCatalogo(entrada) {
    if (!entrada || entrada.schema !== 1 || !Array.isArray(entrada.scripts)) {
      throw new Error('manifest.json com formato inválido');
    }
    const usados = new Set();
    const scripts = entrada.scripts.map(item => {
      if (!item || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(item.id) || usados.has(item.id)) {
        throw new Error('ID de script inválido ou duplicado no catálogo');
      }
      usados.add(item.id);
      if (typeof item.file !== 'string' || !/^scripts\/[a-zA-Z0-9_.-]+\.js$/.test(item.file)) {
        throw new Error(`Arquivo inválido para o módulo ${item.id}`);
      }
      if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
        throw new Error(`SHA-256 inválido para o módulo ${item.id}`);
      }
      if (!Array.isArray(item.matches) || !item.matches.length ||
          !item.matches.every(p => typeof p === 'string' && /^https?:\/\//.test(p))) {
        throw new Error(`@central-match inválido para ${item.id}`);
      }
      return {
        id: item.id, name: String(item.name || item.id),
        version: String(item.version || '1.0.0'), file: item.file,
        sha256: item.sha256, matches: item.matches,
        enabled: item.enabled !== false
      };
    });
    return { schema: 1, scripts };
  }

  async function conferirIntegridade(conteudo, shaEsperado) {
    // Quando Web Crypto está disponível, a checagem impede executar código
    // de versão diferente daquela publicada no catálogo.
    if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') {
      log('Web Crypto indisponível: usando validação por HTTPS + repositório configurado.');
      return;
    }
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(conteudo));
    const recebido = Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
    if (recebido !== shaEsperado) {
      throw new Error('Integridade divergente. O catálogo e o arquivo ainda podem estar sincronizando.');
    }
  }

  async function obterModulo(script) {
    const chave = PREFIXO + 'modulo:' + script.id;
    const salvo = GM_getValue(chave, null);
    const endereco = BASE + script.file + '?sha=' + script.sha256 + '&t=' + Date.now();
    try {
      const codigo = await requisitar(endereco);
      await conferirIntegridade(codigo, script.sha256);
      GM_setValue(chave, { sha256: script.sha256, codigo });
      return codigo;
    } catch (e) {
      if (salvo && salvo.sha256 === script.sha256 && typeof salvo.codigo === 'string') {
        log(`GitHub indisponível para ${script.id}; usando cópia salva.`);
        await conferirIntegridade(salvo.codigo, script.sha256);
        return salvo.codigo;
      }
      throw e;
    }
  }

  function executar(script, codigo) {
    const armario = PREFIXO + 'dados:' + script.id + ':';
    const API = Object.freeze({
      id: script.id,
      name: script.name,
      version: script.version,
      storage: Object.freeze({
        get: (chave, padrao = null) => GM_getValue(armario + chave, padrao),
        set: (chave, valor) => GM_setValue(armario + chave, valor),
        delete: chave => GM_deleteValue(armario + chave)
      }),
      log: (...msg) => console.log(`[CENTRAL:${script.id}]`, ...msg)
    });
    // Executar somente módulos confiáveis do SEU repositório. Script legado
    // que dependa de @grant especiais ou de document-start pode precisar adaptação.
    const executarCodigo = new Function(
      'API', 'GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_deleteValue',
      'GM_addStyle', 'GM_openInTab', 'GM_setClipboard', 'GM_registerMenuCommand',
      'unsafeWindow',
      '"use strict";\n' + codigo + '\n//# sourceURL=central-' + script.id + '.js'
    );
    executarCodigo(
      API, GM_xmlhttpRequest, GM_getValue, GM_setValue, GM_deleteValue,
      GM_addStyle, GM_openInTab, GM_setClipboard, GM_registerMenuCommand, unsafeWindow
    );
  }

  function interessa(script) {
    return script.matches.some(pattern => corresponde(pattern, location.href));
  }

  function explicarExibicao(script) {
    // Executar JS não garante que um botão será mostrado: cada módulo pode
    // restringir internamente a sua própria interface à página/elemento certo.
    if (!interessa(script)) return 'Este endereço não corresponde ao @central-match.';
    if (!executados.has(script.id)) return 'Ainda não carregado pelo Script Mestre.';
    if (script.id === 'romance-botao-colar-cpf') {
      const campo = document.getElementById('P280_CPF');
      if (!campo) return 'Código carregado, mas esta tela não tem o campo P280_CPF.';
      if (document.getElementById('tm-btn-colar-cpf')) return 'Botão Colar encontrado nesta página.';
      const wrapper = campo.closest('.t-Form-itemWrapper');
      return wrapper
        ? 'Campo CPF encontrado, mas o botão ainda não apareceu; verifique a execução do módulo.'
        : 'Campo CPF encontrado, mas sem .t-Form-itemWrapper (estrutura esperada pelo módulo original).';
    }
    if (script.id === 'sistema-romance-atalhos-rapidos') {
      const appId = document.getElementById('pFlowId')?.value || '';
      const pageId = document.getElementById('pFlowStepId')?.value || '';
      if (document.getElementById('lm-apex-atalhos-host')) {
        return 'Painel de atalhos presente (pode estar fechado no botão redondo).';
      }
      if (appId !== '2001' || pageId !== '1') {
        return 'Atalhos só aparecem na página inicial 1 do aplicativo 2001; logo pode aparecer em outras telas.';
      }
      return 'Página inicial reconhecida, mas o painel não foi criado; recarregue e confira o Console.';
    }
    return 'Código carregado. A interface depende das condições previstas neste módulo.';
  }

  function gerarDiagnostico() {
    const linhas = [
      'CENTRAL GITHUB 1.3 — DIAGNÓSTICO',
      'Repositório: ' + REPOSITORIO,
      'Página: ' + location.origin + location.pathname,
      'Módulos no catálogo: ' + (catalogo?.scripts?.length || 0),
      'Última consulta: ' + (ultimaSincronizacao?.toLocaleString('pt-BR') || 'não realizada'),
      'Aviso: ' + aviso,
      ''
    ];
    for (const script of catalogo?.scripts || []) {
      const match = interessa(script);
      const off = GM_getValue(PREFIXO + 'desligado:' + script.id, false);
      const status = !script.enabled ? 'DESATIVADO NO GITHUB'
        : off ? 'DESATIVADO NO NAVEGADOR'
        : falhas.has(script.id) ? 'ERRO: ' + falhas.get(script.id)
        : atualizacoesPendentes.has(script.id) ? 'NOVA VERSÃO: recarregar'
        : executados.has(script.id) ? 'ARQUIVO EXECUTADO'
        : match ? 'AGUARDANDO' : 'OUTRA PÁGINA';
      linhas.push(script.name + ' (v' + script.version + ')');
      linhas.push('  ' + script.file + ' | ' + status);
      linhas.push('  ' + explicarExibicao(script));
      linhas.push('  match: ' + script.matches.join(', '));
    }
    return linhas.join('\n');
  }

  async function sincronizar() {
    if (!REPO_VALIDO) {
      aviso = 'Configure SEU_USUARIO no Script Mestre.';
      erro(aviso);
      atualizarPainel(true);
      return;
    }
    if (sincronizando) return;
    sincronizando = true;
    aviso = 'Consultando GitHub...';
    atualizarPainel();

    try {
      let novo;
      try {
        const texto = await requisitar(BASE + 'manifest.json?t=' + Date.now());
        novo = validarCatalogo(JSON.parse(texto));
        GM_setValue(PREFIXO + 'catalogo', novo);
        aviso = 'Catálogo atualizado.';
      } catch (e) {
        const salvo = GM_getValue(PREFIXO + 'catalogo', null);
        if (!salvo) throw e;
        novo = validarCatalogo(salvo);
        aviso = 'Sem acesso ao GitHub. Usando último catálogo salvo.';
        log(aviso, e.message);
      }
      catalogo = novo;
      falhas.clear();
      for (const script of catalogo.scripts) {
        if (!interessa(script) || !script.enabled || GM_getValue(PREFIXO + 'desligado:' + script.id, false)) continue;
        const anterior = executados.get(script.id);
        if (anterior) {
          if (anterior !== script.sha256) atualizacoesPendentes.add(script.id);
          else atualizacoesPendentes.delete(script.id);
          continue;
        }
        try {
          const codigo = await obterModulo(script);
          executar(script, codigo);
          executados.set(script.id, script.sha256);
          atualizacoesPendentes.delete(script.id);
          log('Executado:', script.name, script.version);
        } catch (e) {
          falhas.set(script.id, e.message || String(e));
          erro('Não foi possível executar', script.id, e);
        }
      }
      ultimaSincronizacao = new Date();
    } catch (e) {
      aviso = 'Erro ao carregar catálogo: ' + e.message;
      erro(aviso, e);
    } finally {
      sincronizando = false;
      atualizarPainel();
    }
  }

  // A posição é global para o Script Mestre e sobrevive à atualização da página.
  const CHAVE_POSICAO = PREFIXO + 'botao:posicao-v1';
  const BORDA = 10;

  function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
  }

  function areaBotao() {
    const botao = interfaceUI?.abrir;
    return {
      largura: botao?.offsetWidth || 130,
      altura: botao?.offsetHeight || 39,
      viewportL: window.innerWidth || document.documentElement.clientWidth || 1024,
      viewportA: window.innerHeight || document.documentElement.clientHeight || 768
    };
  }

  // APEX e outros sites podem usar regras CSS globais; fixamos as coordenadas
  // com important para o posicionamento não ser sobrescrito pelo site.
  function colocarBotao(x, y) {
    if (!interfaceUI) return;
    const { root } = interfaceUI;
    const area = areaBotao();
    const posX = limitar(Math.round(x), BORDA, Math.max(BORDA, area.viewportL - area.largura - BORDA));
    const posY = limitar(Math.round(y), BORDA, Math.max(BORDA, area.viewportA - area.altura - BORDA));
    root.style.setProperty('position', 'fixed', 'important');
    root.style.setProperty('left', `${posX}px`, 'important');
    root.style.setProperty('top', `${posY}px`, 'important');
    root.style.setProperty('right', 'auto', 'important');
    root.style.setProperty('bottom', 'auto', 'important');
    root.style.setProperty('transform', 'none', 'important');
    if (painelAberto) ajustarPosicaoPainel();
  }

  function salvarPosicaoBotao() {
    if (!interfaceUI) return;
    const rect = interfaceUI.abrir.getBoundingClientRect();
    const area = areaBotao();
    const maxX = Math.max(1, area.viewportL - area.largura);
    const maxY = Math.max(1, area.viewportA - area.altura);
    GM_setValue(CHAVE_POSICAO, {
      x: limitar(rect.left / maxX, 0, 1),
      y: limitar(rect.top / maxY, 0, 1)
    });
  }

  function restaurarPosicaoBotao() {
    if (!interfaceUI) return;
    const pos = GM_getValue(CHAVE_POSICAO, null);
    const area = areaBotao();
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      colocarBotao(pos.x * Math.max(0, area.viewportL - area.largura),
                   pos.y * Math.max(0, area.viewportA - area.altura));
    } else {
      colocarBotao(16, area.viewportA - area.altura - 16);
    }
  }

  function ajustarPosicaoPainel() {
    if (!interfaceUI || !painelAberto) return;
    const { abrir, painel } = interfaceUI;
    const area = areaBotao();
    const rect = abrir.getBoundingClientRect();
    const margem = 12;
    const espacamento = 8;
    const largura = Math.max(180, Math.min(420, area.viewportL - margem * 2));
    painel.style.width = `${largura}px`;
    const alvoX = limitar(rect.left, margem, Math.max(margem, area.viewportL - largura - margem));
    painel.style.left = `${Math.round(alvoX - rect.left)}px`;
    const acima = Math.max(0, rect.top - margem - espacamento);
    const abaixo = Math.max(0, area.viewportA - rect.bottom - margem - espacamento);
    const alturaDesejada = Math.min(painel.scrollHeight || 400, area.viewportA - margem * 2);
    const colocarAcima = (acima >= alturaDesejada) || (acima > abaixo);
    painel.style.maxHeight = `${Math.max(30, colocarAcima ? acima : abaixo)}px`;
    if (colocarAcima) {
      painel.style.top = 'auto';
      painel.style.bottom = `calc(100% + ${espacamento}px)`;
    } else {
      painel.style.bottom = 'auto';
      painel.style.top = `calc(100% + ${espacamento}px)`;
    }
  }

  function prepararPainel() {
    if (interfaceUI || !document.body) return;
    const root = document.createElement('div');
    root.id = 'central-github-interface';
    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'central-github-botao';
    abrir.textContent = '⚙ Central v1.6 0/0';
    const painel = document.createElement('section');
    painel.className = 'central-github-painel';
    const dica = document.createElement('div');
    dica.className = 'central-github-dica-mover';
    dica.textContent = 'Mova o mouse e clique para fixar • Esc cancela';
    dica.style.display = 'none';
    root.append(abrir, painel, dica);
    document.body.appendChild(root);
    interfaceUI = { root, abrir, painel, dica };
    restaurarPosicaoBotao();

    let modoMover = false;
    let pressionando = null;
    let arrastou = false;
    let ignorarClickAte = 0;
    let temporizadorClique = null;
    let duploJaTratadoAte = 0;
    let ancoraX = 0;
    let ancoraY = 0;
    const ESPERA_DUPLO_CLIQUE_MS = 330;

    function cancelarCliquePendente() {
      if (temporizadorClique !== null) {
        clearTimeout(temporizadorClique);
        temporizadorClique = null;
      }
    }

    function indicarModo() {
      abrir.classList.toggle('modo-mover', modoMover);
      dica.style.display = modoMover ? 'block' : 'none';
      abrir.setAttribute('aria-pressed', String(modoMover));
      abrir.title = modoMover
        ? 'MODO MOVER: mova o mouse e clique para fixar. Ou segure e arraste.'
        : 'Segure e arraste para mover • 1 clique ativa o movimento • 2 cliques abrem a Central';
      abrir.setAttribute('aria-label', abrir.title);
    }

    function finalizarMovimento(salvar) {
      cancelarCliquePendente();
      if (modoMover) {
        modoMover = false;
        if (salvar) salvarPosicaoBotao();
        else restaurarPosicaoBotao();
      }
      pressionando = null;
      arrastou = false;
      indicarModo();
      if (painelAberto) ajustarPosicaoPainel();
    }

    function ativarMovimento(clientX, clientY) {
      if (painelAberto) {
        painelAberto = false;
        atualizarPainel(true);
      }
      const rect = abrir.getBoundingClientRect();
      modoMover = true;
      ancoraX = Number.isFinite(clientX) ? limitar(clientX - rect.left, 0, rect.width) : rect.width / 2;
      ancoraY = Number.isFinite(clientY) ? limitar(clientY - rect.top, 0, rect.height) : rect.height / 2;
      indicarModo();
    }

    function abrirFecharPainel() {
      cancelarCliquePendente();
      if (modoMover) finalizarMovimento(true);
      painelAberto = !painelAberto;
      atualizarPainel(true);
    }

    // Segurar e arrastar funciona imediatamente, sem aguardar um clique prévio.
    // Um clique sem deslocamento ainda ativa o modo de mover sem segurar.
    function iniciarPressao(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const rect = abrir.getBoundingClientRect();
      pressionando = {
        id: e.pointerId ?? 'mouse',
        x: e.clientX, y: e.clientY,
        offsetX: limitar(e.clientX - rect.left, 0, rect.width),
        offsetY: limitar(e.clientY - rect.top, 0, rect.height)
      };
      arrastou = false;
      // Não usamos setPointerCapture para mouse: ao mover o botão, a captura
      // pode interferir em click/dblclick em certos sistemas Oracle APEX.
    }

    function mover(e) {
      const x = e.clientX, y = e.clientY;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (pressionando) {
        if (e.pointerId != null && pressionando.id !== 'mouse' && e.pointerId !== pressionando.id) return;
        const dist = Math.hypot(x - pressionando.x, y - pressionando.y);
        if (!arrastou && dist > 5) {
          cancelarCliquePendente();
          arrastou = true;
          modoMover = true;
          indicarModo();
        }
        if (arrastou) {
          colocarBotao(x - pressionando.offsetX, y - pressionando.offsetY);
          if (e.cancelable) e.preventDefault();
          return;
        }
      }
      if (modoMover && !pressionando && (e.pointerType !== 'touch' || e.buttons > 0)) {
        colocarBotao(x - ancoraX, y - ancoraY);
      }
    }

    function concluirPressao(e) {
      if (!pressionando) return;
      if (e && e.pointerId != null && pressionando.id !== 'mouse' && e.pointerId !== pressionando.id) return;
      pressionando = null;
      if (arrastou) {
        arrastou = false;
        finalizarMovimento(true);
        ignorarClickAte = Date.now() + 450;
      }
    }

    abrir.addEventListener('pointerdown', iniciarPressao);
    // Para compatibilidade com ambientes onde PointerEvents não são emitidos.
    abrir.addEventListener('mousedown', e => { if (!pressionando) iniciarPressao(e); });

    window.addEventListener('pointermove', mover, {capture: true, passive: false});
    window.addEventListener('mousemove', mover, {capture: true, passive: false});
    window.addEventListener('pointerup', concluirPressao, true);
    window.addEventListener('mouseup', concluirPressao, true);
    window.addEventListener('pointercancel', () => {
      if (arrastou) finalizarMovimento(true);
      else pressionando = null;
    }, true);
    window.addEventListener('blur', () => {
      if (pressionando && arrastou) finalizarMovimento(true);
      else pressionando = null;
    });

    abrir.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() < ignorarClickAte) return;
      if (e.detail === 0) { abrirFecharPainel(); return; } // teclado
      if (e.detail >= 2 || temporizadorClique !== null) {
        duploJaTratadoAte = Date.now() + 500;
        abrirFecharPainel();
        return;
      }
      const x = e.clientX, y = e.clientY;
      temporizadorClique = setTimeout(() => {
        temporizadorClique = null;
        if (modoMover) finalizarMovimento(true);
        else ativarMovimento(x, y);
      }, ESPERA_DUPLO_CLIQUE_MS);
    });

    abrir.addEventListener('dblclick', e => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() > duploJaTratadoAte) {
        duploJaTratadoAte = Date.now() + 500;
        abrirFecharPainel();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modoMover) {
        finalizarMovimento(false);
        e.preventDefault();
      }
    }, true);

    window.addEventListener('resize', () => {
      if (!modoMover) restaurarPosicaoBotao();
      else {
        const r = abrir.getBoundingClientRect();
        colocarBotao(r.left, r.top);
      }
    }, {passive:true});
    indicarModo();
  }

  function texto(tag, conteudo, classe = '') {
    const element = document.createElement(tag);
    element.textContent = conteudo;
    if (classe) element.className = classe;
    return element;
  }

  function atualizarPainel(forcar = false) {
    if (!document.body) return;
    const todos = catalogo ? catalogo.scripts : [];
    const relevantes = todos.filter(interessa);
    const deveMostrar = !REPO_VALIDO || relevantes.length > 0 || painelAberto || aviso.startsWith('Erro') || forcar;
    if (!deveMostrar && !interfaceUI) return;
    prepararPainel();
    if (!interfaceUI) return;
    const { root, abrir, painel } = interfaceUI;
    root.style.display = deveMostrar ? '' : 'none';
    const carregados = relevantes.filter(s => executados.has(s.id)).length;
    abrir.textContent = `⚙ Central v1.6 ${carregados}/${relevantes.length}`;
    painel.style.display = painelAberto ? 'block' : 'none';
    if (!painelAberto) return;
    painel.replaceChildren();
    painel.appendChild(texto('h3', 'Central GitHub — Diagnóstico V1.6'));
    painel.appendChild(texto('p', aviso, 'central-msg'));
    painel.appendChild(texto('p', 'Segure o botão e arraste para reposicionar; solte para salvar. Ou clique uma vez, mova o mouse e clique para fixar. Duplo clique abre o painel.', 'central-legenda'));

    painel.appendChild(texto('p', `${todos.length} script(s) no GitHub • ${relevantes.length} compatível(is) com esta URL • ${carregados} código(s) executado(s)`, 'central-legenda'));
    painel.appendChild(texto('p', 'Página: ' + location.origin + location.pathname, 'central-legenda'));
    if (ultimaSincronizacao) {
      painel.appendChild(texto('p', 'Última consulta: ' + ultimaSincronizacao.toLocaleTimeString('pt-BR'), 'central-legenda'));
    }
    if (!todos.length) {
      painel.appendChild(texto('p', 'Nenhum script no catálogo. Confira GitHub, Actions e a conexão.', 'central-legenda'));
    }
    for (const script of todos) {
      const linha = document.createElement('label');
      linha.className = 'central-linha';
      const marcar = document.createElement('input');
      marcar.type = 'checkbox';
      marcar.checked = script.enabled && !GM_getValue(PREFIXO + 'desligado:' + script.id, false);
      marcar.disabled = !script.enabled;
      marcar.addEventListener('change', () => {
        GM_setValue(PREFIXO + 'desligado:' + script.id, !marcar.checked);
        aviso = marcar.checked
          ? 'Ativado. Sincronizando...'
          : 'Desativado. Recarregue a página para interromper a execução atual.';
        atualizarPainel();
        if (marcar.checked) sincronizar();
      });
      const dados = document.createElement('span');
      dados.appendChild(texto('strong', script.name));
      const correspondePagina = interessa(script);
      let situacao = 'Aguardando';
      if (!script.enabled) situacao = 'Desativado no GitHub';
      else if (!marcar.checked) situacao = 'Desativado neste navegador';
      else if (!correspondePagina) situacao = 'Não é para esta URL';
      else if (falhas.has(script.id)) situacao = 'ERRO ao executar: ' + falhas.get(script.id);
      else if (atualizacoesPendentes.has(script.id)) situacao = 'Nova versão: recarregue a página';
      else if (executados.has(script.id)) situacao = 'Código executado • v' + script.version;
      dados.appendChild(texto('small', situacao));
      dados.appendChild(texto('small', explicarExibicao(script), 'central-explicacao'));
      linha.append(marcar, dados);
      painel.appendChild(linha);
    }
    const botoes = document.createElement('div');
    botoes.className = 'central-acoes';
    const atualizar = texto('button', sincronizando ? 'Sincronizando...' : 'Sincronizar agora', 'central-atualizar');
    atualizar.disabled = sincronizando;
    atualizar.addEventListener('click', () => sincronizar());
    const copiar = texto('button', 'Copiar diagnóstico', 'central-atualizar');
    copiar.addEventListener('click', () => {
      const conteudo = gerarDiagnostico();
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(conteudo);
        aviso = 'Diagnóstico copiado. Você pode colá-lo na conversa.';
        atualizarPainel();
      } else {
        aviso = 'A área de transferência está indisponível.';
        atualizarPainel();
      }
    });
    botoes.append(atualizar, copiar);
    painel.appendChild(botoes);
    painel.appendChild(texto('p', 'O status "Código executado" não significa que o módulo criou um botão: ele pode depender de uma tela ou campo específico.', 'central-legenda'));
    ajustarPosicaoPainel();
  }

  GM_addStyle(`
    #central-github-interface { position:fixed; left:16px; top:calc(100vh - 55px); bottom:auto; right:auto;
      z-index:2147483647; width:max-content; height:max-content;
      font:13px/1.5 'Segoe UI',Arial,sans-serif; color:#172033; }
    #central-github-interface * {box-sizing:border-box}
    #central-github-interface .central-github-botao {display:block; border:0;
      padding:10px 14px; border-radius:20px; background:#1c3872;color:white;
      font:600 13px 'Segoe UI',Arial,sans-serif;box-shadow:0 8px 25px #0003;cursor:pointer;
      touch-action:none; user-select:none; -webkit-user-select:none; white-space:nowrap;
      -webkit-user-drag:none; position:relative; pointer-events:auto}
    #central-github-interface .central-github-botao.modo-mover {
      cursor:grabbing; background:#0e7490; box-shadow:0 0 0 3px #22d3ee80,0 8px 25px #0003;
      outline:2px dashed #67e8f9; outline-offset:2px;
    }
    #central-github-interface .central-github-dica-mover {
      position:absolute; left:0; bottom:calc(100% + 8px); z-index:3;
      width:max-content; max-width:min(290px,calc(100vw - 30px));
      padding:7px 10px; border-radius:9px;
      background:#0f172a; color:#fff; font:600 11px/1.4 'Segoe UI',sans-serif;
      pointer-events:none; white-space:normal; box-shadow:0 4px 12px #0003;
    }
    #central-github-interface .central-github-painel {position:absolute; left:0; top:auto; bottom:calc(100% + 8px);
      width:min(420px,calc(100vw - 24px)); max-height:70vh;overflow-y:auto;background:#fff;
      border-radius:14px;margin:0; padding:16px;box-shadow:0 14px 40px #0004;border:1px solid #e1e7f0;}
    #central-github-interface h3 {font:700 16px 'Segoe UI',Arial,sans-serif;margin:0 0 10px}
    #central-github-interface p {margin:6px 0;word-break:break-word}
    #central-github-interface .central-msg {color:#475569}
    #central-github-interface .central-explicacao {color:#2563eb;line-height:1.4;white-space:normal}
    #central-github-interface .central-acoes {display:grid;grid-template-columns:1fr 1fr;gap:7px}
    #central-github-interface .central-acoes .central-atualizar {margin-top:8px;font-size:11px}
    #central-github-interface .central-legenda {color:#64748b;font-size:12px}
    #central-github-interface .central-linha {display:flex;gap:10px;align-items:flex-start;
      border-top:1px solid #e2e8f0;padding:10px 0;cursor:pointer}
    #central-github-interface input {margin-top:4px}
    #central-github-interface .central-linha span {display:flex;flex-direction:column;min-width:0}
    #central-github-interface strong {font-weight:600}
    #central-github-interface small {color:#64748b;margin-top:2px}
    #central-github-interface .central-atualizar {width:100%;border:0;background:#e9effa;
      padding:10px;color:#1e3a8a;border-radius:8px;font-weight:700;cursor:pointer;margin-top:9px}
    #central-github-interface .central-atualizar:disabled {opacity:.5;cursor:default}
  `);

  GM_registerMenuCommand('Central: sincronizar agora', () => sincronizar());
  GM_registerMenuCommand('Central: abrir/fechar painel', () => {
    painelAberto = !painelAberto;
    atualizarPainel(true);
  });

  if (!REPO_VALIDO) {
    aviso = 'Configure o seu usuário GitHub na variável REPOSITORIO.';
    atualizarPainel(true);
  } else {
    sincronizar();
    setInterval(sincronizar, INTERVALO_MS);
    window.addEventListener('popstate', () => sincronizar());
    window.addEventListener('hashchange', () => sincronizar());
  }
})();
