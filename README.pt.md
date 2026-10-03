# hermetic-diagrams

🌐 [English](./README.md) | [日本語](./README.ja.md) | **Português**

> MCP hermético e anti-exfiltração para renderizar diagramas offline — o código-fonte do diagrama
> nunca sai do seu ambiente.

Parte do ecossistema [scrapup](https://github.com/scrapup/scrapup) · distribuível de forma
independente · construído sobre o [Kroki](https://kroki.io) · MIT.
**Status: Beta — MVP implementado (notações de renderização local, SVG + PNG).**

## Por quê

Peça a qualquer LLM — ou engenheiro — para "renderizar este diagrama em PNG" e o caminho óbvio é
**delegar a um servidor público** (`kroki.io`, `plantuml.com`): é o padrão majoritário em todo
tutorial, não exige instalar nada e é a única forma de um modelo sem harness produzir uma imagem.
Esse padrão **vaza**: o código-fonte — nomes de serviços, topologia, às vezes segredos em rótulos —
é enviado a um terceiro, e a variante comum de `GET` com o código-fonte na URL deixa o diagrama
inteiro em caches de proxy, logs de acesso e histórico.

Nem humanos nem IA escolhem o caminho selado por conta própria; ambos seguem o de menor atrito. Por
isso a garantia aqui é **estrutural, não comportamental**: a exfiltração é impossível por
construção, e não apenas desencorajada por política.

## O que faz

Um servidor MCP que renderiza diagramas — PlantUML, C4, D2, GraphViz, DBML, ERD, Vega/Vega-Lite —
em SVG/PNG, inteiramente na sua máquina, com garantia verificável de ausência de egress.

## Modelo de segurança — contido por construção

Toda requisição atravessa três barreiras em série:

1. **Semântica (o MCP como Policy Enforcement Point).** Validação por notação: rejeita includes
   externos (`!includeurl`, sprites/temas remotos, D2 `icon: https://`, GraphViz `image=`, Vega
   `data.url`), bloqueia `%getenv`, desativa DTD/entidades externas em XML (XXE), usa allowlist de
   tipos de diagrama, impõe limites de tamanho/tempo e falha fechado (fail-closed) em qualquer
   código-fonte que não consiga analisar com confiança.
2. **Rede — a garantia primária.** O renderizador (um Kroki headless, nunca exposto, sem portas
   publicadas) roda numa rede Docker com `internal: true` — **sem gateway padrão, sem rota para
   fora**.
3. **Renderizador.** `KROKI_SAFE_MODE=SECURE` recusa includes de arquivo/URL como última linha.

O MCP é o **único cliente** do renderizador — não existe caminho até ele que não passe pelo MCP. O
SVG entregue é **sanitizado** (um parser XML real + allowlist de elementos/atributos) para não fazer
requisições ao ser exibido: `script`, `foreignObject` e `href`/`url()` remotos são removidos.

### Provar, não confiar

A cada boot o gateway prova a contenção e **falha fechado** se não conseguir — a tool de
renderização nem é registrada se algum gate falhar:

- **Egress self-check** — o MCP tenta um connect TCP só com SYN para um IP público fixo; se
  *conectar*, existe rota externa e ele se recusa a operar (`NOT_CONTAINED`).
- **Canary render** — um diagrama com include remoto é enviado ao engine sem passar pelo PEP; o
  engine precisa recusá-lo. (No CI, o teste golden verifica que um sink controlado **nunca** é
  alcançado.)
- **Healthcheck do Kroki** — o gateway só atende depois que o engine reporta pronto.
- **Homologado e fixado** — as imagens são fixadas por `sha256` (ver `images.lock`); um novo digest
  só é promovido depois de provar a contenção novamente.
- **MCP sem egress** — sem cliente HTTP de saída, sem telemetria; ele alcança o Kroki apenas pela
  rede interna, via **POST com corpo** (nunca GET com o código-fonte na URL).

## Requisitos

- **Docker** (Desktop ou Engine) rodando **Linux containers**, com Docker Compose 2.24 ou mais
  recente. No Windows, use o Docker Desktop com o backend WSL 2 (modo Linux containers). Todos os
  runtimes pesados vivem dentro de imagens Linux fixadas, então a mesma configuração funciona no
  Windows, no macOS e no Linux.
- **Node.js 24 ou mais recente**, para o `npx`.

## Instalação

Dois passos, idênticos no Windows, no macOS e no Linux: registrar o servidor no seu assistente de
IA e prepará-lo uma vez.

### 1. Registrar o servidor

Todo canal inicia a mesma coisa: o pacote npm `@scrapup/hermetic-diagrams`, fixado numa versão
exata e executado via `npx`.

**Plugin do Claude Code** (recomendado):

```
/plugin marketplace add scrapup/hermetic-diagrams
/plugin install hermetic-diagrams
```

**Plugin do GitHub Copilot CLI:**

```
copilot plugin marketplace add scrapup/hermetic-diagrams
copilot plugin install hermetic-diagrams
```

**Qualquer outro cliente MCP** — registre o mesmo launcher que o plugin usa. Ele resolve o `npx` em
qualquer sistema (`npx.cmd` no Windows) e executa a versão fixada:

<!-- x-release-please-start-version -->
```json
{
  "mcpServers": {
    "hermetic-diagrams": {
      "command": "node",
      "args": [
        "-e",
        "const w=process.platform==='win32',a=['--prefer-offline','-y','@scrapup/hermetic-diagrams@'+process.argv[1]],p=require('node:child_process'),c=w?p.spawn('npx.cmd '+a.join(' '),{stdio:'inherit',shell:true}):p.spawn('npx',a,{stdio:'inherit'});for(const s of['SIGINT','SIGTERM'])process.on(s,()=>c.kill(s));c.on('exit',x=>process.exit(x??1));c.on('error',()=>process.exit(127))",
        "0.4.2"
      ]
    }
  }
}
```
<!-- x-release-please-end -->

### 2. Preparar uma vez (por versão)

Rode no seu próprio terminal antes do primeiro uso e novamente após cada atualização:

<!-- x-release-please-start-version -->
```
npx @scrapup/hermetic-diagrams@0.4.2 up
```
<!-- x-release-please-end -->

O `up` verifica os pré-requisitos (Docker acessível, Linux containers, versão do Compose), baixa a
imagem fixada do Kroki pelo digest, constrói a imagem do MCP desta versão na sua máquina, inicia o
renderizador e espera até ele ficar saudável. O progresso aparece no terminal; em caso de falha,
sai com código diferente de zero e nomeia a etapa que falhou.

Depois disso, o assistente de IA inicia o servidor em segundos: ele nunca baixa nem constrói nada.
Se a versão não estiver preparada, o servidor para na hora e o log dele mostra o comando `up` exato
a executar — ele nunca fica travado até o assistente estourar o timeout.

Para parar a stack e remover os volumes, use o mesmo pacote e versão, trocando `up` por `down`.

### 3. Atualizar para uma nova versão

Cada release do plugin fixa uma nova versão do pacote, então a atualização tem dois passos:
atualizar o plugin e depois preparar a nova versão com o `up`.

**Claude Code** — atualize o catálogo do marketplace, atualize o plugin e reinicie o Claude Code:

```
claude plugin marketplace update hermetic-diagrams
claude plugin update hermetic-diagrams@hermetic-diagrams
```

**GitHub Copilot CLI** — atualize os catálogos dos marketplaces e depois o plugin:

```
copilot plugin marketplace update
copilot plugin update hermetic-diagrams
```

Em seguida, rode o `up` da nova versão, como no passo 2. Se esse passo for pulado, o servidor para
no primeiro start e o log dele mostra o comando `up` exato com a nova versão. **Qualquer outro
cliente MCP:** troque a versão na configuração do launcher e rode o `up` dela.

## Uso — tools do MCP

### `render_diagram`

Requisição:

```json
{ "format": "plantuml", "source": "@startuml\nAlice -> Bob: hi\n@enduml", "output": "svg" }
```

Resposta (sucesso):

```json
{ "format": "svg", "mimeType": "image/svg+xml", "encoding": "utf8", "data": "<svg …/>" }
```

Resposta (erro):

```json
{ "error": { "code": "EXTERNAL_REFERENCE", "message": "…", "detail": "…" } }
```

Códigos de erro: `INVALID_FORMAT`, `INVALID_SYNTAX`, `EXTERNAL_REFERENCE`, `EMPTY_CONTENT`,
`TOO_LARGE`, `RENDER_TIMEOUT`, `RENDER_ERROR`, `NOT_CONTAINED`.

### `list_formats`

```json
{ "input": ["plantuml","c4","d2","graphviz","dbml","erd","vega","vega-lite"], "output": ["svg","png"] }
```

### `containment_status`

```json
{
  "contained": true,
  "checks": {
    "krokiHealth": "pass", "egressSelfCheck": "pass", "canaryRender": "pass",
    "krokiSafeMode": "SECURE", "publishedPorts": "none"
  }
}
```

## Formatos suportados

| Notação de entrada | SVG | PNG |
|---|---|---|
| PlantUML | ✅ | ✅ |
| C4 (C4-PlantUML) | ✅ | ✅ |
| GraphViz | ✅ | ✅ |
| ERD | ✅ | ✅ |
| D2 | ✅ | — |
| DBML | ✅ | — |
| Vega | ✅ | — |
| Vega-Lite | ✅ | — |

SVG (o padrão) está disponível para todas as notações. PNG está disponível para as notações que a
imagem core do Kroki consegue rasterizar sem componentes de navegador; para as demais, peça SVG.

## Limitações (MVP)

- **Somente notações de renderização local.** Notações que precisam de componentes de navegador
  (Mermaid, BPMN, Excalidraw) ficam para um ciclo posterior (RN-05).
- **PNG para um subconjunto** (ver a tabela). D2/DBML/Vega/Vega-Lite renderizam apenas em SVG neste
  ciclo.
- **Online somente durante o `up`** — o pacote, as imagens fixadas (pelo digest) e as dependências
  de produção da imagem do MCP são baixados uma vez por versão, antes de a rede interna existir. O
  servidor em execução nunca usa a rede. Bundles air-gapped ficam para um ciclo posterior.
- **Somente transporte stdio.**

## Licença

MIT © 2026 scrapup. Autor: Marco Antonio Luqueti Faustino.
