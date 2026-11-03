// @central-id romance-selecionar-checkbox-linha
// @central-name Romance - Selecionar Checkbox clicando na linha
// @central-version 1.1.0
// @central-match https://sistema.romancemoda.com.br/*
// @central-match http://sistema.romancemoda.com.br/*
// @central-enabled true

// Módulo para a Central GitHub. Não instalar diretamente no Tampermonkey.
// Preserva a lógica original e tolera carregamento tardio do Oracle APEX.

(function () {
    'use strict';

    const APP_ID_PERMITIDO = '2001';
    const ID_ESTILO = 'tm-linha-checkbox-style';
    let atualizacaoPendente = false;

    function ehSistemaPermitido() {
        // Oracle APEX costuma expor o ID do aplicativo neste campo.
        const flowId = document.querySelector('#pFlowId, input[name="p_flow_id"]');
        if (flowId && String(flowId.value) === APP_ID_PERMITIDO) {
            return true;
        }

        // Fallback para páginas do mesmo sistema que possuam indicação do APP no HTML.
        const htmlClass = document.documentElement.className || '';
        const bodyClass = document.body?.className || '';

        let appNaUrl = false;
        try {
            appNaUrl = (new URL(location.href).searchParams.get('p') || '').split(':')[0] === APP_ID_PERMITIDO;
        } catch (_) {}
        return appNaUrl ||
            htmlClass.includes('app-F100020002000') ||
            bodyClass.includes('app-F100020002000');
    }

    function elementoVisivel(el) {
        if (!el) return false;

        const style = window.getComputedStyle(el);

        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            el.getClientRects().length > 0
        );
    }

    function encontrarLinha(elemento) {
        if (!(elemento instanceof Element)) return null;

        return elemento.closest(
            'tr, .a-GV-row, [role="row"], .t-Report-row'
        );
    }

    function ehCabecalho(linha) {
        if (!linha) return true;

        if (linha.closest('thead')) return true;
        if (linha.classList.contains('a-GV-header')) return true;
        if (linha.getAttribute('role') === 'rowheader') return true;

        // Evita transformar linhas compostas exclusivamente por cabeçalhos em linhas selecionáveis.
        const celulas = linha.querySelectorAll(':scope > th, :scope > td');
        if (celulas.length && [...celulas].every(c => c.tagName === 'TH')) {
            return true;
        }

        return false;
    }

    function checkboxesDaLinha(linha) {
        return [...linha.querySelectorAll('input[type="checkbox"]')]
            .filter(cb => !cb.disabled && elementoVisivel(cb));
    }

    function alvoInterativo(target) {
        if (!(target instanceof Element)) return false;

        return !!target.closest([
            'input',
            'button',
            'a',
            'select',
            'textarea',
            'label',
            '[role="button"]',
            '[contenteditable="true"]',
            '.a-Button',
            '.t-Button'
        ].join(','));
    }

    function alternarCheckbox(checkbox) {
        if (!checkbox || checkbox.disabled) return;

        // click() é usado de propósito para manter os eventos originais
        // do Oracle APEX e demais scripts da página.
        checkbox.click();
    }

    function processarClique(event) {
        if (!ehSistemaPermitido()) return;
        if (event.defaultPrevented) return;

        const target = event.target;

        // Se clicou diretamente em um controle, deixa o comportamento original ocorrer.
        if (alvoInterativo(target)) return;

        const linha = encontrarLinha(target);
        if (!linha || ehCabecalho(linha)) return;

        const checks = checkboxesDaLinha(linha);

        // Regra segura:
        // só faz a seleção pela linha quando existe exatamente um checkbox
        // de dados visível/habilitado naquela linha.
        if (checks.length !== 1) return;

        alternarCheckbox(checks[0]);
    }

    function atualizarVisualDasLinhas(root = document) {
        if (!ehSistemaPermitido()) return;

        const checks = root.querySelectorAll?.('input[type="checkbox"]') || [];

        checks.forEach(cb => {
            if (cb.disabled || !elementoVisivel(cb)) return;

            const linha = encontrarLinha(cb);
            if (!linha || ehCabecalho(linha)) return;

            const checksLinha = checkboxesDaLinha(linha);
            if (checksLinha.length !== 1) return;

            linha.classList.add('tm-linha-com-checkbox');
        });
    }

    function instalarEstilo() {
        if (document.getElementById(ID_ESTILO)) return;

        const style = document.createElement('style');
        style.id = ID_ESTILO;
        style.textContent = `
            .tm-linha-com-checkbox {
                cursor: pointer !important;
            }

            .tm-linha-com-checkbox:hover > td,
            .tm-linha-com-checkbox:hover {
                background-color: rgba(40, 120, 255, 0.045);
            }

            .tm-linha-com-checkbox:has(input[type="checkbox"]:checked) > td {
                background-color: rgba(40, 120, 255, 0.075);
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    function agendarVisual() {
        if (atualizacaoPendente || !ehSistemaPermitido()) return;
        atualizacaoPendente = true;
        requestAnimationFrame(() => {
            atualizacaoPendente = false;
            atualizarVisualDasLinhas();
        });
    }

    function iniciar() {
        // O Mestre executa em document-idle: o listener deve funcionar
        // mesmo quando o APEX só disponibilizar o appId alguns instantes depois.
        instalarEstilo();
        document.addEventListener('click', processarClique, false);

        // Regiões APEX renderizadas/atualizadas por AJAX são monitoradas.
        const observer = new MutationObserver(mutations => {
            if (mutations.some(m => m.addedNodes && m.addedNodes.length)) agendarVisual();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('apexafterrefresh', agendarVisual);

        // Reavalia a identificação do APP 2001 durante o carregamento tardio.
        agendarVisual();
        let tentativas = 0;
        const espera = setInterval(() => {
            tentativas++;
            if (ehSistemaPermitido()) {
                clearInterval(espera);
                agendarVisual();
            } else if (tentativas >= 50) {
                clearInterval(espera);
            }
        }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
})();
