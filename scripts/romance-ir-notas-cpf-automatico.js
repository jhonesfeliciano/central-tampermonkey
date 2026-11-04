// @central-id romance-ir-notas-cpf-automatico
// @central-name Romance | Ir para Notas + CPF Automático
// @central-version 2.3.0
// @central-match https://sistema.romancemoda.com.br/apex/*
// @central-enabled true

// Módulo preparado para Central GitHub (Script Mestre V1.8).
// V2.3: Pesquisar + Ir para Notas Romance + status em uma só linha.
// Executa apenas na página 280; o interruptor fica ao lado de "Consulta Documento".
// ON: mantém a automação original de colagem, validação, pesquisa e abertura.
// OFF: deixa apenas o interruptor e a página normal do Oracle APEX.
// Não instale este módulo isoladamente no Tampermonkey.

(function () {
    'use strict';

    // IDs da página 280 (Consulta CPF) identificados no HTML fornecido.
    const CFG = Object.freeze({
        campoCPF: 'P280_CPF',
        botaoColarCPF: 'tm-btn-colar-cpf',
        cpfValido: 'P280_VALIDO',
        tipoCPF: 'P280_TIPO_0',
        pesquisar: 'B28041405005699683',
        regiaoNotas: 'R28041928131699688',
        tabelaNotas: 'report_table_R28041928131699688',
        botaoRolar: 'tm-ir-notas-romance',
        botaoAuto: 'tm-notas-auto-toggle', // legado: será removido, não recriado
        botaoCabecalho: 'tm-notas-auto-cabecalho',
        estiloCabecalho: 'tm-notas-auto-cabecalho-css',
        estiloLinha: 'tm-notas-auto-linha-css',
        cabecalhoRegiao: 'R28041201908699681',
        status: 'tm-notas-auto-status',
        pendencia: 'tm-romance-notas-pesquisa-pendente-v2',
        preferencia: 'tm-romance-notas-automacao-v2',
        tempoPendencia: 120000,
        tempoEsperaNotas: 18000,
        tempoEsperaColagemBotao: 10000
    });

    const $id = (id) => document.getElementById(id);
    const somenteDigitos = (valor) => String(valor || '').replace(/\D/g, '');
    const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
    let tokenColagem = 0;
    let processandoRetorno = false;
    let ultimoAutoCpf = '';
    let bloqueioNovaColagem = false;
    let integracaoBotaoInstalada = false;

    // Executa somente na página Consulta CPF do Oracle APEX.
    function paginaCerta() {
        return $id(CFG.campoCPF) &&
            ($id('pFlowStepId')?.value === '280' ||
             document.body.classList.contains('page-280'));
    }

    function estaHabilitado() {
        try {
            return localStorage.getItem(CFG.preferencia) !== 'off';
        } catch (_erro) {
            return true;
        }
    }

    function guardarPreferencia(ligado) {
        try {
            localStorage.setItem(CFG.preferencia, ligado ? 'on' : 'off');
        } catch (_erro) { /* Navegação manual continua disponível. */ }
    }

    function guardarPendencia(dados) {
        try {
            sessionStorage.setItem(CFG.pendencia, JSON.stringify(dados));
            return true;
        } catch (_erro) {
            return false;
        }
    }

    function lerPendencia() {
        try {
            const p = JSON.parse(sessionStorage.getItem(CFG.pendencia) || 'null');
            return p && typeof p.cpf === 'string' && typeof p.criadoEm === 'number'
                ? p : null;
        } catch (_erro) {
            return null;
        }
    }

    function limparPendencia() {
        try { sessionStorage.removeItem(CFG.pendencia); } catch (_erro) { /* ok */ }
    }

    function informar(mensagem, cor = '#475569') {
        const el = $id(CFG.status);
        if (!el) return;
        el.textContent = mensagem;
        el.title = mensagem; // Texto completo ao passar o mouse quando houver pouco espaço.
        el.style.color = cor;
    }

    function informarErro(mensagem) {
        informar(mensagem, '#b42318');
        console.warn('[Romance Notas Auto]', mensagem);
    }

    // Validação local para evitar consultar documentos incompletos ou dígitos inválidos.
    // A validação do próprio sistema (P280_VALIDO === 'S') também é OBRIGATÓRIA.
    function cpfPassaDigitosVerificadores(valor) {
        const cpf = somenteDigitos(valor);
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

        for (let indice = 9; indice <= 10; indice++) {
            let soma = 0;
            for (let i = 0; i < indice; i++) {
                soma += Number(cpf[i]) * (indice + 1 - i);
            }
            const digito = (soma * 10) % 11;
            if (Number(cpf[indice]) !== (digito === 10 ? 0 : digito)) {
                return false;
            }
        }
        return true;
    }

    function encontrarPesquisar() {
        return $id(CFG.pesquisar) ||
            [...document.querySelectorAll('button')].find((b) =>
                b.textContent.trim().toLowerCase() === 'pesquisar');
    }

    function encontrarNotasRomance() {
        const regiao = $id(CFG.regiaoNotas);
        if (regiao) return regiao;

        const titulo = [...document.querySelectorAll('h1, h2, h3, h4')]
            .find((elemento) => elemento.textContent.trim().toLowerCase() === 'notas romance');
        return titulo ? (titulo.closest('.t-Region') || titulo) : null;
    }

    function rolarParaNotas() {
        const regiao = encontrarNotasRomance();
        if (!regiao) return false;

        regiao.style.scrollMarginTop = '80px';
        regiao.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const sombraAntiga = regiao.style.boxShadow;
        const transicaoAntiga = regiao.style.transition;
        setTimeout(() => {
            if (!regiao.isConnected) return;
            regiao.style.transition = 'box-shadow 0.3s ease';
            regiao.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.45)';
            setTimeout(() => {
                if (!regiao.isConnected) return;
                regiao.style.boxShadow = sombraAntiga;
                regiao.style.transition = transicaoAntiga;
            }, 1300);
        }, 400);
        return true;
    }

    // Interruptor ON/OFF dentro da faixa roxa de "Consulta Documento", após o título.
    // OFF deixa a consulta normal do APEX e os outros scripts sem alteração.
    function instalarEstiloInterruptor() {
        if ($id(CFG.estiloCabecalho)) return;
        const style = document.createElement('style');
        style.id = CFG.estiloCabecalho;
        style.textContent = `
            #${CFG.botaoCabecalho} { display:inline-flex!important; align-items:center!important;
              flex:0 0 auto!important; margin-left:14px!important; vertical-align:middle!important; }
            #${CFG.botaoCabecalho} .rnc-switch {
              box-sizing:border-box!important; position:relative!important; display:inline-block!important;
              width:78px!important; height:32px!important; padding:0!important; border:0!important;
              border-radius:999px!important; background:linear-gradient(100deg,#747e89,#a4aab4)!important;
              cursor:pointer!important; box-shadow:inset 0 2px 5px #0003!important;
              transition:background .22s ease!important; appearance:none!important; outline:0!important;
              touch-action:manipulation!important;
            }
            #${CFG.botaoCabecalho} .rnc-switch[aria-checked="true"] {
              background:linear-gradient(100deg,#13c86c,#42ec88)!important;
            }
            #${CFG.botaoCabecalho} .rnc-knob {
              box-sizing:border-box!important; position:absolute!important; top:-2px!important;
              left:0!important; display:grid!important; place-items:center!important;
              width:36px!important; height:36px!important; border:3px solid #0b0e11!important;
              border-radius:50%!important; background:#090b0c!important; box-shadow:0 2px 6px #0008!important;
              color:#98a2ad!important; font:900 11px/1 'Segoe UI',Arial,sans-serif!important;
              letter-spacing:.5px!important; transition:transform .22s ease,color .22s ease!important;
              pointer-events:none!important;
            }
            #${CFG.botaoCabecalho} .rnc-knob::before {
              content:''; position:absolute; inset:3px; border:2px solid #77818c;
              border-radius:50%; transition:border-color .22s ease;
            }
            #${CFG.botaoCabecalho} .rnc-switch[aria-checked="true"] .rnc-knob {
              transform:translateX(42px); color:#48f99b!important;
            }
            #${CFG.botaoCabecalho} .rnc-switch[aria-checked="true"] .rnc-knob::before {
              border-color:#23ed83!important;
            }
            #${CFG.botaoCabecalho} .rnc-switch:focus-visible {
              outline:2px solid white!important; outline-offset:3px!important;
            }
            #${CFG.cabecalhoRegiao} .t-Region-headerItems--title {
              display:flex!important; align-items:center!important; flex-wrap:wrap!important;
              gap:2px 0!important;
            }
            #${CFG.cabecalhoRegiao} .t-Region-headerItems--title .t-Region-title {
              flex:0 1 auto!important; margin:0!important;
            }
            @media(prefers-reduced-motion:reduce) {
              #${CFG.botaoCabecalho} .rnc-knob,
              #${CFG.botaoCabecalho} .rnc-switch { transition:none!important; }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function atualizarInterruptor() {
        const botao = $id(CFG.botaoCabecalho)?.querySelector('button');
        if (!botao) return;
        const ligado = estaHabilitado();
        botao.setAttribute('aria-checked', String(ligado));
        botao.setAttribute('aria-label', 'Automação de Consulta Documento: ' + (ligado ? 'ligada' : 'desligada'));
        botao.title = ligado
            ? 'ON — Consulta automática ativa. Clique para desligar.'
            : 'OFF — Consulta normal do sistema. Clique para ativar a automação.';
        const texto = botao.querySelector('.rnc-knob');
        if (texto) texto.textContent = ligado ? 'ON' : 'OFF';
    }

    function desligarAutomacao() {
        // Invalida operações assíncronas do próprio script, sem impedir ações manuais do APEX.
        ++tokenColagem;
        limparPendencia();
        bloqueioNovaColagem = false;
        ultimoAutoCpf = '';
        $id(CFG.botaoRolar)?.remove();
        $id(CFG.botaoAuto)?.remove();
        $id(CFG.status)?.remove();
    }

    function alternarAutomacao() {
        const ligado = !estaHabilitado();
        guardarPreferencia(ligado);
        if (ligado) {
            ativarAutomacao();
        } else {
            desligarAutomacao();
        }
        atualizarInterruptor();
    }

    function criarInterruptorCabecalho() {
        if (!paginaCerta()) return;
        const regiao = $id(CFG.cabecalhoRegiao);
        const titulo = regiao?.querySelector('.t-Region-title');
        if (!titulo) return;
        instalarEstiloInterruptor();
        if (!$id(CFG.botaoCabecalho)) {
            const wrap = document.createElement('span');
            wrap.id = CFG.botaoCabecalho;
            const botao = document.createElement('button');
            botao.className = 'rnc-switch';
            botao.type = 'button';
            botao.setAttribute('role', 'switch');
            botao.innerHTML = '<span class="rnc-knob" aria-hidden="true"></span>';
            botao.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                alternarAutomacao();
            });
            wrap.appendChild(botao);
            titulo.insertAdjacentElement('afterend', wrap);
        }
        atualizarInterruptor();
    }

    // Alinha o botão nativo Pesquisar, o atalho de rolagem e o texto de status.
    // Não recria nem substitui o botão original do APEX: mantém seus eventos nativos.
    function alinharAcoesConsulta(pesquisar) {
        const coluna = pesquisar?.parentElement;
        if (!coluna) return;
        if (!$id(CFG.estiloLinha)) {
            const estilo = document.createElement('style');
            estilo.id = CFG.estiloLinha;
            estilo.textContent = `
                #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha {
                    display: flex !important;
                    flex-flow: row nowrap !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    column-gap: 10px !important;
                    width: 100% !important;
                    min-width: 0 !important;
                }
                #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha > #${CFG.pesquisar},
                #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha > #${CFG.botaoRolar} {
                    flex: 0 0 auto !important;
                    margin: 0 !important;
                    white-space: nowrap !important;
                    align-self: center !important;
                }
                #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha > #${CFG.status} {
                    flex: 1 1 auto !important;
                    min-width: 0 !important;
                    margin: 0 !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                    align-self: center !important;
                }
                @media(max-width:600px) {
                    #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha { column-gap: 6px !important; }
                    #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha > #${CFG.botaoRolar} {
                        padding: 8px 9px !important;
                        font-size: 11px !important;
                    }
                    #${CFG.cabecalhoRegiao} .tm-notas-acoes-linha > #${CFG.status} {
                        font-size: 10px !important;
                    }
                }
            `;
            (document.head || document.documentElement).appendChild(estilo);
        }
        coluna.classList.add('tm-notas-acoes-linha');
        // Reposiciona apenas os elementos criados por este módulo.
        const rolar = $id(CFG.botaoRolar);
        if (rolar && rolar.previousElementSibling !== pesquisar) {
            pesquisar.insertAdjacentElement('afterend', rolar);
        }
        const status = $id(CFG.status);
        if (status && rolar && status.previousElementSibling !== rolar) {
            rolar.insertAdjacentElement('afterend', status);
        }
        if (status) status.title = status.textContent || '';
    }

    function criarBotoes() {
        if (!paginaCerta() || !estaHabilitado()) return;
        const pesquisar = encontrarPesquisar();
        if (!pesquisar) return;

        if (!$id(CFG.botaoRolar)) {
            const botao = document.createElement('button');
            botao.id = CFG.botaoRolar;
            botao.type = 'button';
            botao.textContent = '↓ Ir para Notas Romance';
            botao.className = 't-Button';
            Object.assign(botao.style, {
                display: 'inline-flex',
                alignItems: 'center',
                marginTop: '0',
                padding: '9px 14px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 5px rgba(0,0,0,.15)'
            });
            botao.addEventListener('mouseenter', () => { botao.style.background = '#1d4ed8'; });
            botao.addEventListener('mouseleave', () => { botao.style.background = '#2563eb'; });
            botao.addEventListener('click', () => {
                if (!rolarParaNotas()) {
                    alert('A seção "Notas Romance" não foi encontrada nesta página.');
                }
            });
            pesquisar.insertAdjacentElement('afterend', botao);
        }

        // O interruptor de automação foi transferido para a faixa de título.
        // O botão auxiliar de rolagem e o status só existem quando está ON; ficam na mesma linha do Pesquisar.
        $id(CFG.botaoAuto)?.remove(); // remove controle antigo, caso exista
        if (!$id(CFG.status) && $id(CFG.botaoRolar)) {
            const linha = document.createElement('span');
            linha.id = CFG.status;
            Object.assign(linha.style, {
                display: 'inline-block', fontSize: '12px',
                lineHeight: '1.4', color: '#475569'
            });
            $id(CFG.botaoRolar).insertAdjacentElement('afterend', linha);
        }
        alinharAcoesConsulta(pesquisar);

    }

    // A lupa verdadeira está na célula URL (Ir P/ Nota), não na coluna de número.
    // Escolhe somente a PRIMEIRA linha que o relatório apresenta, respeitando sua ordem.
    function primeiraLupa() {
        const tabela = $id(CFG.tabelaNotas) ||
            encontrarNotasRomance()?.querySelector('table.t-Report-report');
        if (!tabela) return null;

        const linhas = [...tabela.querySelectorAll('tbody > tr')];
        for (const linha of linhas) {
            const celula = [...linha.querySelectorAll('td')].find((td) =>
                td.getAttribute('headers') === 'URL');
            if (!celula) continue;
            const link = [...celula.querySelectorAll('a[href]')].find((a) =>
                a.querySelector('img[src*="magnifying_glass"]'));
            // Não pula a primeira linha com uma nota caso a lupa tenha desaparecido.
            return { link: link || null, linha };
        }
        return null;
    }

    // O HTML da página usa href="javascript:window.open('f?p=2001:37:...','_blank')".
    // Abre a mesma URL pela API do Tampermonkey para evitar o bloqueio de pop-up
    // típico de cliques automáticos que acontecem após o carregamento da página.
    function extrairUrlDaLupa(link) {
        if (!link) return null;
        const href = link.getAttribute('href') || '';
        const chamadaWindowOpen = href.match(/window\s*\.\s*open\s*\(\s*(['"])(.*?)\1/i);
        const destino = chamadaWindowOpen ? chamadaWindowOpen[2] : href;
        try {
            const url = new URL(destino, window.location.href);
            if (url.origin !== window.location.origin) return null;
            // Somente notas da própria tela do sistema. Mantém o checksum original.
            if (!/^2001:37:/.test(url.searchParams.get('p') || '')) return null;
            if (!/P37_IDNOTAVENDA/i.test(url.searchParams.get('p') || '')) return null;
            return url.href;
        } catch (_erro) {
            return null;
        }
    }

    function abrirLupa(link) {
        const destino = extrairUrlDaLupa(link);
        if (!destino) return false;
        try {
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(destino, { active: true, insert: true, setParent: true });
            } else {
                // Contingência: mesma ação do link original, sujeita ao bloqueador do Chrome.
                link.click();
            }
            return true;
        } catch (erro) {
            console.warn('[Romance Notas Auto] Falha ao abrir nova guia:', erro);
            return false;
        }
    }

    // APEX submete o filtro e recarrega a página. A pendência continua somente
    // nesta guia (sessionStorage), sem gravar CPFs persistentemente em localStorage.
    async function concluirAposPesquisa() {
        if (processandoRetorno || !estaHabilitado()) return;
        const pendente = lerPendencia();
        if (!pendente || pendente.fase !== 'pesquisando') return;
        processandoRetorno = true;

        try {
            const atual = somenteDigitos($id(CFG.campoCPF)?.value);
            if (Date.now() - pendente.criadoEm > CFG.tempoPendencia) {
                limparPendencia();
                informarErro('A consulta expirou. Cole o CPF novamente.');
                return;
            }
            if (!atual || atual !== pendente.cpf) {
                limparPendencia();
                informarErro('O CPF retornado é diferente do pesquisado. A abertura foi cancelada.');
                return;
            }

            informar('Consulta carregada. Localizando Notas Romance...');
            let primeira = null;
            const inicio = Date.now();
            while (Date.now() - inicio < CFG.tempoEsperaNotas) {
                if (!estaHabilitado() || somenteDigitos($id(CFG.campoCPF)?.value) !== pendente.cpf) {
                    limparPendencia();
                    return;
                }
                if (encontrarNotasRomance()) {
                    primeira = primeiraLupa();
                    if (primeira) break;
                    const tabela = $id(CFG.tabelaNotas);
                    if (tabela && /nenhum dado|nenhuma nota|no data found|nenhum registro/i.test(tabela.textContent)) {
                        break;
                    }
                }
                await esperar(350);
            }

            if (!encontrarNotasRomance()) {
                informarErro('A seção Notas Romance não apareceu após a pesquisa.');
                return;
            }
            // Mantém a sequência visual do botão pedido pelo usuário.
            if ($id(CFG.botaoRolar)) {
                $id(CFG.botaoRolar).click();
            } else {
                rolarParaNotas();
            }

            if (!primeira) {
                informarErro('Nenhuma nota encontrada para este CPF.');
                return;
            }
            if (!primeira.link) {
                informarErro('A primeira nota não possui uma lupa disponível.');
                return;
            }

            informar('Notas Romance localizada. Abrindo a lupa da primeira nota...');
            await esperar(700);

            if (!estaHabilitado() || somenteDigitos($id(CFG.campoCPF)?.value) !== pendente.cpf) {
                return;
            }
            if (abrirLupa(primeira.link)) {
                informar('✓ Primeira nota aberta em nova guia.', '#166534');
            } else {
                informarErro('Não foi possível abrir a nota automaticamente. Use a lupa manualmente.');
            }
        } finally {
            limparPendencia();
            processandoRetorno = false;
        }
    }

    function associarCampoCPF() {
        const campo = $id(CFG.campoCPF);
        if (!campo || campo.dataset.tmNotasV2Vinculado === '1') return;
        campo.dataset.tmNotasV2Vinculado = '1';

        campo.addEventListener('paste', () => {
            if (!estaHabilitado()) return;
            ++tokenColagem;
            const tokenAtual = tokenColagem;
            // Quando o evento paste dispara, o browser ainda não inseriu o texto.
            setTimeout(() => iniciarPorColagem(campo, tokenAtual), 170);
        });

        campo.addEventListener('input', () => {
            // Interrompe a abertura do resultado anterior ao editar o documento.
            const p = lerPendencia();
            if (p && p.cpf !== somenteDigitos(campo.value)) limparPendencia();
        });
    }

    // INTEGRAÇÃO COM OUTRO USERSCRIPT: "Romance - Botão Colar CPF".
    // O botão #tm-btn-colar-cpf pode usar navigator.clipboard.readText() e apenas
    // atribuir campo.value, SEM disparar eventos nativos "paste" ou "input".
    // Por isso monitoramos o valor real do campo APÓS o clique no botão.
    // Não lemos a área de transferência e não alteramos o código do outro script.
    function ativarDeteccaoBotaoColar() {
        if (integracaoBotaoInstalada) return;
        integracaoBotaoInstalada = true;

        // Delegação: funciona mesmo se o botão for criado depois pelo Tampermonkey.
        document.addEventListener('click', (evento) => {
            const alvo = evento.target;
            if (!(alvo instanceof Element)) return;
            const botao = alvo.closest('#' + CFG.botaoColarCPF);
            if (!botao || !paginaCerta() || !estaHabilitado()) return;

            const campo = $id(CFG.campoCPF);
            if (!campo) return;
            const cpfAnterior = somenteDigitos(campo.value);
            const token = ++tokenColagem;
            informar('Botão Colar CPF acionado. Aguardando o preenchimento...');
            void acompanharColagemPeloBotao(campo, cpfAnterior, token);
        }, true);
    }

    async function acompanharColagemPeloBotao(campo, cpfAnterior, token) {
        let houveEventoNoCampo = false;
        const marcarEvento = () => { houveEventoNoCampo = true; };
        campo.addEventListener('input', marcarEvento);
        campo.addEventListener('change', marcarEvento);
        let ultimoValor = null;
        let desde = 0;
        const prazo = Date.now() + CFG.tempoEsperaColagemBotao;

        try {
            while (Date.now() < prazo) {
                if (token !== tokenColagem || !estaHabilitado() || !campo.isConnected) return;
                const cpfAtual = somenteDigitos(campo.value);
                const foiPreenchido = cpfAtual !== cpfAnterior || houveEventoNoCampo;

                // Só inicia depois que o CPF estiver completo e estável, inclusive
                // quando o botão insere os caracteres em mais de uma etapa.
                if (foiPreenchido && cpfAtual.length === 11) {
                    if (cpfAtual !== ultimoValor) {
                        ultimoValor = cpfAtual;
                        desde = Date.now();
                    } else if (Date.now() - desde >= 240) {
                        // Alguns botões só atribuem .value; reproduz os eventos
                        // normais do campo para a página APEX perceber a mudança.
                        if (!houveEventoNoCampo) {
                            campo.dispatchEvent(new Event('input', { bubbles: true }));
                            campo.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        await iniciarPorColagem(campo, token);
                        return;
                    }
                } else {
                    ultimoValor = null;
                }
                await esperar(110);
            }
            if (token === tokenColagem) {
                informarErro('O botão Colar não preencheu um novo CPF completo. ' +
                    'Confira se o navegador permitiu o acesso à área de transferência.');
            }
        } finally {
            campo.removeEventListener('input', marcarEvento);
            campo.removeEventListener('change', marcarEvento);
        }
    }

    async function iniciarPorColagem(campo, token) {
        if (!paginaCerta() || !estaHabilitado() || token !== tokenColagem) return;
        const cpf = somenteDigitos(campo.value);

        if (!$id(CFG.tipoCPF)?.checked) {
            informarErro('Selecione o tipo de documento CPF para usar a automação.');
            return;
        }
        if (!cpfPassaDigitosVerificadores(cpf)) {
            informarErro('CPF incompleto ou inválido. Nenhuma pesquisa foi iniciada.');
            return;
        }
        if (bloqueioNovaColagem && ultimoAutoCpf === cpf) return;
        limparPendencia();
        informar('CPF preenchido. Aguardando validação do sistema...');

        const campoValido = $id(CFG.cpfValido);
        if (!campoValido) {
            informarErro('Campo de validação do sistema não localizado.');
            return;
        }
        campoValido.value = ''; // Impede aproveitar o "S" de um CPF anterior.

        // O input tem onBlur="validadocumento()" no HTML original.
        // Dispara a validação OFICIAL do sistema, sem sobrescrever sua função.
        try {
            if (document.activeElement === campo) {
                campo.blur(); // Aciona onBlur e também change do Oracle APEX.
            } else {
                campo.dispatchEvent(new Event('blur'));
            }
        } catch (erro) {
            console.warn('[Romance Notas Auto] Erro na validação do CPF:', erro);
            informarErro('Não foi possível validar o CPF pelo sistema.');
            return;
        }

        const inicio = Date.now();
        while (Date.now() - inicio < 8500) {
            if (token !== tokenColagem || !estaHabilitado()) return;
            if (somenteDigitos(campo.value) !== cpf) {
                informar('CPF alterado durante a validação; automação cancelada.');
                return;
            }
            if (campoValido.value === 'N') {
                informarErro('O sistema informou que o CPF é inválido.');
                return;
            }
            if (campoValido.value === 'S') break;
            await esperar(150);
        }

        if (campoValido.value !== 'S') {
            informarErro('O sistema não confirmou a validade do CPF. Pesquisa não iniciada.');
            return;
        }
        if (token !== tokenColagem || !estaHabilitado()) return;

        // Pequena margem para os handlers change/blur da aplicação concluírem.
        await esperar(350);
        if (token !== tokenColagem || !estaHabilitado() || somenteDigitos(campo.value) !== cpf) return;

        const pesquisar = encontrarPesquisar();
        if (!pesquisar || pesquisar.disabled) {
            informarErro('O botão Pesquisar não está disponível.');
            return;
        }
        if (!guardarPendencia({ cpf, fase: 'pesquisando', criadoEm: Date.now() })) {
            informarErro('O navegador bloqueou a continuidade da automação após recarregar.');
            return;
        }

        bloqueioNovaColagem = true;
        ultimoAutoCpf = cpf;
        informar('✓ CPF válido. Clicando em Pesquisar...', '#166534');
        try {
            pesquisar.click(); // Usa as ações dinâmicas originais do Oracle APEX.
        } catch (erro) {
            limparPendencia();
            bloqueioNovaColagem = false;
            informarErro('Falha ao clicar em Pesquisar.');
            console.error('[Romance Notas Auto]', erro);
            return;
        }

        // Evita deixar uma pendência falsa quando uma submissão não redirecionar.
        setTimeout(() => {
            const p = lerPendencia();
            if (p && p.cpf === cpf && p.fase === 'pesquisando') {
                limparPendencia();
                bloqueioNovaColagem = false;
                informarErro('A pesquisa não concluiu a navegação. Tente novamente.');
            }
        }, 45000);
    }

    let observerInstalado = false;
    let retornoAgendado = false;

    function ativarAutomacao() {
        if (!paginaCerta() || !estaHabilitado()) return;
        criarBotoes();
        associarCampoCPF();
        ativarDeteccaoBotaoColar();
        if (lerPendencia()) {
            if (!retornoAgendado) {
                retornoAgendado = true;
                setTimeout(() => {
                    retornoAgendado = false;
                    if (estaHabilitado()) void concluirAposPesquisa();
                }, 550);
            }
        } else {
            informar('Use Ctrl+V ou o botão Colar CPF: pesquisar → Notas Romance → primeira lupa.');
        }
    }

    function iniciar() {
        if (!paginaCerta()) return;
        criarInterruptorCabecalho();
        // OFF significa que só o interruptor permanece: a página funciona normalmente.
        if (estaHabilitado()) ativarAutomacao();
        else desligarAutomacao();

        if (!observerInstalado) {
            observerInstalado = true;
            let agendado = false;
            const observer = new MutationObserver(() => {
                if (agendado) return;
                const faltaInterruptor = !$id(CFG.botaoCabecalho);
                const ligado = estaHabilitado();
                const faltaControles = ligado && (!$id(CFG.botaoRolar) || !$id(CFG.status) ||
                    $id(CFG.campoCPF)?.dataset.tmNotasV2Vinculado !== '1');
                if (!faltaInterruptor && !faltaControles) return;
                agendado = true;
                setTimeout(() => {
                    agendado = false;
                    if (!paginaCerta()) return;
                    criarInterruptorCabecalho();
                    if (estaHabilitado()) {
                        criarBotoes();
                        associarCampoCPF();
                    }
                }, 130);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }

})();
