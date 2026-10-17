# Demo pública segura do Meca Sim

**Estado:** plano para implementação em etapa posterior; esta PR contém documentação. A demo não está implementada, hospedada ou publicada.

## Decisão de arquitetura

Entregar uma página estática, preferencialmente publicada como artefato separado a partir de uma pasta dedicada (demo-publica/). A página reproduz uma gravação curada, gerada pela versão local do Meca Sim, com controles de play/pause, scrub e seleção de um cenário. Dados e interface são servidos como arquivos estáticos; JavaScript roda somente no navegador do visitante.

A demo não inicia nem importa componentes do servidor local. A pipeline futura deve publicar somente a allowlist da pasta estática e não pode iniciar server.py, empacotar a distribuição local nem copiar sdk.py, project_import.py, physics.py ou o editor completo para o host como executáveis. Não adicionar endpoint de API para gravação.

### Recorte de funcionalidades

| Parte | Demo pública | Versão local completa |
|---|---|---|
| Ver arena e robô | Replay curado, com controles da linha do tempo | Simulação completa e configurável |
| Movimento/telemetria | Amostras gravadas incluídas no pacote | Estado calculado em tempo real |
| Código Java | Nenhum editor ou campo de código | Editor local existente |
| Upload/importação | Nenhum upload ou ZIP | Importação local existente |
| Compilar/executar | Nunca | javac/JVM local, com SDK parcial idealizado |
| API de controle | Nenhuma | Rotas HTTP locais do server.py |
| Persistência | Nenhuma gravação enviada; sem conta | Projetos locais no navegador/arquivos |

Usar um cenário de replay que tenha sido executado e verificado na versão local; guardar junto do conjunto de dados a origem (SHA do simulador e data), configuração relevante, descrição do cenário e resumo de limitações. Se o cenário não for reproduzível ou sua procedência não puder ser verificada, identificá-lo como ilustração e não como evidência de execução.

A interface precisa informar de forma visível: “Replay de sessão gravada — não é execução ao vivo”; dados não editáveis; modelo, telemetria e física são aproximações; demo não oferece suporte ao SDK FTC completo; resultados não comprovam comportamento em robô real. O replay não deve insinuar que visitante controla ou compila código.

## Inventário atual e fronteiras

A aplicação completa usa web/index.html e web/app.js com chamadas ao servidor. server.py atende conteúdo web e exemplos, além de GET /api/state, GET /api/recording e POSTs em /api/import-zip, /api/run, /api/start, /api/stop, /api/reset, /api/heartbeat e /api/gamepad. A rota /api/run compila com javac e cria processo JVM; /api/import-zip processa ZIP. O processo local tem acesso às permissões do usuário que o iniciou.

O servidor hoje faz bind em 127.0.0.1; verifica Host e, nos POSTs, token e Origin. Esses controles protegem a integração local contra algumas classes de erro, mas não devem ser tratados como autenticação pública, isolamento de processo, proteção completa contra requisições de navegador a serviços locais ou contenção de código. Nenhum reverse proxy, túnel, port-forward ou hospedagem de server.py faz parte desta proposta.

## Threat model da demo

| Ameaça/superfície | Mitigação no desenho | Limite/validação exigida |
|---|---|---|
| Visitante envia Java malicioso | Não há formulário, upload, API ou código executável fornecido pelo usuário. Dados são gravação fixa. | Teste de rede no Chromium: nenhum request para /api/*, nenhuma chamada de compilador/processo, nenhuma entrada livre que altere dados. |
| ZIP, traversal ou arquivo grande | Upload não existe na demo. | Confirmar que pacote publicado não contém importador nem aceita arquivo via input/drop. |
| Visitante alcançar a instância local | Demo independente, sem chamadas a localhost, endereços privados ou à API local. | connect-src 'none' na Content Security Policy onde suportada; E2E deve interceptar e falhar em requests inesperados. CORS/Host/Origin não substituem esta separação. |
| Abuso de API ou criação de sessões | Demo não oferece API, estado no servidor, contas ou sessões mutáveis. | Inspecionar tráfego e artefato de deploy; nenhuma rota do servidor local é publicada. |
| Sobrecarga de CPU/memória no browser | Replay de tamanho e duração limitados; sem simulação de código do visitante; limites de amostras e loop de animação suspenso quando fora da tela. | Testes de tamanho, duração, pausa e navegação em desktop/celular; evitar parser de arquivos arbitrários. |
| Coleta/exposição de dados | Sem login, analytics, cookies de sessão, armazenamento remoto ou gravação de inputs. | Verificar dependências/requisições de terceiros; declarar qualquer telemetria se for adicionada em mudança futura. |
| Indisponibilidade/abuso de tráfego | Arquivos estáticos em host/CDN gerenciado, sem worker de simulação ou custo por execução. | Limites e mitigação de tráfego dependem do host; revisar quota, logs e resposta a abuso antes do deploy. Rate limit de aplicação não se aplica enquanto não existir backend. |
| Replay alterado ou confundido com teste real | Identificar como sessão gravada; incluir fonte, SHA, cenário e versão de formato. | Validar esquema, tamanho, monotonicidade temporal e checksum/versionamento do artefato; não alegar precisão física. |
| Cadeia de publicação comprometida | Deploy futuro deve usar workflow mínimo, permissões contents: read/deploy estritas, revisão do artefato e origem do build rastreável. | Revisar actions pinadas, permissões, branch protection e configuração real do host antes de habilitar publicação. |

CSP, CORS, checagem de Host/Origin, tokens, timeout de javac, -Xmx e afinidade de loopback são defesas auxiliares. O requisito principal é topológico: a demo não contém um caminho de entrada do visitante para javac, JVM, importação ou rotas de controle, e o serviço local não é exposto.

## Critérios de aceite para implementação futura

1. O código e os uploads do visitante nunca chegam a compilador, JVM, importador ZIP, servidor local ou rota de controle.
2. O pacote publicado contém somente a página, assets e gravações curadas; nenhuma rota /api/* está hospedada ou encaminhada.
3. Play, pause e scrub funcionam em Chromium desktop e viewport móvel. A origem e a limitação de replay ficam visíveis.
4. E2E comprova requisições esperadas e ausência de chamadas de rede a rotas locais/API; testes de acessibilidade cobrem teclado, foco, contraste e movimento reduzido.
5. Suíte Python, Node, compatibilidade, fault scenarios e browser_e2e da versão local continua passando; comparar hash de cada arquivo em tests/fixtures com o baseline.
6. README, CHANGELOG e VALIDACAO explicam diferença entre demo estática e aplicação local completa.
7. CI publica somente após aprovação explícita do deploy e revisão de segurança da configuração de hospedagem. Nenhuma alteração de visibilidade, licença ou runner público está coberta por este plano.

## Etapas seguintes

1. Criar a página e dados de replay curados na pasta estática separada; manter o servidor e a aplicação local intactos.
2. Adicionar testes de esquema/limites e Chromium desktop/móvel, verificando que não há uploads nem requests de API/local.
3. Revisar segurança e acessibilidade do pacote e workflow; comparar fixtures byte a byte.
4. Preparar deploy de prévia isolado e revisar URLs/cabeçalhos reais. A publicação pública é uma etapa separada, com aprovação explícita.
5. Considerar sandbox remota de Java apenas em outro projeto, depois de alterar explicitamente AGENTS.md e revisar uma arquitetura de isolamento dedicada. Não faz parte desta demo.
