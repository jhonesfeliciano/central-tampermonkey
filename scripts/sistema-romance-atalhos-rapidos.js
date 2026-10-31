// @central-id sistema-romance-atalhos-rapidos
// @central-name Sistema Romance - Atalhos Rápidos
// @central-version 1.2.0
// @central-match https://*/*
// @central-match http://*/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(() => {
    'use strict';

    const CONFIG = Object.freeze({
        appId: '2001',
        homePageId: '1',
        hostId: 'lm-apex-atalhos-host',
        storageKey: 'lm-apex-atalhos-aberto-v1'
    });

    const ATALHOS = Object.freeze([
        { numero: 1, nome: 'Notas de Venda',          pagina: '36'  },
        { numero: 2, nome: 'Receb. Compras',          pagina: '22'  },
        { numero: 3, nome: 'Acertos Pend.',           pagina: '183' },
        { numero: 4, nome: 'Acertos',                 pagina: '74'  },
        { numero: 5, nome: 'Fechamentos',             pagina: '91'  },
        { numero: 6, nome: 'Lista de Clientes',       pagina: '158' },
        { numero: 7, nome: 'Notas Perdidas',          pagina: '297' },
        { numero: 8, nome: 'Ligações p/ Depósitos',   pagina: '232' },
        { numero: 9, nome: 'Despesas',                pagina: '81'  },
        { numero: 10, nome: 'Requisições Pagamentos', pagina: '675' },
        { numero: 11, nome: 'Pessoas',                pagina: '7'   }
    ]);

    // Evita duplicação caso o sistema carregue conteúdo em iframe.
    if (window.top !== window.self) return;

    function valorDoElemento(id) {
        const elemento = document.getElementById(id);
        return elemento ? String(elemento.value || '').trim() : '';
    }

    function lerParametroApex() {
        try {
            const parametro = new URL(window.location.href).searchParams.get('p');
            return parametro ? parametro.split(':') : [];
        } catch {
            return [];
        }
    }

    function obterAppId() {
        return valorDoElemento('pFlowId')
            || lerParametroApex()[0]
            || '';
    }

    function obterPaginaAtual() {
        const peloInput = valorDoElemento('pFlowStepId');
        if (peloInput) return peloInput;

        const partes = lerParametroApex();
        if (partes[1]) return partes[1];

        const classe = document.documentElement.className || '';
        const encontrado = classe.match(/(?:^|\s)page-(\d+)(?:\s|$)/i);
        return encontrado ? encontrado[1] : '';
    }

    function obterSessaoAtual() {
        const peloInput = valorDoElemento('pInstance');
        if (peloInput) return peloInput;

        const contexto = valorDoElemento('pContext');
        if (contexto) {
            const partes = contexto.split(':');
            if (partes[2]) return partes[2];
        }

        const partesUrl = lerParametroApex();
        if (partesUrl[2]) return partesUrl[2];

        // Último recurso: aproveita a sessão de qualquer link APEX já renderizado.
        const links = document.querySelectorAll('a[href*="f?p=2001:"]');
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const encontrado = href.match(/f\?p=2001:\d+:([^:&#]+)/i);
            if (encontrado && encontrado[1]) return encontrado[1];
        }

        return '';
    }

    function estaNaPaginaInicial() {
        return obterAppId() === CONFIG.appId
            && obterPaginaAtual() === CONFIG.homePageId;
    }

    function criarUrlDestino(pagina) {
        const sessao = obterSessaoAtual();

        if (!sessao) {
            throw new Error('Não foi possível identificar a sessão atual do sistema.');
        }

        // Mesmo padrão de navegação usado pelos links do próprio Oracle APEX.
        return `f?p=${CONFIG.appId}:${pagina}:${sessao}::NO:::`;
    }

    function lerEstadoSalvo() {
        try {
            return window.localStorage.getItem(CONFIG.storageKey) === '1';
        } catch {
            return false;
        }
    }

    function salvarEstado(aberto) {
        try {
            window.localStorage.setItem(CONFIG.storageKey, aberto ? '1' : '0');
        } catch {
            // O painel continua funcionando mesmo se o navegador bloquear o armazenamento.
        }
    }

    function criarPainel() {
        if (!estaNaPaginaInicial()) return;
        if (document.getElementById(CONFIG.hostId)) return;

        const host = document.createElement('div');
        host.id = CONFIG.hostId;
        host.setAttribute('data-lm-atalhos', 'true');
        document.body.appendChild(host);

        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host {
                all: initial;
            }

            *, *::before, *::after {
                box-sizing: border-box;
            }

            .camada {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                pointer-events: none;
                font-family: "Oracle Sans", "Segoe UI", Arial, sans-serif;
            }

            .painel {
                position: fixed;
                right: 16px;
                bottom: 72px;
                width: min(286px, calc(100vw - 32px));
                max-height: calc(100vh - 96px);
                padding: 14px;
                border: 1px solid rgba(15, 23, 42, 0.12);
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.98);
                box-shadow:
                    0 22px 55px rgba(15, 23, 42, 0.22),
                    0 4px 14px rgba(15, 23, 42, 0.10);
                backdrop-filter: blur(10px);
                overflow: auto;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transform: translateX(calc(100% + 28px)) scale(0.98);
                transform-origin: right bottom;
                transition:
                    transform 180ms ease,
                    opacity 160ms ease,
                    visibility 180ms ease;
            }

            .painel.aberto {
                opacity: 1;
                visibility: visible;
                pointer-events: auto;
                transform: translateX(0) scale(1);
            }

            .cabecalho {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 10px;
                padding: 2px 2px 10px;
                border-bottom: 1px solid #e5e7eb;
            }

            .titulo-area {
                min-width: 0;
            }

            .titulo {
                margin: 0;
                color: #0f172a;
                font-size: 15px;
                font-weight: 800;
                line-height: 1.25;
                letter-spacing: -0.01em;
            }

            .subtitulo {
                margin: 3px 0 0;
                color: #64748b;
                font-size: 11px;
                line-height: 1.3;
            }

            .botoes-acao {
                display: flex;
                gap: 6px;
                flex: 0 0 auto;
            }

            .btn-acao {
                display: grid;
                place-items: center;
                width: 30px;
                height: 30px;
                border: 0;
                border-radius: 9px;
                background: #f1f5f9;
                color: #475569;
                cursor: pointer;
                font-size: 19px;
                line-height: 1;
                pointer-events: auto;
                text-decoration: none;
                transition: background 140ms ease, color 140ms ease, transform 140ms ease;
            }

            .btn-acao:hover {
                background: #e2e8f0;
                color: #0f172a;
                transform: scale(1.04);
            }

            .btn-acao.icone-pequeno {
                font-size: 14px;
            }

            .lista {
                display: grid;
                gap: 7px;
            }

            .atalho {
                display: grid;
                grid-template-columns: 32px minmax(0, 1fr) 18px;
                align-items: center;
                gap: 10px;
                width: 100%;
                min-height: 44px;
                padding: 7px 10px 7px 7px;
                border: 1px solid #e2e8f0;
                border-radius: 11px;
                background: #ffffff;
                color: #1e293b;
                text-decoration: none;
                cursor: pointer;
                pointer-events: auto;
                transition:
                    border-color 140ms ease,
                    background 140ms ease,
                    box-shadow 140ms ease,
                    transform 140ms ease;
            }

            .atalho:hover {
                border-color: #2563eb;
                background: #eff6ff;
                box-shadow: 0 5px 13px rgba(37, 99, 235, 0.12);
                transform: translateX(-2px);
            }

            .atalho:focus-visible,
            .btn-acao:focus-visible,
            .alternador:focus-visible {
                outline: 3px solid rgba(37, 99, 235, 0.30);
                outline-offset: 2px;
            }

            .numero {
                display: grid;
                place-items: center;
                width: 32px;
                height: 32px;
                border-radius: 9px;
                background: linear-gradient(145deg, #1d4ed8, #2563eb);
                color: #ffffff;
                font-size: 12px;
                font-weight: 800;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
            }

            .nome {
                min-width: 0;
                overflow: hidden;
                color: #1e293b;
                font-size: 13px;
                font-weight: 700;
                line-height: 1.25;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .seta {
                color: #94a3b8;
                font-size: 18px;
                font-weight: 700;
                text-align: right;
                transition: color 140ms ease, transform 140ms ease;
            }

            .atalho:hover .seta {
                color: #2563eb;
                transform: translateX(2px);
            }

            .alternador {
                position: fixed;
                right: 18px;
                bottom: 20px;
                display: grid;
                place-items: center;
                width: 38px;
                height: 38px;
                padding: 0;
                border: 1px solid rgba(255, 255, 255, 0.55);
                border-radius: 999px;
                background: #1d4ed8;
                box-shadow:
                    0 8px 20px rgba(15, 23, 42, 0.26),
                    inset 0 1px 0 rgba(255, 255, 255, 0.22);
                cursor: pointer;
                pointer-events: auto;
                transition: transform 150ms ease, background 150ms ease, box-shadow 150ms ease;
            }

            .alternador:hover {
                background: #1e40af;
                transform: scale(1.08);
                box-shadow:
                    0 10px 24px rgba(15, 23, 42, 0.30),
                    inset 0 1px 0 rgba(255, 255, 255, 0.22);
            }

            .alternador[aria-expanded="true"] {
                background: #0f172a;
            }

            .ponto {
                width: 9px;
                height: 9px;
                border-radius: 999px;
                background: #ffffff;
                box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
            }

            .rodape {
                margin: 10px 2px 0;
                color: #94a3b8;
                font-size: 10px;
                line-height: 1.3;
                text-align: center;
            }

            @media (max-width: 520px) {
                .painel {
                    right: 10px;
                    bottom: 68px;
                    width: calc(100vw - 20px);
                    max-height: calc(100vh - 88px);
                }

                .alternador {
                    right: 12px;
                    bottom: 14px;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .painel,
                .atalho,
                .alternador,
                .btn-acao,
                .seta {
                    transition: none !important;
                }
            }
        `;

        const camada = document.createElement('div');
        camada.className = 'camada';

        const painel = document.createElement('aside');
        painel.className = 'painel';
        painel.id = 'lm-atalhos-painel';
        painel.setAttribute('aria-label', 'Atalhos rápidos do sistema');

        const cabecalho = document.createElement('div');
        cabecalho.className = 'cabecalho';

        const tituloArea = document.createElement('div');
        tituloArea.className = 'titulo-area';

        const titulo = document.createElement('h2');
        titulo.className = 'titulo';
        titulo.textContent = 'Atalhos rápidos';

        const subtitulo = document.createElement('p');
        subtitulo.className = 'subtitulo';
        subtitulo.textContent = 'Acesso direto às páginas mais usadas';

        tituloArea.append(titulo, subtitulo);

        const botoesAcao = document.createElement('div');
        botoesAcao.className = 'botoes-acao';

        const abrirInicio = document.createElement('a');
        abrirInicio.className = 'btn-acao icone-pequeno';
        abrirInicio.href = '#';
        abrirInicio.target = '_blank';
        abrirInicio.title = 'Abrir Início em nova aba';
        abrirInicio.setAttribute('aria-label', 'Abrir Início em nova aba');
        abrirInicio.innerHTML = '&#8599;'; // Ícone de seta ↗

        abrirInicio.addEventListener('pointerenter', () => {
            try {
                abrirInicio.href = criarUrlDestino(CONFIG.homePageId);
            } catch (e) {}
        });

        const fechar = document.createElement('button');
        fechar.className = 'btn-acao';
        fechar.type = 'button';
        fechar.setAttribute('aria-label', 'Ocultar atalhos');
        fechar.title = 'Ocultar atalhos';
        fechar.textContent = '×';

        botoesAcao.append(abrirInicio, fechar);
        cabecalho.append(tituloArea, botoesAcao);

        const lista = document.createElement('nav');
        lista.className = 'lista';
        lista.setAttribute('aria-label', 'Lista de atalhos');

        for (const item of ATALHOS) {
            const link = document.createElement('a');
            link.className = 'atalho';
            link.href = criarUrlDestino(item.pagina);
            link.title = `Abrir ${item.nome}`;
            link.setAttribute('data-pagina', item.pagina);

            const numero = document.createElement('span');
            numero.className = 'numero';
            numero.textContent = String(item.numero);

            const nome = document.createElement('span');
            nome.className = 'nome';
            nome.textContent = item.nome;

            const seta = document.createElement('span');
            seta.className = 'seta';
            seta.setAttribute('aria-hidden', 'true');
            seta.textContent = '›';

            link.append(numero, nome, seta);
            lista.appendChild(link);
        }

        const rodape = document.createElement('div');
        rodape.className = 'rodape';
        rodape.textContent = 'O acesso usa automaticamente a sessão atual.';

        painel.append(cabecalho, lista, rodape);

        const alternador = document.createElement('button');
        alternador.className = 'alternador';
        alternador.type = 'button';
        alternador.setAttribute('aria-controls', painel.id);
        alternador.setAttribute('aria-label', 'Mostrar atalhos rápidos');
        alternador.setAttribute('aria-expanded', 'false');
        alternador.title = 'Mostrar atalhos rápidos';

        const ponto = document.createElement('span');
        ponto.className = 'ponto';
        ponto.setAttribute('aria-hidden', 'true');
        alternador.appendChild(ponto);

        camada.append(painel, alternador);
        shadow.append(style, camada);

        let aberto = lerEstadoSalvo();

        function atualizarPainel(novoEstado, salvar = true) {
            aberto = Boolean(novoEstado);
            painel.classList.toggle('aberto', aberto);
            alternador.setAttribute('aria-expanded', String(aberto));
            alternador.setAttribute(
                'aria-label',
                aberto ? 'Ocultar atalhos rápidos' : 'Mostrar atalhos rápidos'
            );
            alternador.title = aberto ? 'Ocultar atalhos rápidos' : 'Mostrar atalhos rápidos';

            if (salvar) salvarEstado(aberto);
        }

        alternador.addEventListener('click', () => atualizarPainel(!aberto));
        fechar.addEventListener('click', () => atualizarPainel(false));

        document.addEventListener('keydown', evento => {
            if (evento.key === 'Escape' && aberto) atualizarPainel(false);
        });

        // Atualiza os links imediatamente antes do uso, caso a sessão seja renovada.
        lista.addEventListener('pointerdown', evento => {
            const link = evento.target.closest?.('.atalho');
            if (!link) return;

            try {
                link.href = criarUrlDestino(link.getAttribute('data-pagina'));
            } catch (erro) {
                evento.preventDefault();
                window.alert(erro.message);
            }
        });

        atualizarPainel(aberto, false);
    }

    function adicionarNomeVermelho() {
        if (document.getElementById('lm-optimus-red')) return;

        const containerLogo = document.querySelector('.t-Header-logo');
        const linkOriginal = document.querySelector('.t-Header-logo-link');
        const imgOriginal = document.querySelector('.t-Header-logo-link img');

        if (!containerLogo || !imgOriginal) return;

        const linkNovo = document.createElement('a');
        linkNovo.id = 'lm-optimus-red';
        linkNovo.target = '_blank';
        linkNovo.title = 'Abrir Início em nova aba';
        linkNovo.style.cssText = `
            margin-left: 10px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
        `;

        // Clona a imagem original exatamente como ela é
        const imgNova = imgOriginal.cloneNode(true);
        imgNova.id = 'lm-optimus-img-red';

        // Captura a altura exata da original para evitar que a clonada fique maior
        const alturaOriginal = imgOriginal.clientHeight || 32;

        // Usa Filtro CSS para converter os tons escuros/pretos da imagem clonada para vermelho
        imgNova.style.cssText = `
            filter: invert(24%) sepia(90%) saturate(3195%) hue-rotate(349deg) brightness(93%) contrast(94%) !important;
            display: block !important;
            height: ${alturaOriginal}px !important;
            width: auto !important;
            max-height: 100% !important;
        `;

        linkNovo.appendChild(imgNova);

        linkNovo.addEventListener('pointerenter', () => {
            try {
                linkNovo.href = criarUrlDestino(CONFIG.homePageId);
            } catch (e) {}
        });

        // Força o contêiner do Oracle APEX a manter as duas logos alinhadas na mesma linha
        containerLogo.style.setProperty('display', 'flex', 'important');
        containerLogo.style.setProperty('align-items', 'center', 'important');
        containerLogo.style.setProperty('height', '100%', 'important');

        if (linkOriginal) {
            linkOriginal.insertAdjacentElement('afterend', linkNovo);
        } else {
            containerLogo.appendChild(linkNovo);
        }
    }

    function iniciar() {
        adicionarNomeVermelho(); // Injeta no cabeçalho em todas as páginas

        if (estaNaPaginaInicial()) {
            try {
                criarPainel();
            } catch (erro) {
                console.error('[Atalhos rápidos] Não foi possível criar o painel:', erro);
            }
            return;
        }

        // Dá tempo para o Oracle APEX terminar de preencher os campos ocultos.
        let tentativas = 0;
        const timer = window.setInterval(() => {
            tentativas += 1;

            if (estaNaPaginaInicial()) {
                window.clearInterval(timer);
                criarPainel();
            } else if (tentativas >= 30) {
                window.clearInterval(timer);
            }
        }, 500);
    }

    iniciar();
})();
