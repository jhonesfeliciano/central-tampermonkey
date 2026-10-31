// @central-id romance-sistema-lapis-verde-abrir-nova-guia
// @central-name Romance Sistema - Lápis Verde Abrir Nova Guia
// @central-version 1.1.0
// @central-match https://sistema.romancemoda.com.br/*
// @central-match http://sistema.romancemoda.com.br/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function () {
    'use strict';

    const CONFIG = {
        markerClass: 'tm-lapis-verde-nova-guia',
        pencilFileName: 'pencil16x16.gif',

        greenColor: '#16a34a',
        greenHoverColor: '#15803d',

        pencilWidth: '16px',
        pencilHeight: '16px',

        verticalSpacing: '2px',

        title: 'Abrir em nova guia',

        observerDebounce: 100
    };


    // ============================================================
    // CSS
    // ============================================================

    function adicionarCSS() {

        if (document.getElementById('tm-lapis-verde-style')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'tm-lapis-verde-style';

        style.textContent = `

            a.${CONFIG.markerClass} {
                display: block !important;

                width: ${CONFIG.pencilWidth} !important;
                height: ${CONFIG.pencilHeight} !important;

                margin-top: ${CONFIG.verticalSpacing} !important;
                margin-bottom: 0 !important;

                padding: 0 !important;

                line-height: ${CONFIG.pencilHeight} !important;

                text-decoration: none !important;

                cursor: pointer !important;

                position: relative !important;

                z-index: 999 !important;
            }


            a.${CONFIG.markerClass} img {

                display: block !important;

                width: ${CONFIG.pencilWidth} !important;
                height: ${CONFIG.pencilHeight} !important;

                border: 0 !important;

                margin: 0 !important;
                padding: 0 !important;

                filter:
                    invert(46%)
                    sepia(83%)
                    saturate(1111%)
                    hue-rotate(92deg)
                    brightness(91%)
                    contrast(88%) !important;

                opacity: 1 !important;

                transition:
                    transform 0.12s ease,
                    filter 0.12s ease,
                    opacity 0.12s ease !important;
            }


            a.${CONFIG.markerClass}:hover img {

                filter:
                    invert(35%)
                    sepia(90%)
                    saturate(1200%)
                    hue-rotate(91deg)
                    brightness(80%)
                    contrast(95%) !important;

                transform: scale(1.08);
            }


            a.${CONFIG.markerClass}:active img {

                transform: scale(0.94);
            }

        `;

        document.head.appendChild(style);
    }


    // ============================================================
    // IDENTIFICA O LÁPIS ORIGINAL
    // ============================================================

    function ehLapisOriginal(img) {

        if (
            !img ||
            img.nodeType !== Node.ELEMENT_NODE
        ) {
            return false;
        }

        const srcOriginal =
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            '';

        const src =
            srcOriginal.toLowerCase();

        return src.includes(
            CONFIG.pencilFileName.toLowerCase()
        );
    }


    // ============================================================
    // ENCONTRA O LINK ORIGINAL
    // ============================================================

    function obterLinkOriginal(img) {

        if (!img) {
            return null;
        }

        return img.closest('a');
    }


    // ============================================================
    // VALIDA O LINK
    // ============================================================

    function linkValido(link) {

        if (!link) {
            return false;
        }

        if (
            link.classList &&
            link.classList.contains(
                CONFIG.markerClass
            )
        ) {
            return false;
        }

        const href =
            link.getAttribute('href');

        if (!href || !href.trim()) {
            return false;
        }

        if (
            href.trim()
                .toLowerCase()
                .startsWith('javascript:')
        ) {
            return false;
        }

        return true;
    }


    // ============================================================
    // CRIA O LÁPIS VERDE
    // ============================================================

    function criarLapisVerde(linkOriginal) {

        if (!linkValido(linkOriginal)) {
            return null;
        }

        const pai =
            linkOriginal.parentElement;

        if (!pai) {
            return null;
        }


        // --------------------------------------------------------
        // EVITA DUPLICAÇÃO
        // --------------------------------------------------------

        const hrefOriginal =
            linkOriginal.getAttribute('href') || '';

        const verdesExistentes =
            pai.querySelectorAll(
                `a.${CONFIG.markerClass}`
            );

        for (
            const existente of verdesExistentes
        ) {

            if (
                existente.dataset.tmOriginalHref ===
                hrefOriginal
            ) {
                return existente;
            }
        }


        // --------------------------------------------------------
        // CRIA O LINK
        // --------------------------------------------------------

        const novoLink =
            document.createElement('a');

        novoLink.className =
            CONFIG.markerClass;

        novoLink.dataset.tmOriginalHref =
            hrefOriginal;

        novoLink.title =
            CONFIG.title;

        novoLink.setAttribute(
            'aria-label',
            CONFIG.title
        );

        novoLink.setAttribute(
            'role',
            'button'
        );


        // --------------------------------------------------------
        // CLONA O ÍCONE ORIGINAL
        // --------------------------------------------------------

        const imgOriginal =
            linkOriginal.querySelector('img');

        if (!imgOriginal) {
            return null;
        }

        const novoImg =
            imgOriginal.cloneNode(true);

        novoImg.classList.add(
            'tm-lapis-verde-img'
        );

        novoImg.removeAttribute('id');

        novoImg.alt = '';

        novoImg.setAttribute(
            'aria-hidden',
            'true'
        );

        novoLink.appendChild(novoImg);


        // ========================================================
        // CLIQUE DO LÁPIS VERDE
        // ========================================================

        novoLink.addEventListener(
            'click',
            function (event) {

                /*
                 * Impede completamente o comportamento
                 * padrão do link.
                 */
                event.preventDefault();

                event.stopPropagation();

                if (
                    typeof event.stopImmediatePropagation ===
                    'function'
                ) {
                    event.stopImmediatePropagation();
                }


                /*
                 * Recupera o mesmo href do lápis original.
                 */
                const href =
                    linkOriginal.getAttribute('href');

                if (!href) {
                    return;
                }


                /*
                 * Converte para URL absoluta.
                 */
                let destino;

                try {

                    destino =
                        new URL(
                            href,
                            window.location.href
                        ).href;

                } catch (erro) {

                    destino = href;
                }


                /*
                 * =================================================
                 * ABRE SOMENTE UMA NOVA GUIA
                 * =================================================
                 *
                 * IMPORTANTE:
                 *
                 * Não existe mais fallback com outro <a>.
                 *
                 * Isso elimina a possibilidade de abrir duas
                 * guias.
                 */
                window.open(
                    destino,
                    '_blank',
                    'noopener,noreferrer'
                );

            },
            true
        );


        // --------------------------------------------------------
        // INSERE ABAIXO DO ORIGINAL
        // --------------------------------------------------------

        linkOriginal.insertAdjacentElement(
            'afterend',
            novoLink
        );


        return novoLink;
    }


    // ============================================================
    // PROCESSA UM ELEMENTO
    // ============================================================

    function processarElemento(elemento) {

        if (!elemento) {
            return;
        }


        // Caso seja uma imagem
        if (
            elemento.nodeType === Node.ELEMENT_NODE &&
            elemento.tagName === 'IMG'
        ) {

            if (
                ehLapisOriginal(elemento)
            ) {

                const link =
                    obterLinkOriginal(elemento);

                if (link) {
                    criarLapisVerde(link);
                }
            }
        }


        // Caso seja um elemento que contém imagens
        if (
            elemento.querySelectorAll
        ) {

            const imagens =
                elemento.querySelectorAll(
                    'img'
                );

            imagens.forEach(
                function (img) {

                    if (
                        ehLapisOriginal(img)
                    ) {

                        const link =
                            obterLinkOriginal(img);

                        if (link) {
                            criarLapisVerde(link);
                        }
                    }

                }
            );
        }
    }


    // ============================================================
    // PROCESSA TODOS OS LÁPIS
    // ============================================================

    function processarTodos() {

        const imagens =
            document.querySelectorAll(
                'img'
            );

        imagens.forEach(
            function (img) {

                if (
                    ehLapisOriginal(img)
                ) {

                    const link =
                        obterLinkOriginal(img);

                    if (link) {
                        criarLapisVerde(link);
                    }
                }

            }
        );
    }


    // ============================================================
    // OBSERVADOR DO DOM
    // ============================================================

    let observerTimer = null;

    function agendarProcessamento() {

        if (observerTimer) {
            clearTimeout(observerTimer);
        }

        observerTimer =
            setTimeout(
                function () {

                    observerTimer = null;

                    processarTodos();

                },
                CONFIG.observerDebounce
            );
    }


    const observer =
        new MutationObserver(
            function (mutations) {

                let precisaProcessar = false;

                for (
                    const mutation of mutations
                ) {

                    if (
                        mutation.type ===
                        'childList'
                    ) {

                        if (
                            mutation.addedNodes &&
                            mutation.addedNodes.length
                        ) {

                            precisaProcessar = true;

                            break;
                        }
                    }
                }


                if (
                    precisaProcessar
                ) {
                    agendarProcessamento();
                }

            }
        );


    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================

    function iniciar() {

        adicionarCSS();

        processarTodos();


        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );


        // Reforços para páginas/regiões carregadas via APEX.

        setTimeout(
            processarTodos,
            500
        );

        setTimeout(
            processarTodos,
            1500
        );

        setTimeout(
            processarTodos,
            3000
        );
    }


    // ============================================================
    // EXECUÇÃO
    // ============================================================

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            iniciar,
            {
                once: true
            }
        );

    } else {

        iniciar();
    }

})();
