// @central-id oracle-apex-setas-fisicas-selecao-azul-piscina
// @central-name Oracle APEX - Setas Físicas + Seleção Azul Piscina
// @central-version 4.1.0
// @central-match https://*/ords/*
// @central-match http://*/ords/*
// @central-match https://*/apex/*
// @central-match http://*/apex/*
// @central-match https://*/*
// @central-match http://*/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function () {
    'use strict';

    const INSTANCE_KEY = '__TM_APEX_SETAS_TECLADO_V4_1__';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const BUTTON_ID = 'tm-apex-key-scroll-toggle-v4-1';
    const STYLE_ID = 'tm-apex-key-scroll-style-v4-1';
    const STORAGE_KEY = 'tm-apex-arrow-keyboard-mode-v4-1';
    const DOUBLE_CLICK_MS = 290;
    const STEP_RATIO = 0.8;

    // Modos: off = desativado; full = início/fim; steps = rolagem por etapas.
    let mode = 'off';
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'off' || saved === 'full' || saved === 'steps') mode = saved;
    } catch (_) {
        // Funciona normalmente mesmo em páginas que bloqueiam o armazenamento.
    }

    let clickTimer = null;
    let lastContentTarget = null;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        /* Azul-piscina ao selecionar textos, inclusive em regiões do APEX. */
        html::selection, body::selection, html *::selection {
            background-color: #40D9D3 !important;
            color: #062D33 !important;
        }
        html::-moz-selection, body::-moz-selection, html *::-moz-selection {
            background-color: #40D9D3 !important;
            color: #062D33 !important;
        }

        #${BUTTON_ID} {
            position: fixed !important;
            left: 6px !important;
            bottom: 35px !important;
            z-index: 2147483647 !important;
            box-sizing: border-box !important;
            width: 56px !important;
            height: 56px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 2px !important;
            border: 1px solid rgba(255,255,255,.35) !important;
            border-radius: 50% !important;
            padding: 3px !important;
            color: #fff !important;
            background: #667085 !important;
            box-shadow: 0 3px 12px rgba(0,0,0,.27) !important;
            cursor: pointer !important;
            font-family: Arial, sans-serif !important;
            font-weight: 700 !important;
            line-height: 1.05 !important;
            text-align: center !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            transition: background .2s, transform .2s, box-shadow .2s !important;
        }
        #${BUTTON_ID}:hover {
            transform: scale(1.06) !important;
            box-shadow: 0 5px 15px rgba(0,0,0,.3) !important;
        }
        #${BUTTON_ID}:focus-visible {
            outline: 3px solid #40D9D3 !important;
            outline-offset: 3px !important;
        }
        #${BUTTON_ID}[data-mode="full"] { background: #0066EF !important; }
        #${BUTTON_ID}[data-mode="steps"] { background: #079E76 !important; }
        #${BUTTON_ID} .tm-apex-scroll-symbol {
            font-size: 17px !important;
            line-height: 1 !important;
            letter-spacing: 0 !important;
            pointer-events: none !important;
        }
        #${BUTTON_ID} .tm-apex-scroll-label {
            font-size: 9px !important;
            line-height: 1.08 !important;
            letter-spacing: .2px !important;
            pointer-events: none !important;
        }
        @media (max-width: 768px) {
            #${BUTTON_ID} {
                width: 51px !important;
                height: 51px !important;
                left: 4px !important;
                bottom: 25px !important;
            }
        }
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');

    function saveMode() {
        try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) { /* opcional */ }
    }

    function updateButton() {
        button.dataset.mode = mode;
        const label = mode === 'full' ? 'TOTAL' : mode === 'steps' ? 'ETAPAS' : 'OFF';
        button.innerHTML = '<span class="tm-apex-scroll-symbol">↕</span>' +
                           '<span class="tm-apex-scroll-label">' + label + '</span>';
        button.setAttribute('aria-label',
            mode === 'off' ? 'Rolagem desativada. Um clique ativa as setas para rolagem completa; dois cliques ativam a rolagem por etapas.' :
            mode === 'full' ? 'Rolagem completa ativada: seta para cima vai ao início e seta para baixo vai ao final. Clique para desligar ou dê dois cliques para mudar para etapas.' :
                              'Rolagem por etapas ativada: seta para cima sobe 80% da tela e seta para baixo desce 80%. Clique para mudar para rolagem completa.');
        button.setAttribute('aria-pressed', mode === 'off' ? 'false' : 'true');
        button.title = 'Atual: ' + label + '\n1 clique: TOTAL (se já estiver no TOTAL, desliga)\n2 cliques: ETAPAS\nTeclas físicas: ↑ = subir | ↓ = descer';
    }

    function setMode(nextMode) {
        mode = nextMode;
        updateButton();
        saveMode();
        // Depois de clicar, as setas devem atuar na página, e não no próprio botão.
        button.blur();
    }

    // Aguarda alguns milissegundos para diferenciar 1 clique de 2 cliques.
    button.addEventListener('click', function (event) {
        if (event.detail >= 2) {
            if (clickTimer !== null) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            setMode('steps');
            return;
        }
        if (clickTimer !== null) clearTimeout(clickTimer);
        clickTimer = setTimeout(function () {
            clickTimer = null;
            setMode(mode === 'full' ? 'off' : 'full');
        }, DOUBLE_CLICK_MS);
    });

    button.addEventListener('dblclick', function (event) {
        event.preventDefault();
    });

    // Mantém a referência de uma região interna (ex.: grade APEX) escolhida pelo usuário.
    document.addEventListener('pointerdown', function (event) {
        const target = event.target;
        if (target instanceof Element && !button.contains(target)) {
            lastContentTarget = target;
        }
    }, true);

    function isEditable(node) {
        if (!(node instanceof Element)) return false;
        if (node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="grid"], [role="tree"], [role="slider"]')) return true;
        return node.isContentEditable;
    }

    function scrollableAncestor(node) {
        let el = node instanceof Element ? node : null;
        while (el && el !== document.documentElement && el !== document.body) {
            if (el !== button && !button.contains(el) &&
                el.scrollHeight > el.clientHeight + 3) {
                const overflowY = getComputedStyle(el).overflowY;
                if (/^(auto|scroll|overlay)$/.test(overflowY)) return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function scrollTarget(eventTarget) {
        const focused = document.activeElement;
        if (focused && focused !== button && focused !== document.body &&
            focused !== document.documentElement) {
            const fromFocus = scrollableAncestor(focused);
            if (fromFocus) return fromFocus;
        }

        // Em algumas tabelas APEX a barra de rolagem pertence a uma região interna.
        const fromEvent = scrollableAncestor(eventTarget);
        if (fromEvent) return fromEvent;
        if (lastContentTarget && lastContentTarget.isConnected) {
            const fromLastClick = scrollableAncestor(lastContentTarget);
            if (fromLastClick) return fromLastClick;
        }
        return document.scrollingElement || document.documentElement;
    }

    function scrollWithKey(target, direction) {
        const isDocument = target === document.scrollingElement ||
                           target === document.documentElement || target === document.body;
        const visibleHeight = isDocument ? window.innerHeight : target.clientHeight;
        const maxTop = Math.max(0, target.scrollHeight - visibleHeight);
        if (mode === 'full') {
            // O modo TOTAL vai diretamente ao extremo, mesmo em páginas muito longas.
            const top = direction === 'up' ? 0 : maxTop;
            if (isDocument) window.scrollTo({top: top, behavior: 'instant'});
            else target.scrollTo({top: top, behavior: 'instant'});
        } else {
            // Mantém a proporção de 80% da altura visível do script anterior.
            const delta = visibleHeight * STEP_RATIO * (direction === 'up' ? -1 : 1);
            if (isDocument) window.scrollBy({top: delta, behavior: 'smooth'});
            else target.scrollBy({top: delta, behavior: 'smooth'});
        }
    }

    document.addEventListener('keydown', function (event) {
        // Preserva o atalho da versão anterior (Alt+M), agora com três estados.
        if (event.altKey && !event.ctrlKey && !event.metaKey &&
            String(event.key).toLowerCase() === 'm') {
            if (isEditable(event.target)) return;
            event.preventDefault();
            setMode(mode === 'off' ? 'full' : mode === 'full' ? 'steps' : 'off');
            return;
        }

        if (mode === 'off' || event.defaultPrevented || event.altKey ||
            event.ctrlKey || event.metaKey || event.shiftKey || isEditable(event.target)) return;

        const direction = event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down' : null;
        if (!direction) return;

        event.preventDefault();
        event.stopPropagation();
        scrollWithKey(scrollTarget(event.target), direction);
    }, true);

    updateButton();

    function ensureVisible() {
        if (!style.isConnected && document.head) document.head.appendChild(style);
        if (!button.isConnected && document.body) document.body.appendChild(button);
    }
    ensureVisible();

    // Regiões APEX podem ser reconstruídas por AJAX. Recoloca o botão, se necessário.
    const observer = new MutationObserver(ensureVisible);
    observer.observe(document.documentElement, {childList: true, subtree: true});
})();
