// @central-id destaque-nova-guia-consulta-doc
// @central-name Destaque + Nova Guia - Consulta Doc.
// @central-version 1.1
// @central-match https://sistema.romancemoda.com.br/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function () {
    'use strict';

    const STYLE_ID = 'tm-destaque-consulta-doc';

    function adicionarEstilo() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `
            /* Destaque do botão Consulta Doc. */
            .tm-consulta-doc-destaque {
                background: #d9f2ff !important;
                border: 2px solid #2196f3 !important;
                border-radius: 8px !important;
                box-shadow:
                    0 0 0 3px rgba(33, 150, 243, 0.18),
                    0 3px 10px rgba(33, 150, 243, 0.25) !important;

                color: #075985 !important;
                font-weight: 700 !important;

                margin: 3px 5px !important;
                transition: all 0.2s ease-in-out !important;
            }

            .tm-consulta-doc-destaque .t-Button-label {
                color: #075985 !important;
                font-weight: 700 !important;
            }

            .tm-consulta-doc-destaque:hover {
                background: #bde9ff !important;
                border-color: #0ea5e9 !important;
                box-shadow:
                    0 0 0 4px rgba(14, 165, 233, 0.22),
                    0 4px 14px rgba(14, 165, 233, 0.35) !important;

                transform: translateY(-1px);
            }
        `;

        document.head.appendChild(style);
    }

    function destacarConsultaDoc() {
        adicionarEstilo();

        const labels = document.querySelectorAll('.t-Button-label');

        labels.forEach(function (label) {

            if (label.textContent.trim() === 'Consulta Doc.') {

                const botao = label.closest('a');

                if (botao) {

                    // Adiciona o destaque visual
                    botao.classList.add('tm-consulta-doc-destaque');

                    // Abre o link em uma nova guia
                    botao.setAttribute('target', '_blank');

                    // Segurança para a nova guia
                    botao.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });
    }

    // Executa ao carregar
    destacarConsultaDoc();

    // Observa alterações dinâmicas do Oracle APEX
    const observer = new MutationObserver(function () {
        destacarConsultaDoc();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
