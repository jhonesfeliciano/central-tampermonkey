// @central-id clonar-botao-filtrar-apex-topo
// @central-name Clonar Botão Filtrar - APEX (Topo)
// @central-version 1.1
// @central-match https://*/*
// @central-match http://*/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function() {
    'use strict';

    // Cria um loop para verificar o DOM a cada 500ms
    const intervalId = setInterval(() => {
        const botaoOriginal = document.getElementById('P36_FILTRAR');
        // Usando o inputContainer para melhor alinhamento
        const containerEmpresa = document.querySelector('#P0_IDFILIAL_CONTAINER .t-Form-inputContainer');

        // Só executa quando encontrar os dois elementos originais e confirmar que o clone ainda não existe
        if (botaoOriginal && containerEmpresa && !document.getElementById('P36_FILTRAR_TOPO')) {
            clearInterval(intervalId); // Encerra o loop

            const botaoClone = botaoOriginal.cloneNode(true);
            botaoClone.id = 'P36_FILTRAR_TOPO';

            // Alinhamento Flexbox direto no container para forçar a renderização lado a lado
            containerEmpresa.style.display = 'flex';
            containerEmpresa.style.alignItems = 'center';
            containerEmpresa.style.gap = '15px';

            // Força o reset de margens para não herdar quebras de linha do APEX
            botaoClone.style.marginTop = '0';
            botaoClone.style.marginBottom = '0';

            botaoClone.addEventListener('click', function(e) {
                e.preventDefault();
                // Aciona o botão original diretamente (resolve isolamento de contexto do Tampermonkey)
                botaoOriginal.click();
            });

            // Adiciona o botão clonado dentro do container do input, ao lado do Select
            containerEmpresa.appendChild(botaoClone);
        }
    }, 500);

    // Timeout de segurança: Para de procurar após 15 segundos para evitar uso de CPU
    setTimeout(() => {
        clearInterval(intervalId);
    }, 15000);

})();
