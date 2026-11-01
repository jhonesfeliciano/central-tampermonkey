// @central-id oracle-apex-setas-fisicas-botao-flutuante-recolhivel
// @central-name Oracle APEX - Setas Físicas + Botão Flutuante Recolhível
// @central-version 4.2.0
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

    // Esta versão substitui a V4.1. Deixe apenas esta versão habilitada no Tampermonkey.
    const INSTANCE_KEY = '__TM_APEX_SETAS_TECLADO_V4_2__';
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const ROOT_ID = 'tm-apex-arrows-v42-root';
    const STYLE_ID = 'tm-apex-arrows-v42-style';
    const MAIN_ID = 'tm-apex-arrows-v42-main';
    const HIDE_ID = 'tm-apex-arrows-v42-hide';
    const MODE_KEY = 'tm-apex-arrow-keyboard-mode-v4-1'; // Mantém preferência da V4.1.
    const UI_KEY = 'tm-apex-floating-ui-v4-2';
    const DOUBLE_CLICK_MS = 290;
    const STEP_RATIO = 0.8;
    const MAIN_SIZE = 56;
    const TAB_SIZE = 22;
    const TAB_GAP = 4;
    const FULL_WIDTH = MAIN_SIZE + TAB_GAP + TAB_SIZE;
    const FULL_HEIGHT = MAIN_SIZE;
    const COLLAPSED_HEIGHT = 42;
    const DRAG_SLOP = 6;

    let mode = 'off';
    try {
        const previousMode = localStorage.getItem(MODE_KEY);
        if (['off', 'full', 'steps'].includes(previousMode)) mode = previousMode;
    } catch (_) {}

    let ui = { x: 6, y: Math.max(0, innerHeight - 91), collapsed: false, edge: 'left' };
    try {
        const previousUI = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
        if (previousUI && Number.isFinite(previousUI.x) && Number.isFinite(previousUI.y)) {
            ui.x = previousUI.x;
            ui.y = previousUI.y;
            ui.collapsed = previousUI.collapsed === true;
            ui.edge = previousUI.edge === 'right' ? 'right' : 'left';
        }
    } catch (_) {}

    let clickTimer = null;
    let drag = null;
    let suppressMainClickUntil = 0;
    let suppressTabClickUntil = 0;
    let lastContentTarget = null;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        html::selection, body::selection, html *::selection {
            background: #40D9D3 !important;
            color: #062D33 !important;
        }
        html::-moz-selection, body::-moz-selection, html *::-moz-selection {
            background: #40D9D3 !important;
            color: #062D33 !important;
        }
        #${ROOT_ID} {
            position: fixed !important;
            z-index: 2147483647 !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            width: ${FULL_WIDTH}px !important;
            height: ${FULL_HEIGHT}px !important;
            font-family: Arial, sans-serif !important;
            background: transparent !important;
            border: none !important;
            outline: none !important;
            pointer-events: none !important;
            transform: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }
        #${ROOT_ID} *, #${ROOT_ID} *::before, #${ROOT_ID} *::after {
            box-sizing: border-box !important;
        }
        #${ROOT_ID} button {
            pointer-events: auto !important;
            position: absolute !important;
            margin: 0 !important;
            font-family: Arial, sans-serif !important;
            color: #fff !important;
            cursor: pointer !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            touch-action: none !important;
            -webkit-tap-highlight-color: transparent !important;
            box-shadow: 0 3px 11px rgba(0,0,0,.30) !important;
            transition: background-color .18s, box-shadow .18s !important;
        }
        #${ROOT_ID} button:focus-visible {
            outline: 3px solid #40D9D3 !important;
            outline-offset: 2px !important;
        }
        #${MAIN_ID} {
            width: ${MAIN_SIZE}px !important;
            height: ${MAIN_SIZE}px !important;
            top: 0 !important;
            left: 0 !important;
            background: #667085 !important;
            border: 1px solid rgba(255,255,255,.45) !important;
            border-radius: 50% !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 1px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            text-align: center !important;
            cursor: grab !important;
        }
        #${MAIN_ID}:active { cursor: grabbing !important; }
        #${MAIN_ID}[data-mode="full"] { background: #0066EF !important; }
        #${MAIN_ID}[data-mode="steps"] { background: #079E76 !important; }
        #${MAIN_ID} .tm-apex-v42-symbol {
            font-size: 18px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            color: #fff !important;
            pointer-events: none !important;
        }
        #${MAIN_ID} .tm-apex-v42-label {
            font-size: 9px !important;
            font-weight: 700 !important;
            line-height: 1.1 !important;
            color: #fff !important;
            pointer-events: none !important;
        }
        #${HIDE_ID} {
            width: ${TAB_SIZE}px !important;
            height: ${COLLAPSED_HEIGHT}px !important;
            left: ${MAIN_SIZE + TAB_GAP}px !important;
            top: 7px !important;
            padding: 0 !important;
            background: #294263 !important;
            border: 1px solid rgba(255,255,255,.45) !important;
            border-radius: 9px !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            font-size: 22px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
        }
        #${HIDE_ID}:hover { background: #1762A7 !important; }
        #${ROOT_ID}[data-collapsed="true"] {
            width: ${TAB_SIZE}px !important;
            height: ${COLLAPSED_HEIGHT}px !important;
        }
        #${ROOT_ID}[data-collapsed="true"] #${MAIN_ID} { display: none !important; }
        #${ROOT_ID}[data-collapsed="true"] #${HIDE_ID} {
            left: 0 !important;
            top: 0 !important;
            border-radius: 0 11px 11px 0 !important;
            background: #294263 !important;
        }
        #${ROOT_ID}[data-collapsed="true"][data-edge="right"] #${HIDE_ID} {
            border-radius: 11px 0 0 11px !important;
        }
    `;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Controle flutuante das setas físicas do teclado');

    const main = document.createElement('button');
    main.id = MAIN_ID;
    main.type = 'button';
    main.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');
    main.innerHTML = '<span class="tm-apex-v42-symbol">↕</span><span class="tm-apex-v42-label">OFF</span>';

    const hide = document.createElement('button');
    hide.id = HIDE_ID;
    hide.type = 'button';
    root.appendChild(main);
    root.appendChild(hide);

    function saveMode() {
        try { localStorage.setItem(MODE_KEY, mode); } catch (_) {}
    }
    function saveUI() {
        try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) {}
    }
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), Math.max(min, max));
    }
    function maxExpandedX() {
        return Math.max(0, innerWidth - FULL_WIDTH);
    }
    function maxExpandedY() {
        return Math.max(0, innerHeight - FULL_HEIGHT);
    }
    function applyPosition() {
        ui.x = clamp(ui.x, 0, maxExpandedX());
        ui.y = clamp(ui.y, 0, maxExpandedY());
        if (ui.collapsed) {
            root.style.setProperty('left', (ui.edge === 'left' ? 0 : Math.max(0, innerWidth - TAB_SIZE)) + 'px', 'important');
            root.style.setProperty('top', clamp(ui.y, 0, Math.max(0, innerHeight - COLLAPSED_HEIGHT)) + 'px', 'important');
        } else {
            root.style.setProperty('left', ui.x + 'px', 'important');
            root.style.setProperty('top', ui.y + 'px', 'important');
        }
    }
    function updateMain() {
        main.dataset.mode = mode;
        const label = mode === 'full' ? 'TOTAL' : mode === 'steps' ? 'ETAPAS' : 'OFF';
        main.querySelector('.tm-apex-v42-label').textContent = label;
        main.setAttribute('aria-pressed', String(mode !== 'off'));
        main.setAttribute('aria-label', 'Modo ' + label + '. Clique uma vez para TOTAL (ou desligar se já estiver em TOTAL). Dois cliques para ETAPAS. Arraste para mover.');
        main.title = 'Modo: ' + label + '\n1 clique: TOTAL / desligar\n2 cliques: ETAPAS\nArraste: mover e salvar posição\nSetas físicas ↑ e ↓: navegar';
    }
    function updateUI() {
        root.dataset.collapsed = String(ui.collapsed);
        root.dataset.edge = ui.edge;
        // No modo expandido, a seta aponta para a borda; recolhido, para o centro da tela.
        hide.textContent = ui.collapsed
            ? (ui.edge === 'left' ? '›' : '‹')
            : (ui.edge === 'left' ? '‹' : '›');
        hide.setAttribute('aria-label', ui.collapsed ? 'Mostrar botão de rolagem' : 'Ocultar botão, deixando apenas a seta');
        hide.title = ui.collapsed ? 'Mostrar botão (a rolagem pelas teclas continua ativa)' : 'Recolher e deixar apenas a seta';
        hide.setAttribute('aria-expanded', String(!ui.collapsed));
        applyPosition();
    }
    function setMode(nextMode) {
        mode = nextMode;
        updateMain();
        saveMode();
        main.blur();
    }
    function cancelPendingClick() {
        if (clickTimer !== null) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }
    }

    // 1 clique: TOTAL ou OFF; 2 cliques: ETAPAS. Arrastar não deve acionar clique.
    main.addEventListener('click', function (event) {
        if (Date.now() < suppressMainClickUntil) return;
        if (event.detail >= 2) {
            cancelPendingClick();
            setMode('steps');
            return;
        }
        cancelPendingClick();
        clickTimer = setTimeout(function () {
            clickTimer = null;
            setMode(mode === 'full' ? 'off' : 'full');
        }, DOUBLE_CLICK_MS);
    });
    main.addEventListener('dblclick', function (event) { event.preventDefault(); });

    // Arraste o círculo para onde quiser. Salva exatamente a última posição.
    // A seta lateral também pode ser arrastada na vertical quando recolhida.
    function startDrag(event, fromTab) {
        if (event.button !== 0 || !event.isPrimary) return;
        drag = {
            pointerId: event.pointerId,
            source: fromTab ? hide : main,
            fromTab,
            startX: event.clientX,
            startY: event.clientY,
            originalX: ui.x,
            originalY: ui.y,
            moved: false
        };
        try { drag.source.setPointerCapture(event.pointerId); } catch (_) {}
    }
    main.addEventListener('pointerdown', function (event) { startDrag(event, false); });
    hide.addEventListener('pointerdown', function (event) { if (ui.collapsed) startDrag(event, true); });

    function moveDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
        if (!drag.moved) {
            drag.moved = true;
            cancelPendingClick();
        }
        if (drag.fromTab) {
            ui.y = clamp(drag.originalY + dy, 0, maxExpandedY());
        } else {
            ui.x = clamp(drag.originalX + dx, 0, maxExpandedX());
            ui.y = clamp(drag.originalY + dy, 0, maxExpandedY());
            // A posição do círculo permanece estável durante o arraste.
        }
        updateUI();
        event.preventDefault();
    }
    function finishDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const moved = drag.moved;
        const source = drag.source;
        drag = null;
        try { source.releasePointerCapture(event.pointerId); } catch (_) {}
        if (moved) {
            if (source === main) suppressMainClickUntil = Date.now() + 450;
            else suppressTabClickUntil = Date.now() + 450;
            saveUI();
        }
    }
    main.addEventListener('pointermove', moveDrag);
    hide.addEventListener('pointermove', moveDrag);
    main.addEventListener('pointerup', finishDrag);
    hide.addEventListener('pointerup', finishDrag);
    main.addEventListener('pointercancel', finishDrag);
    hide.addEventListener('pointercancel', finishDrag);

    hide.addEventListener('click', function () {
        if (Date.now() < suppressTabClickUntil) return;
        cancelPendingClick();
        if (!ui.collapsed) {
            ui.edge = ui.x + FULL_WIDTH / 2 < innerWidth / 2 ? 'left' : 'right';
            ui.collapsed = true;
        } else {
            ui.collapsed = false;
        }
        updateUI();
        saveUI();
        hide.blur();
    });

    // Identifica painéis internos com rolagem dentro do Oracle APEX.
    document.addEventListener('pointerdown', function (event) {
        const target = event.target;
        if (target instanceof Element && !root.contains(target)) lastContentTarget = target;
    }, true);
    function isEditable(node) {
        if (!(node instanceof Element)) return false;
        if (node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="grid"], [role="tree"], [role="slider"]')) return true;
        return node.isContentEditable;
    }
    function scrollableAncestor(node) {
        let el = node instanceof Element ? node : null;
        while (el && el !== document.documentElement && el !== document.body) {
            if (!root.contains(el) && el.scrollHeight > el.clientHeight + 3) {
                const overflowY = getComputedStyle(el).overflowY;
                if (/^(auto|scroll|overlay)$/.test(overflowY)) return el;
            }
            el = el.parentElement;
        }
        return null;
    }
    function scrollTarget(eventTarget) {
        const focused = document.activeElement;
        if (focused && focused !== main && focused !== hide &&
            focused !== document.body && focused !== document.documentElement) {
            const fromFocus = scrollableAncestor(focused);
            if (fromFocus) return fromFocus;
        }
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
        const visibleHeight = isDocument ? innerHeight : target.clientHeight;
        const maxTop = Math.max(0, target.scrollHeight - visibleHeight);
        if (mode === 'full') {
            const top = direction === 'up' ? 0 : maxTop;
            if (isDocument) window.scrollTo({ top, behavior: 'instant' });
            else target.scrollTo({ top, behavior: 'instant' });
        } else {
            const delta = visibleHeight * STEP_RATIO * (direction === 'up' ? -1 : 1);
            if (isDocument) window.scrollBy({ top: delta, behavior: 'smooth' });
            else target.scrollBy({ top: delta, behavior: 'smooth' });
        }
    }
    document.addEventListener('keydown', function (event) {
        // Atalho opcional: Alt+M alterna OFF → TOTAL → ETAPAS → OFF.
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
        // Uma etapa por pressão física; segurar a tecla não dispara dezenas de saltos.
        if (event.repeat) return;
        scrollWithKey(scrollTarget(event.target), direction);
    }, true);

    updateMain();
    updateUI();
    function ensureVisible() {
        if (document.head && !style.isConnected) document.head.appendChild(style);
        if (document.body && !root.isConnected) document.body.appendChild(root);
    }
    ensureVisible();
    window.addEventListener('resize', function () {
        applyPosition();
        saveUI();
    });

    // O Oracle APEX atualiza regiões por AJAX: mantém o botão após as atualizações.
    const observer = new MutationObserver(ensureVisible);
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
