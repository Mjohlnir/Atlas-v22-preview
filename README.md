# Atlas v22 — prévia pública de sincronização Crunchyroll

Ambiente isolado para testar **envio automático do histórico Crunchyroll ao navegador**, sem importar JSON.

## Como testar
1. Abra a página publicada no GitHub Pages (depois de ativar o Pages).
2. Instale [itamae-atlas.user.js](./itamae-atlas.user.js) no Tampermonkey. Desative scripts Itamae antigos para evitar conflito.
3. Clique **Conectar aba Crunchyroll** na página de testes.
4. Na aba Crunchyroll, clique **Enviar ao Atlas**. O script inicia o carregamento automático do histórico e transmite os registros em lotes.
5. Volte à página de testes para conferir o contador. Os eventos ficam apenas no armazenamento local do navegador.

**Limites:** o navegador deve manter as duas abas abertas. A coleta depende das requisições do site Crunchyroll e da possibilidade de comunicação entre as janelas. Este preview **não faz login no Atlas, não grava no Supabase e não modifica a biblioteca existente**. Não é o produto completo nem substitui a homologação do banco.

## Publicação no GitHub Pages
A branch pública `gh-pages` foi criada e o GitHub iniciou a publicação automática, sem configuração de serviços pagos. Após o build concluir, a URL será:

https://mjohlnir.github.io/Atlas-v22-preview/

O código de desenvolvimento fica em `main`; a versão publicada fica em `gh-pages`. A página de teste não tem backend e não modifica o banco Atlas.

## Privacidade
Este repositório é público. **Nunca** envie históricos reais, arquivos JSON, tokens, senhas ou cookies para ele. Os arquivos publicados contêm apenas código e interface. Não existe backend de coleta de histórico.

## Testes
A lógica de normalização foi validada localmente com um export Itamae real, sem publicar seus dados: 3.180 registros reconhecidos, 0 erros de leitura. A comunicação com uma sessão Crunchyroll autenticada ainda precisa ser validada no navegador do usuário.
