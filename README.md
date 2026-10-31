# Central GitHub + Tampermonkey

## Objetivo

Instalar **somente um script** no Tampermonkey e guardar todos os módulos em um repositório GitHub.
Um GitHub Action atualiza automaticamente o `manifest.json` quando arquivos em `scripts/` são criados, editados ou apagados.
O Script Mestre consulta esse catálogo a cada **3 minutos** e executa **somente** os módulos que correspondem ao endereço aberto.

> Esta primeira versão usa `raw.githubusercontent.com`, portanto **exige repositório PÚBLICO**. Não publique senhas, CPFs de clientes, tokens, cookies, dados internos ou código corporativo confidencial. Para um repositório privado é necessária outra configuração de autenticação segura.

## Instalação em 5 passos

1. Abra https://github.com/new e crie um repositório **Público** chamado **central-tampermonkey**, com branch `main` (é o padrão).
2. Extraia o ZIP deste projeto e envie o **conteúdo** da pasta `central-tampermonkey` ao repositório com `Add file > Upload files`; inclua a pasta oculta `.github/`. Confirme o commit.
3. No Tampermonkey, abra `Criar novo script`, remova o código de exemplo e cole o conteúdo de `mestre.user.js`.
4. **Antes de salvar**, troque `SEU_USUARIO/central-tampermonkey` pelo seu usuário/repositório real, por exemplo `meuusuario/central-tampermonkey`. Salve. No Chrome/Chromium, ative os recursos/permissões necessários ao Tampermonkey, caso solicitados.
5. Abra `https://example.com/`. Você deve ver o selo verde **"Script recebido do GitHub e executado!"** e o botão `Central 1/1` no canto inferior direito. Clique nele para abrir o painel.

### Se não funcionar

- Confirme que `https://raw.githubusercontent.com/SEU_USUARIO/central-tampermonkey/main/manifest.json` abre no navegador (troque SEU_USUARIO).
- No Tampermonkey, confira se o Script Mestre está **ativado** e a extensão tem permissão para a página.
- No site de teste, pressione `F12 > Console` e procure mensagens `[CENTRAL GITHUB]`.
- O menu do Tampermonkey tem os comandos `Central: sincronizar agora` e `Central: abrir/fechar painel`.
- Se alterou um módulo já carregado, **recarregue a aba** para aplicar a atualização.
- Se a Action não funcionar, abra `Actions > Atualizar catálogo da Central` e veja o erro. Verifique se o repositório permite Actions e o workflow tem permissão `contents: write`.

## Adicionar um novo script (sem editar o Tampermonkey)

1. Crie um arquivo novo dentro de `scripts/`, por exemplo `scripts/minha-automacao.js`.
2. Coloque no início do arquivo estas linhas, alterando o site:

```js
// @central-id minha-automacao
// @central-name Minha automação
// @central-version 1.0.0
// @central-match https://sistema.exemplo.com/*
// @central-enabled true

(function () {
  'use strict';
  API.log('Funcionando no site:', location.href);
  // Sua automação começa aqui.
})();
```

3. Envie o arquivo e confirme o commit. O workflow `.github/workflows/atualizar-catalogo.yml` atualiza o `manifest.json` automaticamente.
4. O Script Mestre encontra o novo módulo em até aproximadamente **3 minutos após a publicação do catálogo**. Pode usar o botão **Sincronizar agora** para consultar imediatamente.

Adicione uma linha `// @central-match https://outro.site.com/*` para permitir o mesmo módulo em mais de um endereço. O padrão usa `*` como curinga.

## Atualizar um módulo

Edite seu arquivo em `scripts/` e salve o commit. O gerador calcula **SHA-256 automaticamente**, então não é obrigatório mudar `@central-version` para detectar novas alterações. Se a automação já estiver executando na aba, o painel mostrará **"Nova versão: recarregue a página"**. Isso evita duplicar intervalos, eventos e cliques de uma automação em andamento.

## Desativar scripts

- No GitHub: `// @central-enabled false` no arquivo do módulo, depois commit. Isso desativa em todos os navegadores na próxima leitura do catálogo; **recarregue as abas** para encerrar automações existentes.
- No navegador: desmarque o script no painel da Central. A escolha fica salva neste navegador. Recarregue a aba para encerrar uma automação que já estava ativa.

## API disponível em módulos

A variável global **da função do módulo** `API` permite organização de dados por script:

```js
API.log('iniciou');
API.storage.set('contador', 3);
const numero = API.storage.get('contador', 0);
API.storage.delete('contador');
```

Além dela, o carregador disponibiliza funções comuns do Tampermonkey: `GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_addStyle`, `GM_openInTab`, `GM_setClipboard`, `GM_registerMenuCommand`, `unsafeWindow`.

**Importante:** módulos dividem o ambiente e as permissões do Script Mestre. Não há isolamento de segurança total entre módulos. Um script antigo `.user.js` com `@grant`, `@require`, `@run-at document-start`, eventos globais ou vários nomes iguais talvez **precise de adaptação** para rodar como módulo. O simples envio de todos os scripts antigos sem análise não garante compatibilidade. Para dados de módulos, prefira `API.storage` (evita colisões entre chaves).

## Segurança e limitações

- O Script Mestre inclui `@match http://*/*`, `@match https://*/*` e `@connect *` para reconhecer futuramente novos sites e conexões sem editar o cabeçalho. Isso é **uma permissão abrangente**. Instale apenas em navegadores confiáveis e mantenha acesso de gravação do repositório restrito. Qualquer pessoa que consiga alterar seu repositório poderá enviar código executado pelo navegador.
- Os módulos só rodam onde `@central-match` corresponder ao endereço. A Central não executa os módulos em sites que não constam do catálogo.
- A primeira versão usa um repositório **público**. Nunca envie credenciais e dados internos. Para código privado, será preciso desenhar um backend/autenticação apropriados.
- Um novo módulo pode ser iniciado em uma **aba já aberta** na próxima sincronização. Um módulo **já executado** que mudou de versão precisa de **reload** para evitar executar duas cópias sobre a mesma página. Alguns sites SPA podem exigir adaptação para mudanças internas de rota.
- `@run-at` vale para o Script Mestre (`document-idle`). Módulos que exigem rodar antes da página carregar não são compatíveis diretamente com esta arquitetura.
- O catálogo mantém uma cópia no armazenamento do Tampermonkey para situações em que o GitHub estiver indisponível. O carregador tenta uma cópia local de código apenas quando o SHA esperado coincide.
- A validação SHA-256 é executada onde o Web Crypto estiver disponível. Caso não esteja, permanecem validações de origem/configuração e HTTPS, mas não a verificação local do hash.
- O Script Mestre carrega **código executável remoto**. Revise alterações antes de publicá-las.

## Estrutura

```text
central-tampermonkey/
├── mestre.user.js                   # o único instalado no navegador
├── manifest.json                     # gerado automaticamente
├── scripts/
│   └── demo.js                       # script de teste para example.com
├── tools/
│   └── gerar_manifesto.py            # gera o catálogo a partir dos comentários
└── .github/
    └── workflows/
        └── atualizar-catalogo.yml    # catálogo automático após commit
```
