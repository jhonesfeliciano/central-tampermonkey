// @central-id romance-botao-colar-cpf
// @central-name Romance - Botão Colar CPF
// @central-version 1.0
// @central-match https://sistema.romancemoda.com.br/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function () {
    'use strict';

    const ID_CAMPO = 'P280_CPF';
    const ID_BOTAO = 'tm-btn-colar-cpf';

    function adicionarBotao() {

        // Procura o campo de CPF
        const campo = document.getElementById(ID_CAMPO);

        // Se não existe nessa página, não faz nada
        if (!campo) return;

        // Evita criar o botão mais de uma vez
        if (document.getElementById(ID_BOTAO)) return;

        // Container onde está o campo
        const wrapper = campo.closest('.t-Form-itemWrapper');

        if (!wrapper) return;

        // Deixa campo + botão na mesma linha
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';

        // Cria botão
        const botao = document.createElement('button');

        botao.id = ID_BOTAO;
        botao.type = 'button';
        botao.innerHTML = '📋 Colar';

        // Visual do botão
        Object.assign(botao.style, {
            height: '40px',
            padding: '0 14px',
            border: 'none',
            borderRadius: '6px',
            background: '#1976d2',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
            transition: '0.2s'
        });

        // Efeito ao passar o mouse
        botao.addEventListener('mouseenter', () => {
            botao.style.background = '#125ea8';
        });

        botao.addEventListener('mouseleave', () => {
            botao.style.background = '#1976d2';
        });

        // Função COLAR
        botao.addEventListener('click', async function () {

            const textoOriginal = botao.innerHTML;

            try {

                // Lê o conteúdo copiado
                const texto = (await navigator.clipboard.readText()).trim();

                if (!texto) {
                    botao.innerHTML = '⚠️ Vazio';

                    setTimeout(() => {
                        botao.innerHTML = textoOriginal;
                    }, 1200);

                    return;
                }

                // Se o Oracle APEX estiver disponível,
                // utiliza a própria função dele para alterar o campo
                if (
                    typeof apex !== 'undefined' &&
                    apex.item &&
                    apex.item(ID_CAMPO)
                ) {
                    apex.item(ID_CAMPO).setValue(texto);
                } else {

                    // Fallback normal
                    campo.value = texto;

                    campo.dispatchEvent(
                        new Event('input', {
                            bubbles: true
                        })
                    );

                    campo.dispatchEvent(
                        new Event('change', {
                            bubbles: true
                        })
                    );
                }

                // Mantém o cursor no campo
                campo.focus();

                // Confirma visualmente
                botao.innerHTML = '✓ Colado';
                botao.style.background = '#16a34a';

                setTimeout(() => {
                    botao.innerHTML = textoOriginal;
                    botao.style.background = '#1976d2';
                }, 1000);

            } catch (erro) {

                console.error(
                    '[Tampermonkey] Erro ao acessar área de transferência:',
                    erro
                );

                botao.innerHTML = '⚠️ Bloqueado';
                botao.style.background = '#dc2626';

                setTimeout(() => {
                    botao.innerHTML = textoOriginal;
                    botao.style.background = '#1976d2';
                }, 1500);
            }

        });

        // Insere DEPOIS do campo CPF
        campo.insertAdjacentElement('afterend', botao);
    }


    // Executa inicialmente
    adicionarBotao();


    // Oracle APEX pode atualizar partes da página dinamicamente.
    // Este observador garante que o botão seja recriado se necessário.
    const observer = new MutationObserver(() => {
        adicionarBotao();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
