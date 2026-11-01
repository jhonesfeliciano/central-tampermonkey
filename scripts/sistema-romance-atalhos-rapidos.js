// @central-id sistema-romance-atalhos-rapidos
// @central-name Sistema Romance - Atalhos Rápidos
// @central-version 2.0.0
// @central-match https://*/*
// @central-match http://*/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(() => {
    'use strict';

    // A lista contém apenas número da página, nome e área. Nenhum ID de sessão é gravado.
    const CONFIG = Object.freeze({
        appId: '2001',
        homePageId: '1',
        hostId: 'lm-apex-atalhos-host',
        storageAberto: 'lm-apex-atalhos-aberto-v1', // compatível com a versão anterior
        storageAtivos: 'lm-apex-atalhos-ativos-v2',
        storagePersonalizados: 'lm-apex-atalhos-personalizados-v2',
        storageDescobertos: 'lm-apex-atalhos-descobertos-v2'
    });

    // Primeira instalação: mantém os 11 atalhos da versão 1.2 como ativos.
    const PAGINAS_PRINCIPAIS = Object.freeze([
        '36', '22', '183', '74', '91', '158', '297', '232', '81', '675', '7'
    ]);

    // Mapa do Sistema fornecido (página 60). Atualizado também por leitura do menu atual.
    const CATALOGO_BASE = [
        {
                "pagina": "32",
                "nome": "Cadastros",
                "grupo": "Cadastros"
        },
        {
                "pagina": "281",
                "nome": "Horários de Acesso",
                "grupo": "Cadastros"
        },
        {
                "pagina": "7",
                "nome": "Pessoas",
                "grupo": "Cadastros"
        },
        {
                "pagina": "18",
                "nome": "Regiões de Venda",
                "grupo": "Cadastros"
        },
        {
                "pagina": "184",
                "nome": "Produtos",
                "grupo": "Cadastros"
        },
        {
                "pagina": "292",
                "nome": "Atualização de Cadastro",
                "grupo": "Cadastros"
        },
        {
                "pagina": "557",
                "nome": "Gestão da Convenção",
                "grupo": "Cadastros"
        },
        {
                "pagina": "39",
                "nome": "Movimentação",
                "grupo": "Movimentação"
        },
        {
                "pagina": "36",
                "nome": "Notas de Venda",
                "grupo": "Movimentação"
        },
        {
                "pagina": "12",
                "nome": "Trans. Entre Distribuidores",
                "grupo": "Movimentação"
        },
        {
                "pagina": "61",
                "nome": "Vendas para Clientes",
                "grupo": "Movimentação"
        },
        {
                "pagina": "234",
                "nome": "Liberar Distribuidores",
                "grupo": "Movimentação"
        },
        {
                "pagina": "171",
                "nome": "Indicações",
                "grupo": "Movimentação"
        },
        {
                "pagina": "738",
                "nome": "Desafio Romance",
                "grupo": "Movimentação"
        },
        {
                "pagina": "736",
                "nome": "Rel. Desafio Rom",
                "grupo": "Movimentação / Desafio Romance"
        },
        {
                "pagina": "737",
                "nome": "Rel. Desafio Dist.",
                "grupo": "Movimentação / Desafio Romance"
        },
        {
                "pagina": "675",
                "nome": "Requisições Pagamentos",
                "grupo": "Movimentação"
        },
        {
                "pagina": "47",
                "nome": "Estoque",
                "grupo": "Estoque"
        },
        {
                "pagina": "2",
                "nome": "Distribuição",
                "grupo": "Estoque"
        },
        {
                "pagina": "41",
                "nome": "Atual",
                "grupo": "Estoque / Distribuição"
        },
        {
                "pagina": "42",
                "nome": "Histórico",
                "grupo": "Estoque / Distribuição"
        },
        {
                "pagina": "192",
                "nome": "Planilha de Distribuição",
                "grupo": "Estoque / Distribuição"
        },
        {
                "pagina": "258",
                "nome": "Efetuar Distribuição",
                "grupo": "Estoque / Distribuição"
        },
        {
                "pagina": "244",
                "nome": "Reembalagem",
                "grupo": "Estoque"
        },
        {
                "pagina": "112",
                "nome": "Atual",
                "grupo": "Estoque / Reembalagem"
        },
        {
                "pagina": "116",
                "nome": "Histórico",
                "grupo": "Estoque / Reembalagem"
        },
        {
                "pagina": "102",
                "nome": "Transf. p/ Distrib.",
                "grupo": "Estoque / Reembalagem"
        },
        {
                "pagina": "402",
                "nome": "Produtividade Reembalagem",
                "grupo": "Estoque / Reembalagem"
        },
        {
                "pagina": "3",
                "nome": "Distribuição PA",
                "grupo": "Estoque"
        },
        {
                "pagina": "122",
                "nome": "Atual",
                "grupo": "Estoque / Distribuição PA"
        },
        {
                "pagina": "247",
                "nome": "Histórico",
                "grupo": "Estoque / Distribuição PA"
        },
        {
                "pagina": "255",
                "nome": "Planilha de Distribuição",
                "grupo": "Estoque / Distribuição PA"
        },
        {
                "pagina": "22",
                "nome": "Receb. Compras",
                "grupo": "Estoque"
        },
        {
                "pagina": "16",
                "nome": "Cargas",
                "grupo": "Estoque"
        },
        {
                "pagina": "113",
                "nome": "Devoluções",
                "grupo": "Estoque"
        },
        {
                "pagina": "213",
                "nome": "Transf. De Mercadorias",
                "grupo": "Estoque"
        },
        {
                "pagina": "185",
                "nome": "Atualizar Produto",
                "grupo": "Estoque"
        },
        {
                "pagina": "554",
                "nome": "Balanço",
                "grupo": "Estoque"
        },
        {
                "pagina": "520",
                "nome": "Balanço de Catálogos",
                "grupo": "Estoque"
        },
        {
                "pagina": "64",
                "nome": "Fechamentos",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "70",
                "nome": "Entradas",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "81",
                "nome": "Despesas",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "84",
                "nome": "Saídas",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "183",
                "nome": "Acertos Pend.",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "74",
                "nome": "Acertos",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "89",
                "nome": "Vendas Diretas",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "91",
                "nome": "Fechamentos",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "173",
                "nome": "Empréstimos",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "195",
                "nome": "Cheques S/ Fundo",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "232",
                "nome": "Ligações p/ Depósitos",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "241",
                "nome": "Lucratividade Distribuidores",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "465",
                "nome": "Ranking de Cobranças",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "482",
                "nome": "Fotos de Comprovantes",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "483",
                "nome": "Pontuação",
                "grupo": "Fechamentos"
        },
        {
                "pagina": "45",
                "nome": "Relatórios",
                "grupo": "Relatórios"
        },
        {
                "pagina": "35",
                "nome": "Estoque",
                "grupo": "Relatórios"
        },
        {
                "pagina": "21",
                "nome": "Carga",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "153",
                "nome": "Alvo",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "246",
                "nome": "Alvo (teste)",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "202",
                "nome": "Devoluções Detalhadas",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "327",
                "nome": "Controle de Defeitos",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "432",
                "nome": "Produtos para Postagem",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "435",
                "nome": "Acompanhamento de Peças",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "527",
                "nome": "Acompanhamento de Balanços",
                "grupo": "Relatórios / Estoque"
        },
        {
                "pagina": "10",
                "nome": "Vendas",
                "grupo": "Relatórios"
        },
        {
                "pagina": "95",
                "nome": "Débitos",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "97",
                "nome": "Romance x Favorita",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "177",
                "nome": "% Venda",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "226",
                "nome": "Ranking de Clientes",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "239",
                "nome": "Lista de Débitos",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "231",
                "nome": "Itens Vendidos",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "238",
                "nome": "Itens Distribuidos",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "705",
                "nome": "Notas com 40% Comissão",
                "grupo": "Relatórios / Vendas"
        },
        {
                "pagina": "19",
                "nome": "Diversos",
                "grupo": "Relatórios"
        },
        {
                "pagina": "158",
                "nome": "Lista de Clientes",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "201",
                "nome": "Pendências de Anotações",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "205",
                "nome": "Anotações Concluídas",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "224",
                "nome": "Manutenções de Equipamentos",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "229",
                "nome": "Lista ID Clientes",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "230",
                "nome": "Relação de Distribuidores",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "235",
                "nome": "Regiões Atendidas",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "221",
                "nome": "Defeitos Fornecedores",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "50",
                "nome": "Notas com Pedidos Cancelados",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "296",
                "nome": "Notas p/ Setor de Cobrança",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "297",
                "nome": "Notas Perdidas",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "329",
                "nome": "Atendimento Supervisores",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "347",
                "nome": "Notas Enviadas para Cobrança",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "441",
                "nome": "Notificações Distribuidores",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "447",
                "nome": "Acompanhamento dos Atendimentos",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "668",
                "nome": "Dash Notas em Aberto",
                "grupo": "Relatórios / Diversos"
        },
        {
                "pagina": "27",
                "nome": "Financeiro",
                "grupo": "Relatórios"
        },
        {
                "pagina": "150",
                "nome": "Pagamento de Débitos",
                "grupo": "Relatórios / Financeiro"
        },
        {
                "pagina": "188",
                "nome": "Cobranças",
                "grupo": "Relatórios / Financeiro"
        },
        {
                "pagina": "267",
                "nome": "Balanco de Distribuidores",
                "grupo": "Relatórios / Financeiro"
        },
        {
                "pagina": "629",
                "nome": "Negociações de Balanços",
                "grupo": "Relatórios / Financeiro"
        },
        {
                "pagina": "443",
                "nome": "Controladoria",
                "grupo": "Relatórios"
        },
        {
                "pagina": "524",
                "nome": "Controle de Distribuidores",
                "grupo": "Relatórios / Controladoria"
        },
        {
                "pagina": "222",
                "nome": "Favorita",
                "grupo": "Favorita"
        },
        {
                "pagina": "199",
                "nome": "Pedidos a Vencer",
                "grupo": "Favorita"
        },
        {
                "pagina": "191",
                "nome": "Pedidos Vencidos",
                "grupo": "Favorita"
        },
        {
                "pagina": "253",
                "nome": "Pedidos Quitados",
                "grupo": "Favorita"
        },
        {
                "pagina": "252",
                "nome": "Pedidos Cancelados",
                "grupo": "Favorita"
        },
        {
                "pagina": "345",
                "nome": "Pedidos Não Aprovados",
                "grupo": "Favorita"
        },
        {
                "pagina": "197",
                "nome": "Envio de Boletos para Cobrança",
                "grupo": "Favorita"
        },
        {
                "pagina": "218",
                "nome": "Protocolo de Canc/Prorrog/Pagamento",
                "grupo": "Favorita"
        },
        {
                "pagina": "217",
                "nome": "Relatório de Venda Direta",
                "grupo": "Favorita"
        },
        {
                "pagina": "212",
                "nome": "Histórico de Comissões",
                "grupo": "Favorita"
        },
        {
                "pagina": "323",
                "nome": "Pagamentos de Pedidos Favorita",
                "grupo": "Favorita"
        },
        {
                "pagina": "336",
                "nome": "Pagamento de Venda Direta",
                "grupo": "Favorita"
        },
        {
                "pagina": "519",
                "nome": "Controle de Pedidos",
                "grupo": "Favorita"
        },
        {
                "pagina": "587",
                "nome": "Ranking Semanal",
                "grupo": "Favorita"
        },
        {
                "pagina": "595",
                "nome": "Vendas de Produtos",
                "grupo": "Favorita"
        },
        {
                "pagina": "754",
                "nome": "Desafio Favorita",
                "grupo": "Favorita"
        },
        {
                "pagina": "88",
                "nome": "Ticket [3]",
                "grupo": "Ticket [3]"
        },
        {
                "pagina": "388",
                "nome": "Questionamentos[0]",
                "grupo": "Questionamentos[0]"
        },
        {
                "pagina": "380",
                "nome": "Links Auxiliares",
                "grupo": "Links Auxiliares"
        },
        {
                "pagina": "407",
                "nome": "APP Romance",
                "grupo": "APP Romance"
        },
        {
                "pagina": "382",
                "nome": "B.I APP Romance",
                "grupo": "APP Romance"
        },
        {
                "pagina": "386",
                "nome": "Logins por Equipamento",
                "grupo": "APP Romance"
        },
        {
                "pagina": "572",
                "nome": "Cobraki",
                "grupo": "Cobraki"
        },
        {
                "pagina": "567",
                "nome": "Negociações Cobraki",
                "grupo": "Cobraki"
        },
        {
                "pagina": "569",
                "nome": "Cobraki",
                "grupo": "Cobraki"
        },
        {
                "pagina": "574",
                "nome": "Assinatura Eletrônica",
                "grupo": "Assinatura Eletrônica"
        },
        {
                "pagina": "575",
                "nome": "Dashboard",
                "grupo": "Assinatura Eletrônica"
        },
        {
                "pagina": "602",
                "nome": "Assinaturas Eletronicas",
                "grupo": "Assinatura Eletrônica"
        },
        {
                "pagina": "581",
                "nome": "Comunicação MEI",
                "grupo": "Comunicação MEI"
        },
        {
                "pagina": "641",
                "nome": "Show de Prêmios",
                "grupo": "Comunicação MEI"
        },
        {
                "pagina": "673",
                "nome": "Ranking Favorita Pagos",
                "grupo": "Comunicação MEI"
        },
        {
                "pagina": "678",
                "nome": "Análise Estratégica",
                "grupo": "Análise Estratégica"
        },
        {
                "pagina": "560",
                "nome": "Dias em estoque",
                "grupo": "Análise Estratégica"
        },
        {
                "pagina": "539",
                "nome": "Análise de Inadimplência",
                "grupo": "Análise Estratégica"
        },
        {
                "pagina": "545",
                "nome": "Atendimento de Cidades",
                "grupo": "Análise Estratégica"
        },
        {
                "pagina": "548",
                "nome": "Acompanhamento de Crescimento",
                "grupo": "Análise Estratégica"
        },
        {
                "pagina": "706",
                "nome": "Estrelas Romance",
                "grupo": "Estrelas Romance"
        },
        {
                "pagina": "716",
                "nome": "Rel.Pontuação",
                "grupo": "Estrelas Romance"
        },
        {
                "pagina": "280",
                "nome": "Consulta Doc.",
                "grupo": "Acesso rápido do cabeçalho"
        },
        {
                "pagina": "60",
                "nome": "Mapa do Sistema",
                "grupo": "Acesso rápido do cabeçalho"
        }
];

    // Impede que a interface apareça dentro dos iframes do Oracle APEX.
    if (window.top !== window.self) return;

    const compararNomes = (a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', {sensitivity: 'base', numeric: true})
        || a.grupo.localeCompare(b.grupo, 'pt-BR', {sensitivity: 'base', numeric: true})
        || Number(a.pagina) - Number(b.pagina);

    function normalizarTexto(valor) {
        return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function somentePagina(valor) {
        const p = String(valor || '').trim();
        return /^\d{1,6}$/.test(p) && Number(p) > 0 ? String(Number(p)) : '';
    }

    function lerJSON(chave, padrao) {
        try {
            const bruto = window.localStorage.getItem(chave);
            return bruto === null ? padrao : JSON.parse(bruto);
        } catch {
            return padrao;
        }
    }

    function escreverJSON(chave, valor) {
        try {
            window.localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch {
            return false;
        }
    }

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
        return valorDoElemento('pFlowId') || lerParametroApex()[0] || '';
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
        const url = lerParametroApex();
        if (url[2]) return url[2];
        for (const link of document.querySelectorAll('a[href*="f?p=2001:"]')) {
            const href = link.getAttribute('href') || '';
            const encontrado = href.match(/f\?p=2001:\d+:([^:&#]+)/i);
            if (encontrado?.[1]) return encontrado[1];
        }
        return '';
    }

    function estaNoSistema() { return obterAppId() === CONFIG.appId; }
    function estaNaPaginaInicial() {
        return estaNoSistema() && obterPaginaAtual() === CONFIG.homePageId;
    }

    function criarUrlDestino(pagina) {
        const numero = somentePagina(pagina);
        if (!numero) throw new Error('Número da página inválido.');
        const sessao = obterSessaoAtual();
        if (!sessao) throw new Error('Não foi possível identificar a sessão atual do sistema.');
        return `f?p=${CONFIG.appId}:${numero}:${sessao}::NO:::`;
    }

    function hrefSeguro(pagina) {
        try { return criarUrlDestino(pagina); } catch { return '#'; }
    }

    function lerEstadoSalvo() {
        try { return window.localStorage.getItem(CONFIG.storageAberto) === '1'; }
        catch { return false; }
    }

    function salvarEstado(aberto) {
        try { window.localStorage.setItem(CONFIG.storageAberto, aberto ? '1' : '0'); }
        catch { /* continua utilizável sem armazenamento */ }
    }

    function validarEntradas(lista) {
        if (!Array.isArray(lista)) return [];
        const usados = new Set();
        return lista.reduce((resultado, item) => {
            if (!item || typeof item !== 'object') return resultado;
            const pagina = somentePagina(item.pagina);
            const nome = String(item.nome || '').trim().slice(0, 90);
            const grupo = String(item.grupo || 'Personalizados').trim().slice(0, 150);
            if (!pagina || !nome || usados.has(pagina)) return resultado;
            usados.add(pagina);
            resultado.push({pagina, nome, grupo});
            return resultado;
        }, []);
    }

    function registrarMenuAtual() {
        const nav = document.querySelector('#t_TreeNav');
        if (!nav) return [];
        const itens = [];
        const paginas = new Set();
        nav.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const achou = href.match(/(?:f\?p=|[?&]p=)2001:(\d+):/i);
            if (!achou) return;
            const pagina = somentePagina(achou[1]);
            const nome = String(a.textContent || '').replace(/\s+/g, ' ').trim();
            if (!pagina || !nome || paginas.has(pagina)) return;
            const partes = [];
            let li = a.closest('li');
            while (li && li !== nav) {
                li = li.parentElement?.closest('li') || null;
                if (li) {
                    const pai = Array.from(li.children).find(el => el.tagName === 'A');
                    if (pai?.textContent?.trim()) partes.unshift(pai.textContent.trim());
                }
            }
            itens.push({pagina, nome, grupo: partes.join(' / ') || nome});
            paginas.add(pagina);
        });
        return itens;
    }

    function montarCatalogo(personalizados, descobertos) {
        const mapa = new Map();
        for (const item of CATALOGO_BASE) mapa.set(item.pagina, item);
        for (const item of validarEntradas(descobertos)) {
            if (!mapa.has(item.pagina)) mapa.set(item.pagina, item);
        }
        for (const item of validarEntradas(personalizados)) mapa.set(item.pagina, item);
        return Array.from(mapa.values()).sort(compararNomes);
    }

    function interpretarNumeroDaPagina(valor) {
        const simples = somentePagina(valor);
        if (simples) return simples;
        try {
            const url = new URL(String(valor || '').trim(), window.location.href);
            if (url.origin !== window.location.origin) return '';
            const p = url.searchParams.get('p');
            const partes = p ? p.split(':') : [];
            return partes[0] === CONFIG.appId ? somentePagina(partes[1]) : '';
        } catch { return ''; }
    }

    function criarPainel() {
        if (!estaNaPaginaInicial() || document.getElementById(CONFIG.hostId)) return;

        const host = document.createElement('div');
        host.id = CONFIG.hostId;
        host.dataset.lmAtalhos = 'true';
        document.body.appendChild(host);
        const shadow = host.attachShadow({mode: 'open'});

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            *, *::before, *::after { box-sizing: border-box; }
            button, input, select { font: inherit; }
            .camada {
                position: fixed; inset: 0; z-index: 2147483647;
                pointer-events: none; font-family: "Oracle Sans", "Segoe UI", Arial, sans-serif;
                color: #1e293b; font-size: 13px;
            }
            .dock {
                position: fixed; right: 0; bottom: 72px;
                display: flex; align-items: flex-end;
                width: min(392px, 100vw);
                max-height: calc(100vh - 85px);
                pointer-events: none;
                transform: translateX(calc(100% - 36px));
                transition: transform 230ms cubic-bezier(.2,.8,.2,1);
            }
            .dock.aberto { transform: translateX(0); }
            .guia {
                display: flex; flex: 0 0 36px; justify-content: center; align-items: center;
                width: 36px; height: 66px; margin-bottom: 12px; padding: 0;
                border: 1px solid #c7d2fe; border-right: 0;
                border-radius: 12px 0 0 12px;
                background: linear-gradient(180deg, #2563eb, #1d4ed8);
                box-shadow: -4px 6px 20px rgba(15, 23, 42, .22);
                color: white; font-size: 23px; font-weight: 700;
                cursor: pointer; pointer-events: auto;
            }
            .guia:hover { background: #1e40af; }
            .guia:focus-visible, .btn:focus-visible, .atalho:focus-visible,
            .opcao:focus-within, input:focus-visible, select:focus-visible {
                outline: 3px solid rgba(14,165,233,.35); outline-offset: 2px;
            }
            .guia-icone { display: block; transition: transform 200ms ease; }
            .dock.aberto .guia-icone { transform: rotate(180deg); }
            .painel {
                display: flex; flex-direction: column; flex: 1 1 auto;
                min-width: 0; max-height: calc(100vh - 92px);
                border: 1px solid #dbe3ec; border-right: 0;
                border-radius: 16px 0 0 16px;
                background: rgba(255, 255, 255, .99);
                box-shadow: 0 18px 45px rgba(15, 23, 42, .23);
                overflow: hidden; pointer-events: none;
            }
            .dock.aberto .painel { pointer-events: auto; }
            .topo { padding: 15px 14px 12px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
            .cabecalho { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
            .titulo { margin: 0; font-size: 16px; line-height: 1.25; color: #0f172a; font-weight: 800; }
            .subtitulo { margin: 5px 0 0; color: #64748b; font-size: 11px; line-height: 1.3; }
            .acoes { display: flex; gap: 6px; flex-shrink: 0; }
            .btn {
                display: inline-flex; justify-content: center; align-items: center; gap: 6px;
                min-height: 32px; padding: 7px 10px; border: 1px solid #dce4ee;
                border-radius: 9px; background: #f8fafc; color: #334155;
                text-decoration: none; cursor: pointer; font-size: 12px; font-weight: 700;
            }
            .btn:hover { background: #eff6ff; border-color: #93c5fd; }
            .btn-icone { width: 32px; padding: 0; font-size: 17px; }
            .btn-azul { background: #2563eb; border-color: #2563eb; color: #fff; }
            .btn-azul:hover { background: #1d4ed8; border-color: #1d4ed8; }
            .barra-acoes { display: flex; align-items: center; justify-content: space-between; gap: 9px; padding-top: 12px; }
            .contagem { font-weight: 700; font-size: 11px; color: #64748b; }
            .conteudo { overflow-y: auto; overscroll-behavior: contain; min-height: 0; padding: 12px; }
            .lista { display: grid; gap: 7px; }
            .atalho {
                display: grid; grid-template-columns: 31px minmax(0, 1fr) 14px;
                gap: 9px; align-items: center; min-height: 45px;
                padding: 6px 10px 6px 7px; width: 100%;
                border: 1px solid #e2e8f0; border-radius: 11px;
                background: #fff; color: #1e293b; text-decoration: none;
                transition: border-color 140ms, box-shadow 140ms, transform 140ms;
            }
            .atalho:hover { background: #eff6ff; border-color: #60a5fa; box-shadow: 0 5px 15px rgba(37,99,235,.11); transform: translateX(-2px); }
            .numero { display: grid; place-items: center; width: 31px; height: 31px;
                border-radius: 9px; background: linear-gradient(145deg,#1d4ed8,#2563eb);
                color: #fff; font-size: 12px; font-weight: 800; }
            .info { display: block; min-width: 0; }
            .nome { display: block; font-size: 12.5px; font-weight: 750; line-height: 1.25; overflow-wrap: anywhere; }
            .grupo-atalho { display: block; margin-top: 3px; color: #64748b; font-size: 10.5px; }
            .seta-link { color: #94a3b8; font-size: 19px; font-weight: 700; }
            .rodape { padding: 10px 12px; border-top: 1px solid #f1f5f9; text-align: center;
                color: #94a3b8; font-size: 10px; flex-shrink: 0; }
            .oculto { display: none !important; }
            .filtros { display: grid; gap: 8px; margin-top: 11px; }
            .campo, .seletor {
                width: 100%; min-height: 34px; padding: 8px 9px;
                border: 1px solid #cbd5e1; border-radius: 9px;
                background: #fff; color: #0f172a; font-size: 12px;
            }
            .campo::placeholder { color: #94a3b8; }
            .filtro-linha { display: flex; gap: 7px; }
            .abas-filtro { display: flex; gap: 5px; flex-wrap: wrap; }
            .filtro {
                background: #f1f5f9; border: 1px solid transparent;
                border-radius: 7px; padding: 6px 9px; cursor: pointer;
                color: #475569; font-size: 11px; font-weight: 700;
            }
            .filtro.ativo { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
            .catalogo { display: grid; gap: 6px; }
            .opcao {
                display: flex; align-items: center; gap: 10px;
                padding: 9px; border: 1px solid #e2e8f0;
                border-radius: 10px; background: #fff; cursor: pointer;
            }
            .opcao:hover { background: #f8fafc; }
            .opcao input[type="checkbox"] { appearance: auto; width: 17px; height: 17px;
                margin: 0; flex-shrink: 0; accent-color: #2563eb; cursor: pointer; }
            .opcao-info { min-width: 0; flex: 1; }
            .opcao-nome { display: block; color: #1e293b; font-weight: 750; font-size: 12px; overflow-wrap: anywhere; }
            .opcao-grupo { display: block; color: #64748b; font-size: 10px; margin-top: 3px; overflow-wrap: anywhere; }
            .pagina-chip { background: #f1f5f9; border-radius: 5px; padding: 4px 6px; font-size: 10px; color: #64748b; white-space: nowrap; }
            .remover-custom {
                width: 24px; height: 24px; border: 1px solid #fecaca; border-radius: 6px;
                background: #fff1f2; color: #be123c; font-size: 16px; cursor: pointer;
            }
            .secao-custom { margin-top: 14px; padding: 12px 10px; border: 1px solid #dbeafe;
                border-radius: 12px; background: #f8fbff; }
            .secao-custom h3 { margin: 0 0 8px; font-size: 12px; color: #0f172a; }
            .form-custom { display: grid; gap: 7px; }
            .form-custom .btn { justify-self: start; }
            .aviso { margin: 8px 0 0; font-size: 11px; color: #64748b; }
            .aviso.erro { color: #be123c; }
            .vazio { padding: 19px 11px; text-align: center; border: 1px dashed #cbd5e1;
                border-radius: 11px; color: #64748b; font-size: 12px; line-height: 1.5; }
            .gerenciar-rodape { margin-top: 13px; color: #64748b; font-size: 10px; line-height: 1.5; }
            @media (max-width: 520px) {
                .dock { width: min(390px, 100vw); bottom: 62px; max-height: calc(100vh - 72px); }
                .painel { max-height: calc(100vh - 78px); }
                .guia { height: 60px; }
                .topo { padding: 12px 10px; }
                .conteudo { padding: 10px; }
            }
            @media (prefers-reduced-motion: reduce) {
                .dock, .guia-icone, .atalho { transition: none !important; }
            }
        `;

        function el(tag, classe, texto) {
            const elemento = document.createElement(tag);
            if (classe) elemento.className = classe;
            if (texto !== undefined) elemento.textContent = texto;
            return elemento;
        }
        function botao(texto, classe, titulo) {
            const b = el('button', classe, texto);
            b.type = 'button';
            if (titulo) { b.title = titulo; b.setAttribute('aria-label', titulo); }
            return b;
        }

        const camada = el('div', 'camada');
        const dock = el('div', 'dock');
        const guia = botao('❯', 'guia', 'Mostrar atalhos rápidos');
        guia.textContent = '';
        const guiaIcone = el('span', 'guia-icone', '❮');
        guia.appendChild(guiaIcone);
        guia.setAttribute('aria-expanded', 'false');

        const painel = el('aside', 'painel');
        painel.id = 'lm-atalhos-painel';
        painel.setAttribute('aria-label', 'Atalhos rápidos do sistema');
        guia.setAttribute('aria-controls', painel.id);
        const topo = el('div', 'topo');
        const conteudo = el('div', 'conteudo');
        const rodape = el('div', 'rodape', 'As páginas usam automaticamente a sessão atual do Oracle APEX.');
        painel.append(topo, conteudo, rodape);
        dock.append(guia, painel);
        camada.appendChild(dock);
        shadow.append(style, camada);

        let ativos = new Set((() => {
            const dados = lerJSON(CONFIG.storageAtivos, null);
            return Array.isArray(dados) ? dados.map(somentePagina).filter(Boolean) : PAGINAS_PRINCIPAIS;
        })());
        let personalizados = validarEntradas(lerJSON(CONFIG.storagePersonalizados, []));
        let descobertos = validarEntradas(lerJSON(CONFIG.storageDescobertos, []));
        let catalogo = montarCatalogo(personalizados, descobertos);
        let aberto = lerEstadoSalvo();
        let tela = 'ativos';
        let busca = '';
        let filtro = 'todos';
        let area = 'todas';

        function atualizarCatalogo() { catalogo = montarCatalogo(personalizados, descobertos); }
        function salvarAtivos() { escreverJSON(CONFIG.storageAtivos, Array.from(ativos)); }
        function salvarPersonalizados() { escreverJSON(CONFIG.storagePersonalizados, personalizados); }
        function atualizaMenu() {
            const lidos = registrarMenuAtual();
            if (!lidos.length) return;
            const atual = new Map(descobertos.map(x => [x.pagina, x]));
            let mudou = false;
            for (const item of lidos) {
                if (CATALOGO_BASE.some(x => x.pagina === item.pagina)) continue;
                const anterior = atual.get(item.pagina);
                if (!anterior || anterior.nome !== item.nome || anterior.grupo !== item.grupo) {
                    atual.set(item.pagina, item); mudou = true;
                }
            }
            if (mudou) {
                descobertos = Array.from(atual.values());
                escreverJSON(CONFIG.storageDescobertos, descobertos);
                atualizarCatalogo();
                renderizar();
            }
        }

        function atualizarPainel(novoEstado, salvar = true) {
            aberto = Boolean(novoEstado);
            dock.classList.toggle('aberto', aberto);
            guia.setAttribute('aria-expanded', String(aberto));
            guia.title = aberto ? 'Ocultar atalhos rápidos' : 'Mostrar atalhos rápidos';
            guia.setAttribute('aria-label', guia.title);
            painel.setAttribute('aria-hidden', String(!aberto));
            painel.inert = !aberto;
            if (salvar) salvarEstado(aberto);
        }

        function mudarTela(proxima) {
            tela = proxima;
            renderizar();
            conteudo.scrollTop = 0;
        }

        function criarLink(item, indice, repetidos) {
            const link = el('a', 'atalho');
            link.href = hrefSeguro(item.pagina);
            link.dataset.pagina = item.pagina;
            link.title = `Abrir ${item.nome} — ${item.grupo}`;
            const numero = el('span', 'numero', String(indice + 1));
            const info = el('span', 'info');
            info.appendChild(el('span', 'nome', item.nome));
            if (repetidos.get(normalizarTexto(item.nome)) > 1) {
                info.appendChild(el('span', 'grupo-atalho', `${item.grupo} • Página ${item.pagina}`));
            }
            link.append(numero, info, el('span', 'seta-link', '›'));
            return link;
        }

        function renderAtivos() {
            topo.replaceChildren(); conteudo.replaceChildren();
            const cabecalho = el('div', 'cabecalho');
            const tituloArea = el('div');
            tituloArea.append(el('h2', 'titulo', 'Atalhos rápidos'),
                el('p', 'subtitulo', 'Acesso direto • Ordem alfabética (A–Z)'));
            const acoes = el('div', 'acoes');
            const inicio = el('a', 'btn btn-icone', '↗');
            inicio.href = hrefSeguro(CONFIG.homePageId);
            inicio.target = '_blank';
            inicio.rel = 'noopener noreferrer';
            inicio.title = 'Abrir Início em nova aba';
            inicio.setAttribute('aria-label', inicio.title);
            const fechar = botao('×', 'btn btn-icone', 'Ocultar painel');
            fechar.addEventListener('click', () => atualizarPainel(false));
            acoes.append(inicio, fechar); cabecalho.append(tituloArea, acoes);
            const barra = el('div', 'barra-acoes');
            const selecionados = catalogo.filter(x => ativos.has(x.pagina)).sort(compararNomes);
            barra.appendChild(el('span', 'contagem', `${selecionados.length} atalho${selecionados.length === 1 ? '' : 's'} ativo${selecionados.length === 1 ? '' : 's'}`));
            const configurar = botao('＋ Adicionar / organizar', 'btn btn-azul', 'Escolher atalhos visíveis');
            configurar.addEventListener('click', () => mudarTela('gerenciar'));
            barra.appendChild(configurar);
            topo.append(cabecalho, barra);

            if (!selecionados.length) {
                conteudo.appendChild(el('div', 'vazio', 'Nenhum atalho ativo. Clique em “Adicionar / organizar” para escolher suas páginas.'));
            } else {
                const nomes = new Map();
                selecionados.forEach(item => {
                    const chave = normalizarTexto(item.nome);
                    nomes.set(chave, (nomes.get(chave) || 0) + 1);
                });
                const lista = el('nav', 'lista');
                lista.setAttribute('aria-label', 'Atalhos ativos em ordem alfabética');
                selecionados.forEach((item, i) => lista.appendChild(criarLink(item, i, nomes)));
                conteudo.appendChild(lista);
            }
            rodape.textContent = 'As páginas usam automaticamente a sessão atual do Oracle APEX.';
        }

        function gerarAreas() {
            const nomes = Array.from(new Set(catalogo.map(x => x.grupo.split(' / ')[0])));
            return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR', {sensitivity: 'base'}));
        }

        function renderGerenciar() {
            const posicaoScroll = conteudo.scrollTop;
            topo.replaceChildren(); conteudo.replaceChildren();
            const cabecalho = el('div', 'cabecalho');
            const tituloArea = el('div');
            tituloArea.append(el('h2', 'titulo', 'Escolher atalhos'),
                el('p', 'subtitulo', 'Marque para exibir • Desmarque para ocultar'));
            const acoes = el('div', 'acoes');
            const voltar = botao('←', 'btn btn-icone', 'Voltar aos atalhos ativos');
            voltar.addEventListener('click', () => mudarTela('ativos'));
            const fechar = botao('×', 'btn btn-icone', 'Ocultar painel');
            fechar.addEventListener('click', () => atualizarPainel(false));
            acoes.append(voltar, fechar); cabecalho.append(tituloArea, acoes);

            const filtros = el('div', 'filtros');
            const pesquisa = el('input', 'campo');
            pesquisa.type = 'search'; pesquisa.placeholder = 'Buscar página, nome ou setor...';
            pesquisa.value = busca;
            pesquisa.setAttribute('aria-label', 'Pesquisar atalhos disponíveis');
            pesquisa.addEventListener('input', () => { busca = pesquisa.value; renderListaGerenciar(); });
            const linha = el('div', 'filtro-linha');
            const selecaoArea = el('select', 'seletor');
            selecaoArea.setAttribute('aria-label', 'Filtrar por área');
            const opcaoTodas = el('option', '', 'Todas as áreas');
            opcaoTodas.value = 'todas'; selecaoArea.appendChild(opcaoTodas);
            gerarAreas().forEach(nome => {
                const opt = el('option', '', nome);
                opt.value = nome; selecaoArea.appendChild(opt);
            });
            if (area !== 'todas' && !gerarAreas().includes(area)) area = 'todas';
            selecaoArea.value = area;
            selecaoArea.addEventListener('change', () => { area = selecaoArea.value; renderListaGerenciar(); });
            linha.appendChild(selecaoArea);
            const abas = el('div', 'abas-filtro');
            [['todos', 'Todos'], ['ativos', 'Ativos'], ['ocultos', 'Ocultos']].forEach(([valor, nome]) => {
                const b = botao(nome, `filtro${filtro === valor ? ' ativo' : ''}`);
                b.dataset.filtro = valor;
                b.setAttribute('aria-pressed', String(filtro === valor));
                b.addEventListener('click', () => {
                    filtro = valor;
                    abas.querySelectorAll('.filtro').forEach(x => {
                        const ativo = x.dataset.filtro === filtro;
                        x.classList.toggle('ativo', ativo);
                        x.setAttribute('aria-pressed', String(ativo));
                    });
                    renderListaGerenciar();
                });
                abas.appendChild(b);
            });
            filtros.append(pesquisa, linha, abas);
            topo.append(cabecalho, filtros);

            const quantidade = el('p', 'aviso');
            const lista = el('div', 'catalogo');
            lista.setAttribute('aria-label', 'Catálogo de atalhos');
            const secao = el('section', 'secao-custom');
            secao.appendChild(el('h3', '', 'Cadastrar uma página manualmente'));
            const formulario = el('form', 'form-custom');
            const nome = el('input', 'campo');
            nome.type = 'text'; nome.maxLength = 90; nome.placeholder = 'Nome do novo atalho'; nome.required = true;
            nome.setAttribute('aria-label', 'Nome do novo atalho');
            const pagina = el('input', 'campo');
            pagina.type = 'text'; pagina.placeholder = 'Nº da página ou link f?p=2001:...'; pagina.required = true;
            pagina.setAttribute('aria-label', 'Número ou link da página');
            const adicionar = el('button', 'btn btn-azul', '＋ Salvar e ativar');
            adicionar.type = 'submit';
            const aviso = el('p', 'aviso', 'Use o número de página do Oracle APEX (ex.: 280) ou seu link interno.');
            formulario.append(nome, pagina, adicionar);
            secao.append(formulario, aviso);
            formulario.addEventListener('submit', event => {
                event.preventDefault();
                const numero = interpretarNumeroDaPagina(pagina.value);
                const texto = nome.value.trim();
                if (!texto || !numero) {
                    aviso.textContent = 'Informe um nome e uma página válida do mesmo sistema (aplicativo 2001).';
                    aviso.classList.add('erro'); return;
                }
                const existente = catalogo.find(x => x.pagina === numero);
                if (existente) {
                    ativos.add(numero); salvarAtivos();
                    aviso.textContent = `“${existente.nome}” já existe no catálogo e foi ativado.`;
                } else {
                    personalizados.push({pagina: numero, nome: texto.slice(0, 90), grupo: 'Personalizados'});
                    salvarPersonalizados(); ativos.add(numero); salvarAtivos(); atualizarCatalogo();
                    aviso.textContent = `“${texto}” foi salvo e ativado.`;
                }
                aviso.classList.remove('erro');
                formulario.reset();
                // Conserva o formulário e a busca para continuar adicionando outras páginas.
                atualizarSeletorArea(selecaoArea);
                renderListaGerenciar();
            });
            conteudo.append(quantidade, lista, secao,
                el('p', 'gerenciar-rodape', 'As escolhas ficam salvas neste navegador. Páginas que surgirem no menu do sistema também serão adicionadas ao catálogo como ocultas.'));

            function atualizarSeletorArea(seletor) {
                const escolhido = seletor.value;
                seletor.replaceChildren();
                const t = el('option', '', 'Todas as áreas'); t.value = 'todas'; seletor.append(t);
                gerarAreas().forEach(v => { const op = el('option', '', v); op.value = v; seletor.append(op); });
                seletor.value = Array.from(seletor.options).some(op => op.value === escolhido) ? escolhido : 'todas';
                area = seletor.value;
            }

            function renderListaGerenciar() {
                const anterior = lista.scrollTop;
                lista.replaceChildren();
                const termo = normalizarTexto(busca.trim());
                const filtrados = catalogo.filter(item => {
                    if (area !== 'todas' && item.grupo.split(' / ')[0] !== area) return false;
                    if (filtro === 'ativos' && !ativos.has(item.pagina)) return false;
                    if (filtro === 'ocultos' && ativos.has(item.pagina)) return false;
                    return !termo || normalizarTexto(`${item.nome} ${item.grupo} ${item.pagina}`).includes(termo);
                });
                const ativosConhecidos = catalogo.filter(x => ativos.has(x.pagina)).length;
                quantidade.textContent = `${ativosConhecidos} ativo${ativosConhecidos === 1 ? '' : 's'} • ${catalogo.length - ativosConhecidos} oculto${catalogo.length - ativosConhecidos === 1 ? '' : 's'} • ${filtrados.length} resultado${filtrados.length === 1 ? '' : 's'}`;
                if (!filtrados.length) lista.append(el('div', 'vazio', 'Nenhum caminho encontrado para este filtro.'));
                for (const item of filtrados) {
                    const linha = el('label', 'opcao');
                    const check = el('input');
                    check.type = 'checkbox'; check.checked = ativos.has(item.pagina);
                    check.setAttribute('aria-label', `Exibir ${item.nome} (página ${item.pagina})`);
                    check.addEventListener('change', () => {
                        if (check.checked) ativos.add(item.pagina);
                        else ativos.delete(item.pagina);
                        salvarAtivos();
                        const y = conteudo.scrollTop;
                        renderListaGerenciar();
                        conteudo.scrollTop = y;
                    });
                    const info = el('span', 'opcao-info');
                    info.append(el('span', 'opcao-nome', item.nome), el('span', 'opcao-grupo', item.grupo));
                    linha.append(check, info, el('span', 'pagina-chip', `P. ${item.pagina}`));
                    if (personalizados.some(x => x.pagina === item.pagina)) {
                        const remover = botao('×', 'remover-custom', `Excluir atalho personalizado ${item.nome}`);
                        remover.addEventListener('click', e => {
                            e.preventDefault(); e.stopPropagation();
                            if (!window.confirm(`Excluir o atalho personalizado “${item.nome}”?`)) return;
                            personalizados = personalizados.filter(x => x.pagina !== item.pagina);
                            ativos.delete(item.pagina); salvarAtivos(); salvarPersonalizados();
                            atualizarCatalogo();
                            atualizarSeletorArea(selecaoArea);
                            renderListaGerenciar();
                        });
                        linha.append(remover);
                    }
                    lista.append(linha);
                }
                lista.scrollTop = anterior;
            }

            renderListaGerenciar();
            conteudo.scrollTop = posicaoScroll;
            rodape.textContent = 'Selecione somente os caminhos que deseja no painel principal.';
        }

        function renderizar() {
            if (tela === 'gerenciar') renderGerenciar();
            else renderAtivos();
        }

        guia.addEventListener('click', () => atualizarPainel(!aberto));
        document.addEventListener('keydown', evento => {
            if (evento.key === 'Escape' && aberto) atualizarPainel(false);
        });
        // Recria o href no momento do clique: nunca reutiliza uma sessão antiga.
        shadow.addEventListener('pointerdown', evento => {
            const link = evento.target?.closest?.('a.atalho, a[title="Abrir Início em nova aba"]');
            if (!link) return;
            const pagina = link.dataset.pagina || CONFIG.homePageId;
            try { link.href = criarUrlDestino(pagina); }
            catch (erro) { evento.preventDefault(); window.alert(erro.message); }
        });
        shadow.addEventListener('click', evento => {
            const link = evento.target?.closest?.('a.atalho, a[title="Abrir Início em nova aba"]');
            if (!link) return;
            const pagina = link.dataset.pagina || CONFIG.homePageId;
            try { link.href = criarUrlDestino(pagina); }
            catch (erro) { evento.preventDefault(); window.alert(erro.message); }
        });

        renderizar();
        atualizarPainel(aberto, false);
        atualizaMenu();
        const menu = document.querySelector('#t_TreeNav');
        if (menu && window.MutationObserver) {
            let timeout = null;
            const observador = new MutationObserver(() => {
                window.clearTimeout(timeout);
                timeout = window.setTimeout(atualizaMenu, 350);
            });
            observador.observe(menu, {childList: true, subtree: true});
        }
    }

    // Mantém a personalização do logotipo vermelho da versão original.
    function adicionarNomeVermelho() {
        if (!estaNoSistema() || document.getElementById('lm-optimus-red')) return;
        const containerLogo = document.querySelector('.t-Header-logo');
        const linkOriginal = document.querySelector('.t-Header-logo-link');
        const imgOriginal = document.querySelector('.t-Header-logo-link img');
        if (!containerLogo || !imgOriginal) return;
        const linkNovo = document.createElement('a');
        linkNovo.id = 'lm-optimus-red';
        linkNovo.target = '_blank';
        linkNovo.rel = 'noopener noreferrer';
        linkNovo.title = 'Abrir Início em nova aba';
        linkNovo.style.cssText = 'margin-left:10px!important;cursor:pointer!important;display:flex!important;align-items:center!important;';
        const imgNova = imgOriginal.cloneNode(true);
        imgNova.id = 'lm-optimus-img-red';
        const alturaOriginal = imgOriginal.clientHeight || 32;
        imgNova.style.cssText = `
            filter:invert(24%) sepia(90%) saturate(3195%) hue-rotate(349deg) brightness(93%) contrast(94%)!important;
            display:block!important;height:${alturaOriginal}px!important;width:auto!important;max-height:100%!important;`;
        linkNovo.appendChild(imgNova);
        linkNovo.href = hrefSeguro(CONFIG.homePageId);
        linkNovo.addEventListener('pointerenter', () => {
            linkNovo.href = hrefSeguro(CONFIG.homePageId);
        });
        linkNovo.addEventListener('click', evento => {
            try { linkNovo.href = criarUrlDestino(CONFIG.homePageId); }
            catch (erro) { evento.preventDefault(); window.alert(erro.message); }
        });
        containerLogo.style.setProperty('display', 'flex', 'important');
        containerLogo.style.setProperty('align-items', 'center', 'important');
        containerLogo.style.setProperty('height', '100%', 'important');
        if (linkOriginal) linkOriginal.insertAdjacentElement('afterend', linkNovo);
        else containerLogo.appendChild(linkNovo);
    }

    function iniciar() {
        if (!estaNoSistema()) return;
        adicionarNomeVermelho();
        if (estaNaPaginaInicial()) {
            try { criarPainel(); }
            catch (erro) { console.error('[Atalhos rápidos] Erro ao criar painel:', erro); }
            return;
        }
        // Compatibilidade com inicialização tardia do Oracle APEX.
        let tentativas = 0;
        const timer = window.setInterval(() => {
            tentativas += 1;
            adicionarNomeVermelho();
            if (estaNaPaginaInicial()) {
                window.clearInterval(timer);
                criarPainel();
            } else if (tentativas >= 30) {
                window.clearInterval(timer);
            }
        }, 500);
    }
    // Se o APEX demorar para montar os inputs, aguarda um curto período.
    if (estaNoSistema()) iniciar();
    else {
        let tentativas = 0;
        const timer = window.setInterval(() => {
            tentativas++;
            if (estaNoSistema()) { window.clearInterval(timer); iniciar(); }
            else if (tentativas >= 16) window.clearInterval(timer);
        }, 400);
    }
})();
