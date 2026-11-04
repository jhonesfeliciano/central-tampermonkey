// @central-id romance-copiar-cliente-codigo-antecipacao
// @central-name Romance | Copiar Cliente e Código + Automatizar Antecipação
// @central-version 3.5.0
// @central-match https://sistema.romancemoda.com.br/apex/*
// @central-enabled true

// Central GitHub: módulo da versão original 3.4, preservando o fluxo.
// Ação "Automatizar" só inicia após clique explícito na página da nota.
// O fechamento de guia requer o Mestre V1.9 ou superior.

(function () {
    'use strict';

    const IDS = {
        codigoDisplay: 'P37_COD_LIBERACAO_DISPLAY',
        codigoHidden: 'P37_COD_LIBERACAO',
        clienteDisplay: 'P37_IDVENDEDORA_DISPLAY',
        idNota: 'P37_IDNOTAVENDA'
    };

    const AUTOMACAO_KEY = 'tm_romance_adiantar_e_copiar_v1';
    const AUTOMACAO_VALIDADE_MS = 2 * 60 * 1000; // 2 minutos
    const SCROLL_CONSULTA_KEY = 'tm_romance_scroll_top_consulta_doc_v1';
    const SCROLL_CONSULTA_VALIDADE_MS = 30 * 1000; // 30 segundos

    // Muda a cada carregamento REAL da página. Isso impede que a etapa final
    // seja disparada ainda na página antiga antes do reload acontecer.
    const PAGE_TOKEN = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    let processamentoPosReloadAgendado = false;

    function copiarTexto(texto) {
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(texto);
            return Promise.resolve();
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(texto);
        }

        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();

        return Promise.resolve();
    }

    function obterCodigo() {
        const hidden = document.getElementById(IDS.codigoHidden);
        if (hidden && String(hidden.value || '').trim()) {
            return String(hidden.value).trim();
        }

        const display = document.getElementById(IDS.codigoDisplay);
        if (!display) return '';

        const copia = display.cloneNode(true);
        copia.querySelectorAll('button').forEach(btn => btn.remove());
        return copia.textContent.trim();
    }

    function obterNomeCliente() {
        const display = document.getElementById(IDS.clienteDisplay);
        if (!display) return '';

        const copia = display.cloneNode(true);
        copia.querySelectorAll('button').forEach(btn => btn.remove());

        const textoCompleto = copia.textContent.replace(/\s+/g, ' ').trim();

        return textoCompleto
            .replace(/\s*\(\s*ID\s*:\s*[^)]+\)\s*$/i, '')
            .trim();
    }

    function obterIdNota() {
        const campo = document.getElementById(IDS.idNota);
        return campo ? String(campo.value || '').trim() : '';
    }

    function normalizarTexto(texto) {
        return String(texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function aplicarEstiloBotaoPequeno(btn) {
        btn.style.marginLeft = '6px';
        btn.style.padding = '1px 6px';
        btn.style.cursor = 'pointer';
        btn.style.border = '1px solid #999';
        btn.style.borderRadius = '4px';
        btn.style.background = '#f5f5f5';
        btn.style.fontSize = '12px';
        btn.style.verticalAlign = 'middle';
        btn.style.lineHeight = '1.4';
    }

    function mostrarConfirmacao(btn, textoOriginal) {
        if (!btn) return;

        btn.disabled = true;
        btn.textContent = '✔ Copiado!';

        setTimeout(() => {
            btn.textContent = textoOriginal;
            btn.disabled = false;
        }, 1800);
    }

    function mostrarCheckVisual(mensagem = 'Cliente + Código copiados!') {
        const anterior = document.getElementById('tmCheckCopiaAutomatica');
        if (anterior) anterior.remove();

        const aviso = document.createElement('div');
        aviso.id = 'tmCheckCopiaAutomatica';
        aviso.setAttribute('role', 'status');
        aviso.setAttribute('aria-live', 'polite');

        aviso.innerHTML = `
            <div style="
                width:56px;height:56px;border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                background:#22c55e;color:#fff;font-size:34px;font-weight:900;
                box-shadow:0 4px 18px rgba(0,0,0,.25);
                margin:0 auto 8px auto;
            ">✓</div>
            <div style="font-size:14px;font-weight:700;color:#111;">${mensagem}</div>
        `;

        aviso.style.position = 'fixed';
        aviso.style.top = '22px';
        aviso.style.left = '50%';
        aviso.style.transform = 'translateX(-50%)';
        aviso.style.zIndex = '2147483647';
        aviso.style.background = '#ffffff';
        aviso.style.border = '2px solid #22c55e';
        aviso.style.borderRadius = '14px';
        aviso.style.padding = '12px 18px';
        aviso.style.textAlign = 'center';
        aviso.style.boxShadow = '0 8px 28px rgba(0,0,0,.28)';
        aviso.style.minWidth = '220px';
        aviso.style.pointerEvents = 'none';

        document.body.appendChild(aviso);

        setTimeout(() => {
            aviso.style.transition = 'opacity .25s ease, transform .25s ease';
            aviso.style.opacity = '0';
            aviso.style.transform = 'translateX(-50%) translateY(-8px)';

            setTimeout(() => aviso.remove(), 300);
        }, 1800);
    }

    function ehPaginaConsultaDoc() {
        // A página "Consulta Doc." encontrada no sistema é a página 280.
        const passo = document.getElementById('pFlowStepId');
        if (passo && String(passo.value || '').trim() === '280') {
            return true;
        }

        const url = String(window.location.href || '');
        if (/f\?p=2001:280(?::|&|$)/i.test(url)) {
            return true;
        }

        // Fallback para eventuais variações da URL do Oracle APEX.
        const titulo = normalizarTexto(document.title);
        return titulo.includes('consulta doc');
    }

    function sinalizarRolagemConsultaDoc() {
        try {
            const sinal = {
                criadoEm: Date.now(),
                origem: PAGE_TOKEN
            };
            localStorage.setItem(SCROLL_CONSULTA_KEY, JSON.stringify(sinal));
        } catch (e) {
            // Se o navegador bloquear localStorage, o restante da automação continua normal.
        }
    }

    function executarRolagemParaTopoConsultaDoc() {
        if (!ehPaginaConsultaDoc()) return false;

        // A rolagem é feita mais de uma vez para vencer restaurações de posição
        // do navegador ou ajustes de layout que ocorram logo após a guia receber foco.
        const rolar = () => {
            try {
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            } catch (e) {
                window.scrollTo(0, 0);
            }

            try {
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            } catch (e) {
                // Ignora navegadores que não permitam uma dessas propriedades.
            }
        };

        rolar();
        requestAnimationFrame(rolar);
        setTimeout(rolar, 120);
        setTimeout(rolar, 400);
        setTimeout(rolar, 900);
        return true;
    }

    function verificarRolagemPendenteConsultaDoc() {
        if (!ehPaginaConsultaDoc()) return;

        // Só consome o sinal quando a guia de Consulta Doc. estiver realmente
        // voltando para frente após o fechamento da guia automatizada.
        if (document.visibilityState !== 'visible' && !document.hasFocus()) {
            return;
        }

        let bruto = null;
        try {
            bruto = localStorage.getItem(SCROLL_CONSULTA_KEY);
        } catch (e) {
            return;
        }

        if (!bruto) return;

        try {
            const sinal = JSON.parse(bruto);
            const criadoEm = Number(sinal && sinal.criadoEm);

            if (!criadoEm || (Date.now() - criadoEm) > SCROLL_CONSULTA_VALIDADE_MS) {
                localStorage.removeItem(SCROLL_CONSULTA_KEY);
                return;
            }

            if (executarRolagemParaTopoConsultaDoc()) {
                localStorage.removeItem(SCROLL_CONSULTA_KEY);
            }
        } catch (e) {
            try {
                localStorage.removeItem(SCROLL_CONSULTA_KEY);
            } catch (_) {
                // Nada a fazer.
            }
        }
    }

    function prepararRetornoParaConsultaDoc() {
        // Marca para TODAS as guias da mesma origem que, ao a guia de Consulta Doc.
        // voltar a ficar ativa, ela deve ir para o topo.
        sinalizarRolagemConsultaDoc();
    }

    function fecharGuiaAtual() {
        // CENTRAL V1.9: chama apenas a permissão delegada pelo Mestre,
        // que verifica se estamos na página de uma Nota (37) antes de fechar.
        try {
            if (typeof CENTRAL_fecharGuiaAtual === 'function' && CENTRAL_fecharGuiaAtual()) {
                return true;
            }
        } catch (erro) {
            console.warn('[Romance Copiar/Antecipar] Falha ao fechar pela Central:', erro);
        }

        // Contingência: em algumas guias abertas pelo navegador, window.close() funciona.
        // Sem @grant window.close no Mestre, o Chrome pode ignorar o fechamento.
        try {
            window.close();
        } catch (erro) {
            console.warn('[Romance Copiar/Antecipar] Fechamento bloqueado:', erro);
        }
        console.warn('[Romance Copiar/Antecipar] Se a guia permanecer aberta, publique o Mestre V1.9.');
        return false;
    }

    async function copiarClienteECodigo(mostrarFeedbackGrande = false) {
        const nome = obterNomeCliente();
        const codigoAtual = obterCodigo();

        if (!nome || !codigoAtual) {
            return false;
        }

        const texto = nome + '\n' + 'Cod Para Liberação Tablet ' + codigoAtual;
        await copiarTexto(texto);

        const btn = document.getElementById('btnCopiarClienteECodigo');
        mostrarConfirmacao(btn, '📋 Copiar Cliente + Código');

        if (mostrarFeedbackGrande) {
            mostrarCheckVisual('Cliente + Código copiados!');
        }

        return true;
    }

    function adicionarBotaoCodigo() {
        const span = document.getElementById(IDS.codigoDisplay);
        const hidden = document.getElementById(IDS.codigoHidden);

        if (!span || !hidden || document.getElementById('btnCopiarLiberacao')) {
            return;
        }

        const codigo = obterCodigo();
        if (!codigo) return;

        span.textContent = codigo + ' ';

        const btn = document.createElement('button');
        btn.id = 'btnCopiarLiberacao';
        btn.type = 'button';
        btn.textContent = '📋';
        btn.title = 'Copiar código de liberação';
        btn.setAttribute('aria-label', 'Copiar código de liberação');
        aplicarEstiloBotaoPequeno(btn);

        btn.addEventListener('click', async function (event) {
            event.preventDefault();
            event.stopPropagation();

            const codigoAtual = obterCodigo();
            if (!codigoAtual) return;

            await copiarTexto('Cod Para Liberação Tablet ' + codigoAtual);
            mostrarConfirmacao(btn, '📋');
        });

        span.appendChild(btn);
    }

    function adicionarBotaoCliente() {
        const span = document.getElementById(IDS.clienteDisplay);

        if (!span || document.getElementById('btnCopiarCliente')) {
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'btnCopiarCliente';
        btn.type = 'button';
        btn.textContent = '📋';
        btn.title = 'Copiar somente o nome do cliente';
        btn.setAttribute('aria-label', 'Copiar somente o nome do cliente');
        aplicarEstiloBotaoPequeno(btn);

        btn.addEventListener('click', async function (event) {
            event.preventDefault();
            event.stopPropagation();

            const nome = obterNomeCliente();
            if (!nome) return;

            await copiarTexto(nome);
            mostrarConfirmacao(btn, '📋');
        });

        span.appendChild(btn);
    }

    function adicionarBotaoClienteECodigo() {
        if (document.getElementById('btnCopiarClienteECodigo')) {
            return;
        }

        const cliente = document.getElementById(IDS.clienteDisplay);
        const codigo = document.getElementById(IDS.codigoHidden);

        if (!cliente || !codigo) return;

        const btn = document.createElement('button');
        btn.id = 'btnCopiarClienteECodigo';
        btn.type = 'button';
        btn.textContent = '📋 Copiar Cliente + Código';
        btn.title = 'Copiar cliente e código juntos';
        btn.setAttribute('aria-label', 'Copiar cliente e código juntos');

        btn.style.padding = '7px 14px';
        btn.style.cursor = 'pointer';
        btn.style.border = '1px solid #7aa874';
        btn.style.borderRadius = '7px';
        btn.style.background = '#d8f7d3';
        btn.style.color = '#111';
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '600';
        btn.style.boxShadow = '0 2px 7px rgba(0,0,0,.18)';
        btn.style.whiteSpace = 'nowrap';
        btn.style.verticalAlign = 'middle';

        btn.addEventListener('click', async function (event) {
            event.preventDefault();
            event.stopPropagation();
            await copiarClienteECodigo(false);
        });

        const btnVoltar = document.getElementById('B13078284737442334') ||
            document.querySelector('button[data-otel-label="CANCEL"]');

        const btnConcluir = document.getElementById('B266007475039503680') ||
            document.querySelector('button[data-otel-label="Concluir"]');

        const tdVoltar = btnVoltar ? btnVoltar.closest('td') : null;
        const tdConcluir = btnConcluir ? btnConcluir.closest('td') : null;
        const linhaAcoes = tdVoltar && tdConcluir && tdVoltar.parentElement === tdConcluir.parentElement
            ? tdVoltar.parentElement
            : null;

        if (!linhaAcoes) return;

        tdVoltar.style.width = '33.333%';
        tdVoltar.style.textAlign = 'left';

        tdConcluir.style.width = '33.333%';
        tdConcluir.style.textAlign = 'right';

        let tdCentro = document.getElementById('tdCopiarClienteECodigo');

        if (!tdCentro) {
            tdCentro = document.createElement('td');
            tdCentro.id = 'tdCopiarClienteECodigo';
            tdCentro.style.width = '33.333%';
            tdCentro.style.textAlign = 'center';
            tdCentro.style.verticalAlign = 'middle';
            tdCentro.style.whiteSpace = 'nowrap';
            linhaAcoes.insertBefore(tdCentro, tdConcluir);
        }

        let grupo = document.getElementById('grupoCopiarAutomatizar');
        if (!grupo) {
            grupo = document.createElement('div');
            grupo.id = 'grupoCopiarAutomatizar';
            grupo.style.display = 'inline-flex';
            grupo.style.alignItems = 'center';
            grupo.style.justifyContent = 'center';
            grupo.style.gap = '8px';
            grupo.style.flexWrap = 'wrap';
            tdCentro.appendChild(grupo);
        }

        grupo.appendChild(btn);
    }

    function localizarBotaoAdiantarCobranca() {
        const candidatos = document.querySelectorAll(
            'button, a, input[type="button"], input[type="submit"]'
        );

        for (const elemento of candidatos) {
            let texto = '';

            if (elemento.tagName === 'INPUT') {
                texto += ' ' + (elemento.value || '');
            } else {
                texto += ' ' + (elemento.textContent || '');
            }

            texto += ' ' + (elemento.getAttribute('aria-label') || '');
            texto += ' ' + (elemento.getAttribute('title') || '');
            texto += ' ' + (elemento.getAttribute('data-otel-label') || '');

            const normalizado = normalizarTexto(texto);

            if (
                normalizado.includes('adiantar cobranca da nota') ||
                (
                    normalizado.includes('adiantar') &&
                    normalizado.includes('cobranca') &&
                    normalizado.includes('nota')
                )
            ) {
                return elemento;
            }
        }

        return null;
    }

    function obterJanelaPagina() {
        try {
            if (typeof unsafeWindow !== 'undefined') return unsafeWindow;
        } catch (e) {
            // Segue para window.
        }
        return window;
    }

    function salvarEstadoAutomacao() {
        const estado = {
            criadoEm: Date.now(),
            idNota: obterIdNota(),
            etapa: 'aguardando_recarregamento',
            paginaOrigem: PAGE_TOKEN
        };

        sessionStorage.setItem(AUTOMACAO_KEY, JSON.stringify(estado));
    }

    function lerEstadoAutomacao() {
        const bruto = sessionStorage.getItem(AUTOMACAO_KEY);
        if (!bruto) return null;

        try {
            const estado = JSON.parse(bruto);

            if (!estado.criadoEm || (Date.now() - estado.criadoEm) > AUTOMACAO_VALIDADE_MS) {
                sessionStorage.removeItem(AUTOMACAO_KEY);
                return null;
            }

            return estado;
        } catch (e) {
            sessionStorage.removeItem(AUTOMACAO_KEY);
            return null;
        }
    }

    function limparEstadoAutomacao() {
        sessionStorage.removeItem(AUTOMACAO_KEY);
    }

    function executarAcaoComConfirmacaoAutomatica(acao) {
        const pagina = obterJanelaPagina();
        const confirmOriginal = pagina.confirm;

        function confirmAutomatico(mensagem) {
            const msg = normalizarTexto(mensagem);

            // Auto-confirma SOMENTE esta pergunta específica.
            if (msg.includes('confirma antecipacao do acerto para semana atual')) {
                return true;
            }

            return confirmOriginal.call(pagina, mensagem);
        }

        pagina.confirm = confirmAutomatico;

        try {
            acao();
        } finally {
            // Se a página não recarregar imediatamente, restaura o confirm normal.
            setTimeout(() => {
                try {
                    if (pagina.confirm === confirmAutomatico) {
                        pagina.confirm = confirmOriginal;
                    }
                } catch (e) {
                    // A página pode já ter iniciado o recarregamento.
                }
            }, 2000);
        }
    }

    function executarAutomacao(btnAutomatizar) {
        const botaoAdiantar = localizarBotaoAdiantarCobranca();
        const pagina = obterJanelaPagina();
        const funcaoAntecipar = typeof pagina.confirmaantecipacao === 'function'
            ? pagina.confirmaantecipacao
            : null;

        if (!botaoAdiantar && !funcaoAntecipar) {
            const original = btnAutomatizar.textContent;
            btnAutomatizar.textContent = '⚠ Adiantar não encontrado';
            btnAutomatizar.disabled = true;

            setTimeout(() => {
                btnAutomatizar.textContent = original;
                btnAutomatizar.disabled = false;
            }, 2200);
            return;
        }

        const textoOriginal = btnAutomatizar.textContent;
        btnAutomatizar.textContent = '⏳ Automatizando...';
        btnAutomatizar.disabled = true;

        // A marca fica na sessão para sobreviver ao recarregamento da página.
        salvarEstadoAutomacao();

        try {
            executarAcaoComConfirmacaoAutomatica(() => {
                // Preferência: clica exatamente no botão "Adiantar Cobrança da Nota".
                if (botaoAdiantar) {
                    botaoAdiantar.click();
                    return;
                }

                // Fallback: executa a mesma função da própria página.
                funcaoAntecipar.call(pagina);
            });
        } catch (erro) {
            limparEstadoAutomacao();
            btnAutomatizar.textContent = '⚠ Erro ao automatizar';

            setTimeout(() => {
                btnAutomatizar.textContent = textoOriginal;
                btnAutomatizar.disabled = false;
            }, 2200);
            return;
        }

        // Se o envio não provocar navegação/reload, evita deixar a automação presa.
        setTimeout(() => {
            const estado = lerEstadoAutomacao();
            if (!estado) return;

            limparEstadoAutomacao();
            btnAutomatizar.textContent = '⚠ Não recarregou';

            setTimeout(() => {
                btnAutomatizar.textContent = textoOriginal;
                btnAutomatizar.disabled = false;
            }, 2200);
        }, 15000);
    }

    function adicionarBotaoAutomatizar() {
        if (document.getElementById('btnAutomatizarAdiantar')) {
            return;
        }

        const btnCopiar = document.getElementById('btnCopiarClienteECodigo');
        const grupo = document.getElementById('grupoCopiarAutomatizar');

        if (!btnCopiar || !grupo) return;

        const btn = document.createElement('button');
        btn.id = 'btnAutomatizarAdiantar';
        btn.type = 'button';
        btn.textContent = '⚡ Automatizar';
        btn.title = 'Adiantar cobrança, confirmar automaticamente e copiar cliente + código após carregar completamente';
        btn.setAttribute('aria-label', 'Automatizar adiantamento e cópia');

        btn.style.padding = '7px 14px';
        btn.style.cursor = 'pointer';
        btn.style.border = '1px solid #3f46b7';
        btn.style.borderRadius = '7px';
        btn.style.background = '#4f46e5';
        btn.style.color = '#fff';
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '700';
        btn.style.boxShadow = '0 2px 7px rgba(0,0,0,.18)';
        btn.style.whiteSpace = 'nowrap';
        btn.style.verticalAlign = 'middle';

        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            executarAutomacao(btn);
        });

        // Fica ao lado do botão "Copiar Cliente + Código".
        grupo.appendChild(btn);
    }

    async function tentarCopiaFinalAutomatica(tentativa = 0) {
        const MAX_TENTATIVAS = 24; // 12 segundos extras, em passos de 500ms

        const estado = lerEstadoAutomacao();
        if (!estado) return;

        const btnCopiar = document.getElementById('btnCopiarClienteECodigo');
        const nome = obterNomeCliente();
        const codigo = obterCodigo();

        if (btnCopiar && nome && codigo) {
            try {
                // Faz a cópia diretamente, em vez de depender apenas de um clique sintético.
                // O botão também muda visualmente para "✔ Copiado!".
                const copiou = await copiarClienteECodigo(true);

                if (copiou) {
                    limparEstadoAutomacao();

                    const botao = document.getElementById('btnCopiarClienteECodigo');
                    if (botao) {
                        botao.textContent = '✔ Copiado! Fechando...';
                        botao.disabled = true;
                    }

                    // Antes de fechar, sinaliza a guia de Consulta Doc. para que,
                    // quando ela voltar a ficar ativa, role automaticamente para o topo.
                    prepararRetornoParaConsultaDoc();

                    // Mantém o check visível por um instante e então fecha a guia atual.
                    setTimeout(() => {
                        fecharGuiaAtual();
                    }, 800);

                    return;
                }
            } catch (erro) {
                // Continua tentando abaixo enquanto ainda houver tempo.
            }
        }

        if (tentativa < MAX_TENTATIVAS) {
            const botao = document.getElementById('btnCopiarClienteECodigo');
            if (botao && !botao.disabled) {
                botao.textContent = '⏳ Aguardando código...';
            }

            setTimeout(() => tentarCopiaFinalAutomatica(tentativa + 1), 500);
            return;
        }

        limparEstadoAutomacao();

        const botao = document.getElementById('btnCopiarClienteECodigo');
        if (botao) {
            botao.textContent = '⚠ Código não ficou pronto';
            setTimeout(() => {
                botao.textContent = '📋 Copiar Cliente + Código';
            }, 2500);
        }
    }

    function processarCopiaAutomaticaAposReload() {
        if (processamentoPosReloadAgendado) return;

        const estado = lerEstadoAutomacao();
        if (!estado) return;

        // ESSENCIAL: na página onde o usuário acabou de clicar em "Automatizar",
        // o token ainda é o mesmo. Só executa a etapa final quando houver um
        // carregamento real e o script ganhar um novo PAGE_TOKEN.
        if (estado.paginaOrigem && estado.paginaOrigem === PAGE_TOKEN) {
            return;
        }

        const btnCopiar = document.getElementById('btnCopiarClienteECodigo');
        if (!btnCopiar) return;

        // Se a página disponibilizar o ID da nota, evita copiar outra nota por engano.
        const idNotaAtual = obterIdNota();
        if (estado.idNota && idNotaAtual && estado.idNota !== idNotaAtual) {
            limparEstadoAutomacao();
            return;
        }

        processamentoPosReloadAgendado = true;

        const iniciarContagem = () => {
            const botaoAtual = document.getElementById('btnCopiarClienteECodigo');
            if (botaoAtual) {
                botaoAtual.textContent = '⏳ Copiando em 2s...';
            }

            // Só começa a contar depois que o navegador informa que a página
            // terminou completamente o carregamento.
            setTimeout(() => {
                tentarCopiaFinalAutomatica(0);
            }, 2000);
        };

        if (document.readyState === 'complete') {
            iniciarContagem();
        } else {
            window.addEventListener('load', iniciarContagem, { once: true });
        }
    }

    function atualizarBotoes() {
        adicionarBotaoCodigo();
        adicionarBotaoCliente();
        adicionarBotaoClienteECodigo();
        adicionarBotaoAutomatizar();
        processarCopiaAutomaticaAposReload();
    }

    // A guia de Consulta Doc. pode já estar aberta em segundo plano.
    // Ao fechar a guia automatizada, visibilitychange/focus detectam o retorno
    // e levam a página automaticamente para o início.
    window.addEventListener('storage', function (event) {
        if (event.key === SCROLL_CONSULTA_KEY) {
            verificarRolagemPendenteConsultaDoc();
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            setTimeout(verificarRolagemPendenteConsultaDoc, 30);
        }
    });

    window.addEventListener('focus', function () {
        setTimeout(verificarRolagemPendenteConsultaDoc, 30);
    });

    atualizarBotoes();
    verificarRolagemPendenteConsultaDoc();
    setInterval(atualizarBotoes, 700);

})();