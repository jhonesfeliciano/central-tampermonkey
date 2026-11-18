// @central-id romance-atalhos-nota-de-venda
// @central-name Romance | Atalhos da Nota de Venda
// @central-version 1.1.0
// @central-match https://*/apex/*
// @central-match http://*/apex/*
// @central-match https://*/ords/*
// @central-match http://*/ords/*
// @central-match https://*/f?p=2001*
// @central-match http://*/f?p=2001*
// @central-enabled true

// Módulo para Central GitHub / Script Mestre V2.0.
// Coloque este arquivo em scripts/ no GitHub. NÃO instale no Tampermonkey.
// A interface aparece somente na página 37 do aplicativo APEX 2001.
// Mantém os cinco atalhos ao lado de "Cadastro de Nota de Venda".

(function () {
    'use strict';

    const TITLE_ID = 'R13077664319442333_heading';
    const NAV_ID = 'romance-atalhos-nota-venda';
    const SECTIONS = [
        ['Classificações', 'R1405627384277436444'],
        ['Assinaturas Realizadas', 'R5589907778244058232'],
        ['Históricos', 'R31973843747897227'],
        ['Correções', 'R18553773791794851'],
        ['Itens da Nota', 'R14893787745768394']
    ];

    function isNotePage() {
        const app = document.getElementById('pFlowId')?.value;
        const page = document.getElementById('pFlowStepId')?.value;

        // Identificação prioritária e exata pelos campos do Oracle APEX.
        if (app && page) return app === '2001' && page === '37';

        // Caso a Central carregue antes dos campos ocultos, use a URL ou o
        // título específico como confirmação, sem mostrar atalhos em outras telas.
        if (/[?&]p=2001(?::|%3A)37(?::|%3A|&|#|$)/i.test(location.href)) return true;
        const title = document.getElementById(TITLE_ID);
        return !!title && /cadastro de nota de venda/i.test(title.textContent || '');
    }

    function goToSection(id) {
        const region = document.getElementById(id);
        if (!region) return;

        // Evita que o cabeçalho fixo do APEX esconda o título da seção.
        const header = document.getElementById('t_Header');
        let offset = 12;
        if (header) {
            const position = getComputedStyle(header).position;
            const rect = header.getBoundingClientRect();
            if (position === 'fixed' || position === 'sticky') {
                offset += Math.max(0, rect.bottom);
            }
        }

        region.style.scrollMarginTop = `${offset}px`;
        region.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    }

    function mount() {
        if (!isNotePage()) return;
        if (document.getElementById(NAV_ID)) return;
        const title = document.getElementById(TITLE_ID);
        if (!title || !title.parentElement) return;

        // Mantém os atalhos ao lado do título, sem mudar controles do APEX.
        const titleGroup = title.parentElement;
        Object.assign(titleGroup.style, {
            display: 'flex', alignItems: 'center', flexWrap: 'wrap',
            minWidth: '0', gap: '6px'
        });
        title.style.flex = '0 0 auto';

        const nav = document.createElement('nav');
        nav.id = NAV_ID;
        nav.setAttribute('aria-label', 'Atalhos das seções da nota');
        Object.assign(nav.style, {
            display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap',
            gap: '5px', marginInlineStart: '8px', minWidth: '0'
        });

        for (const [label, id] of SECTIONS) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 't-Button t-Button--small';
            button.textContent = `↪${label}`;
            button.title = `Ir para ${label}`;
            button.setAttribute('aria-controls', id);
            Object.assign(button.style, {
                fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap',
                padding: '5px 8px', minHeight: '26px', margin: '0',
                cursor: 'pointer', lineHeight: '1.2'
            });
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                goToSection(id);
            });
            nav.appendChild(button);
        }

        title.insertAdjacentElement('afterend', nav);
    }

    function start() {
        if (!document.body) return;

        // Se o APEX já identificou outra página, não instala observadores.
        const app = document.getElementById('pFlowId')?.value;
        const page = document.getElementById('pFlowStepId')?.value;
        if (app && page && !isNotePage()) return;

        mount();

        // Recria os atalhos se o APEX atualizar o cabeçalho por AJAX.
        // Um único agendamento por frame evita trabalhos repetidos.
        let scheduled = false;
        function scheduleMount() {
            if (scheduled || document.getElementById(NAV_ID)) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                mount();
            });
        }

        const observer = new MutationObserver(mutations => {
            if (document.getElementById(NAV_ID)) return;
            if (mutations.some(m => m.addedNodes.length || m.removedNodes.length)) {
                scheduleMount();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('apexafterrefresh', scheduleMount);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
