// ==UserScript==
// @name         Central GitHub | Script Mestre
// @namespace    central-github-tampermonkey
// @version      1.0.0
// @description  Um único script no Tampermonkey. Lê catálogo do GitHub e carrega automaticamente os módulos por site.
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
  const REPOSITORIO = 'SEU_USUARIO/central-tampermonkey';

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

  function prepararPainel() {
    if (interfaceUI || !document.body) return;
    const root = document.createElement('div');
    root.id = 'central-github-interface';
    const abrir = document.createElement('button');
    abrir.className = 'central-github-botao';
    const painel = document.createElement('section');
    painel.className = 'central-github-painel';
    abrir.addEventListener('click', () => {
      painelAberto = !painelAberto;
      atualizarPainel(true);
    });
    root.append(abrir, painel);
    document.body.appendChild(root);
    interfaceUI = { root, abrir, painel };
  }

  function texto(tag, conteudo, classe = '') {
    const element = document.createElement(tag);
    element.textContent = conteudo;
    if (classe) element.className = classe;
    return element;
  }

  function atualizarPainel(forcar = false) {
    if (!document.body) return;
    const relevantes = catalogo ? catalogo.scripts.filter(interessa) : [];
    const deveMostrar = !REPO_VALIDO || relevantes.length > 0 || painelAberto || aviso.startsWith('Erro') || forcar;
    if (!deveMostrar && !interfaceUI) return;
    prepararPainel();
    if (!interfaceUI) return;
    const { root, abrir, painel } = interfaceUI;
    root.style.display = deveMostrar ? '' : 'none';
    const qtd = relevantes.filter(s => executados.has(s.id)).length;
    abrir.textContent = `⚙ Central ${qtd}/${relevantes.length}`;
    painel.style.display = painelAberto ? 'block' : 'none';
    if (!painelAberto) return;
    painel.replaceChildren();
    painel.appendChild(texto('h3', 'Central de Scripts — GitHub'));
    painel.appendChild(texto('p', aviso, 'central-msg'));
    if (ultimaSincronizacao) {
      painel.appendChild(texto('p', 'Última consulta: ' + ultimaSincronizacao.toLocaleTimeString('pt-BR'), 'central-legenda'));
    }
    if (!REPO_VALIDO) {
      painel.appendChild(texto('p', 'Edite a constante REPOSITORIO no Tampermonkey para USUÁRIO/central-tampermonkey.'));
    }
    if (relevantes.length === 0 && REPO_VALIDO) {
      painel.appendChild(texto('p', 'Nenhum script configurado para este endereço.', 'central-legenda'));
    }
    for (const script of relevantes) {
      const linha = document.createElement('label');
      linha.className = 'central-linha';
      const marcar = document.createElement('input');
      marcar.type = 'checkbox';
      marcar.checked = script.enabled && !GM_getValue(PREFIXO + 'desligado:' + script.id, false);
      marcar.disabled = !script.enabled;
      marcar.addEventListener('change', () => {
        GM_setValue(PREFIXO + 'desligado:' + script.id, !marcar.checked);
        aviso = marcar.checked ? 'Ativado. Sincronizando...' : 'Desativado. Recarregue a página para parar a execução atual.';
        atualizarPainel();
        if (marcar.checked) sincronizar();
      });
      const dados = document.createElement('span');
      dados.appendChild(texto('strong', script.name));
      let situacao = 'Aguardando';
      if (!script.enabled) situacao = 'Desativado no GitHub';
      else if (!marcar.checked) situacao = 'Desativado neste navegador';
      else if (falhas.has(script.id)) situacao = 'Erro: ' + falhas.get(script.id);
      else if (atualizacoesPendentes.has(script.id)) situacao = 'Nova versão: recarregue a página';
      else if (executados.has(script.id)) situacao = 'Rodando • v' + script.version;
      dados.appendChild(texto('small', situacao));
      linha.append(marcar, dados);
      painel.appendChild(linha);
    }
    const atualizar = texto('button', sincronizando ? 'Sincronizando...' : 'Sincronizar agora', 'central-atualizar');
    atualizar.disabled = sincronizando;
    atualizar.addEventListener('click', () => sincronizar());
    painel.appendChild(atualizar);
  }

  GM_addStyle(`
    #central-github-interface { position:fixed; right:16px; bottom:16px; z-index:2147483647;
      font:13px/1.5 'Segoe UI',Arial,sans-serif; color:#172033; }
    #central-github-interface * {box-sizing:border-box}
    #central-github-interface .central-github-botao {display:block;margin-left:auto; border:0;
      padding:10px 14px; border-radius:20px; background:#1c3872;color:white;
      font:600 13px 'Segoe UI',Arial,sans-serif;box-shadow:0 8px 25px #0003;cursor:pointer}
    #central-github-interface .central-github-painel { width:min(355px,calc(100vw - 24px));
      max-height:70vh;overflow-y:auto;background:#fff;border-radius:14px;margin-bottom:8px;
      padding:16px;box-shadow:0 14px 40px #0004;border:1px solid #e1e7f0;}
    #central-github-interface h3 {font:700 16px 'Segoe UI',Arial,sans-serif;margin:0 0 10px}
    #central-github-interface p {margin:6px 0;word-break:break-word}
    #central-github-interface .central-msg {color:#475569}
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
