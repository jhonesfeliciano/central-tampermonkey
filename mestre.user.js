// ==UserScript==
// @name         Central GitHub | Script Mestre
// @namespace    central-github-tampermonkey
// @version      1.7.0
// @description  Central V1.7: botão recolhível; ao ocultar, permanece apenas uma seta para mostrar novamente.
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
      'CENTRAL GITHUB V1.7 — DIAGNÓSTICO',
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

  // Aparência da Central. O estado é salvo nas preferências do próprio Tampermonkey.
  // Um botão de seta fica sempre acessível enquanto a Central estiver recolhida.
  const CHAVE_RECOLHIDA = PREFIXO + 'ui:recolhida-v1';
  let recolhida = Boolean(GM_getValue(CHAVE_RECOLHIDA, false));

  function definirRecolhida(valor) {
    recolhida = Boolean(valor);
    GM_setValue(CHAVE_RECOLHIDA, recolhida);
    if (recolhida) painelAberto = false;
    atualizarPainel(true);
  }

  function prepararPainel() {
    if (interfaceUI || !document.body) return;
    const root = document.createElement('div');
    root.id = 'central-github-interface';
    const barra = document.createElement('div');
    barra.className = 'central-github-barra';

    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'central-github-botao';
    abrir.title = 'Abrir ou fechar o painel da Central';
    abrir.setAttribute('aria-label', 'Abrir ou fechar o painel da Central');

    const ocultar = document.createElement('button');
    ocultar.type = 'button';
    ocultar.className = 'central-github-ocultar';
    ocultar.textContent = '‹';
    ocultar.title = 'Ocultar Central e deixar só uma seta';
    ocultar.setAttribute('aria-label', 'Ocultar Central');

    const mostrar = document.createElement('button');
    mostrar.type = 'button';
    mostrar.className = 'central-github-mostrar';
    mostrar.textContent = '›';
    mostrar.title = 'Mostrar Central novamente';
    mostrar.setAttribute('aria-label', 'Mostrar Central novamente');

    const painel = document.createElement('section');
    painel.className = 'central-github-painel';
    painel.setAttribute('aria-label', 'Painel da Central GitHub');

    barra.append(abrir, ocultar);
    root.append(barra, mostrar, painel);
    document.body.appendChild(root);
    interfaceUI = { root, barra, abrir, ocultar, mostrar, painel };

    abrir.addEventListener('click', () => {
      if (recolhida) return;
      painelAberto = !painelAberto;
      atualizarPainel(true);
    });
    ocultar.addEventListener('click', () => definirRecolhida(true));
    mostrar.addEventListener('click', () => definirRecolhida(false));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && painelAberto) {
        painelAberto = false;
        atualizarPainel(true);
      }
    });
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
    const deveMostrar = recolhida || !REPO_VALIDO || relevantes.length > 0 || painelAberto || aviso.startsWith('Erro') || forcar;
    if (!deveMostrar && !interfaceUI) return;
    prepararPainel();
    if (!interfaceUI) return;
    const { root, abrir, painel, barra, mostrar } = interfaceUI;
    root.style.setProperty('display', deveMostrar ? 'block' : 'none', 'important');
    root.style.setProperty('left', recolhida ? '0px' : '16px', 'important');
    barra.style.setProperty('display', recolhida ? 'none' : 'flex', 'important');
    mostrar.style.setProperty('display', recolhida ? 'block' : 'none', 'important');
    const carregados = relevantes.filter(s => executados.has(s.id)).length;
    abrir.textContent = `⚙ Central v1.7 ${carregados}/${relevantes.length}`;
    painel.style.setProperty('display', painelAberto && !recolhida ? 'block' : 'none', 'important');
    if (!painelAberto) return;
    painel.replaceChildren();
    painel.appendChild(texto('h3', 'Central GitHub — Diagnóstico V1.7')); 
    painel.appendChild(texto('p', aviso, 'central-msg'));
    painel.appendChild(texto('p', 'Clique em ‹ para ocultar a Central. Para mostrar novamente, clique na seta › que ficará na borda esquerda da tela.', 'central-legenda'));

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
    // O painel permanece acima do botão, limitado à altura disponível na janela.
  }

  GM_addStyle(`
    #central-github-interface {
      position:fixed!important; left:16px; bottom:16px; top:auto!important; right:auto!important;
      transform:none!important; z-index:2147483647!important; display:block;
      width:max-content; height:auto; max-width:calc(100vw - 16px);
      font:13px/1.5 'Segoe UI',Arial,sans-serif; color:#172033;
      pointer-events:auto;
    }
    #central-github-interface * { box-sizing:border-box; }
    #central-github-interface .central-github-barra { display:flex; align-items:stretch; gap:4px; }
    #central-github-interface .central-github-botao,
    #central-github-interface .central-github-ocultar,
    #central-github-interface .central-github-mostrar {
      color:#fff!important; border:0!important; cursor:pointer!important;
      background:#1c3872!important; box-shadow:0 8px 25px #0003;
      font-family:'Segoe UI',Arial,sans-serif!important; font-weight:700!important;
      touch-action:manipulation; -webkit-user-select:none; user-select:none;
    }
    #central-github-interface .central-github-botao {
      display:block; padding:10px 14px!important; border-radius:20px!important;
      font-size:13px!important; white-space:nowrap!important; min-height:39px;
    }
    #central-github-interface .central-github-ocultar {
      display:block; min-width:32px; min-height:39px; padding:0 8px!important;
      border-radius:14px!important; font-size:25px!important; line-height:1!important;
    }
    #central-github-interface .central-github-mostrar {
      display:none; min-width:32px; min-height:45px; padding:1px 8px!important;
      border-radius:0 15px 15px 0!important; font-size:28px!important; line-height:1!important;
      background:#1c3872!important;
    }
    #central-github-interface .central-github-botao:hover,
    #central-github-interface .central-github-ocultar:hover,
    #central-github-interface .central-github-mostrar:hover { background:#2852a4!important; }
    #central-github-interface .central-github-painel {
      position:absolute!important; bottom:calc(100% + 8px)!important;
      left:0!important; top:auto!important; right:auto!important;
      width:min(420px,calc(100vw - 32px))!important;
      max-height:calc(100vh - 90px)!important; overflow-y:auto!important;
      background:#fff!important; border-radius:14px!important; margin:0!important;
      padding:16px!important; box-shadow:0 14px 40px #0004!important;
      border:1px solid #e1e7f0!important;
      color:#172033!important;
    }
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
    @media(max-width:480px) {
      #central-github-interface { bottom:10px!important; }
      #central-github-interface .central-github-painel {max-height:calc(100vh - 75px)!important;}
    }
  `);

  GM_registerMenuCommand('Central: sincronizar agora', () => sincronizar());
  GM_registerMenuCommand('Central: abrir/fechar painel', () => {
    if (recolhida) definirRecolhida(false);
    painelAberto = !painelAberto;
    atualizarPainel(true);
  });
  GM_registerMenuCommand('Central: ocultar/mostrar botão', () => definirRecolhida(!recolhida));

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
