## Perfis de regras e fases manuais — 16/10/2026

- Aba Regras com perfis Oficial (regras implementadas)/Personalizado, seis grupos independentes e restauração.
- Fase manual no tempo livre, sem inferência pelo tempo decorrido; mudança pela API validada e registrada sem reiniciar Java ou peças.
- Configuração fixada após INIT, persistida em projeto/preferências e incluída nos relatórios. Migração de projetos anteriores sem herdar flags de outro projeto.
- G410 separada dos efeitos físicos e de G426. Metadados de penalidade agora refletem os 20 pontos estimados já usados no placar. Acumulado preservado após rotação do log detalhado.
- Testes de combinações, fronteira de 60 s, conservação de reservas, relógio, endpoint e integração Chromium. Referência TU05 consultada; limitações oficiais documentadas.
- Arquivos: `rules.py`, `server.py`, `web/app.js`, `web/index.html`, `tests/test_rule_profiles.py`, `tests/test_rules.py`, `tests/partida_e2e.py`, `tests/packaged_smoke.py`; README e VALIDACAO.

## Bloco: relatório e sobreposição inicial — 16/10/2026

Correções autorizadas após a auditoria: contador de tentativas vazias conectado ao relatório; contadores cumulativos de acertos, erros e tiros ainda em voo preservados após TIP/recaptura; categorias e registros completos no CSV; relatórios antigos exibem campos ausentes como não registrados; rótulo de pontos recebidos por penalidades corrigido. JSON e persistência mantidos.

Peças inicialmente dentro do chassi agora saem integralmente pela face viável mais próxima, incluindo a profundidade e o raio, sem escolher uma saída através da parede externa. Testes confrontam a distância ao retângulo com solução independente em quatro orientações e repetem o reinício sobre GARDEN da auditoria.

Arquivos: `elements.py`, `physics.py`, `server.py`, `web/app.js`, novo `web/report.mjs`; regressões em `tests/test_report_collision.py`, `tests/test_hive_cycle.py`, `tests/model.test.mjs`, `tests/partida_e2e.py` e `tests/packaged_smoke.py`.

Os modos de regras, controle manual de fases e autocomplete avançado continuam pendentes. Física permanece simplificada; esta alteração não é um solver rígido geral.

## Correção integrada da partida — 16/10/2026

- Interseção balística e tombamento passam a ser resolvidos no servidor, sem depender de callbacks/animação do navegador.
- Os três NECTAR iniciais contribuem para uma carga de treino configurável. Padrão: POLLEN = 1, NECTAR = 4/3, limiar = 8; 3 NECTAR + 4 POLLEN tombam. Valores didáticos, não massas ou limiar oficial FIRST.
- O HIVE descarrega os mesmos IDs de POLLEN e NECTAR: queda, piso, colisões e nova coleta; reservas do Human Player permanecem separadas.
- Corrigido yaw em radianos no projétil e acesso nulo na vista lateral que interrompia animação e envio do gamepad.
- Estoque e conteúdo visual do HIVE usam o snapshot real. A prévia de trajetória não cria peças, não pontua e não altera HIVE.
- TeleOp inicial e bundle empacotado incluem MI/MS: Z/LB coleta; C/RB alimenta e lança. Painel Controles mostra o mapa configurado e as ações do exemplo. Botão explícito carrega o novo exemplo sem apagar automaticamente código salvo.
- Novos testes de ciclo completo no motor e de partida em Chromium com teclado + JVM; sem modificar fixtures históricas.

## Fase 1 — peças de campo e intake didático (15/10/2026)

- Modelo de 40 POLLEN e 16 NECTAR, com estados de campo, FLOWER, HIVE, preload, inventário e reserva; diâmetros aproximados do manual.
- Intake frontal configurável (largura do chassi, alcance inicial 0,15 m, capacidade inicial 4). MI positivo captura apenas dentro da região e se houver capacidade.
- Peças livres recebem amortecimento, colisões em pares, paredes e empurrão simplificado pelo chassi; duas vistas exibem os elementos e telemetria de inventário.
- Modelo não é CAD/3D nem calibração de massa/atrito; posições são aproximadas.

## Fase 1 — gamepad completo pelo teclado (15/10/2026)

- Teclas encaminhadas ao vetor virtual FTC de 20 slots do Gamepad 1; o OpMode recebe os mesmos eixos e botões usados pelo SDK parcial.
- Mapeamento: Q/E LS-X, W/S LS-Y, A/D RS-X, R/F RS-Y; Espaço/B/X/Y; Z/C LB/RB; 1/2 LT/RT digitais; setas D-pad; Enter/Backspace Start/Back; [/] cliques dos analógicos.
- Controle físico com mapeamento padrão permanece prioritário. Inputs do editor e controles HTML não são capturados como gamepad.
- Eixos e gatilhos via teclado são discretos; teste de mapeamento cobre os 20 slots. O mapa pode ser remapeado na interface e restaurado ao padrão; teclas duplicadas são rejeitadas.

## Fase 1 — atalhos do editor (15/10/2026)

- Ctrl+S no editor exporta o projeto pelo fluxo JSON existente; desfazer/refazer e clipboard permanecem nativos do textarea.
- Regressão Chromium adicionada para salvar, histórico de edição, seleção e clipboard.

## Correção de regressão da interface (16/10/2026)

- Restaurados handlers de partida, relatórios, exportação, projetos e controles que haviam sido removidos acidentalmente de `web/app.js`.
- Preservada a correção que impede relatório descartado de reaparecer. A CI revelou a regressão antes de validar essa alteração.

## 0.3-rc3 — HIVE selecionável e regras de partida

- Parede externa agora é obrigatória no servidor, evitando que preferências antigas do navegador desliguem a colisão.
- As quatro CELLs centrais do HIVE têm ID, cor e seleção por clique; a linha de mira termina na CELL escolhida.
- Corte lateral com suporte triangular, face inclinada, parábola/bolinha em movimento e bolinhas registradas na abertura.
- Resultado explícito de lançamento: erro, acerto e evento visual de tombamento; botão para remover todas as bolinhas.
- Autônomo limitado a 30 s e TeleOp a 120 s, com opção de desativar o cronômetro de partida.
- Diagnóstico do executável aguarda até 45 s pela inicialização do JDK em Windows CI.

## 0.3-rc2 — física e controle visual

- Parede externa física ativada por padrão; objetos internos não bloqueiam o robô.
- Shooter com controles por eixo compartilhados entre vista superior e lateral.
- Acertos no HIVE ficam registrados visualmente.
- Perfil mecanum configurável, preservando diferencial como padrão.
- Removida a marca provisória MT; adicionada marca vetorial Meca Tiger e cor de robô.

# Histórico de alterações

## Arena Desmos e viabilidade do shooter — 13/10/2026

- Corrige orientação e posição de CELLS, zonas e FLOWERS pela imagem fornecida no Desmos.
- Altura do shooter, ângulo da rampa, força média, massa, curso e eficiência com velocidade calculada; modo de velocidade manual permanece disponível.
- Cálculo de trajetória ideal e do acerto geométrico com tolerância lateral e vertical; condição/explicações visíveis nas duas vistas.
- Testes de precisão da fórmula energética, de acerto/erro lateral e de controles do navegador.



## 0.3 — navegação, diagnósticos e campo dimensionado (13/10/2026)

- Replay de trajetória: carregar amostras, selecionar tempo, reproduzir/pausar sem controlar JVM.
- Diagnóstico observacional: IMU, encoders, motor sem progresso, polaridade de tração, timeout Java/duração da simulação.
- Planejador de 16 waypoints diferenciais, prévia no campo, alerta esquemático de HIVE e geração de Java testável.
- Dimensões BIOBUZZ revisadas conforme manual FIRST: quadro, pivô, células, FLOWER, GARDEN, LOADING ZONE, com coordenadas de elementos explicitamente aproximadas.
- Testes de unidade Node/Python e integração Chromium para nova interface.

## 0.3 — experiência de laboratório (13/10/2026)

- Alternância entre arena livre e diagrama esquemático BIOBUZZ 2026–2027 nas duas vistas.
- Partida configurável clicando no campo, preservada em projetos JSON.
- Biblioteca local de até 12 projetos e seleção junto dos exemplos.
- Driver Station virtual, com INIT/START/STOP vinculados à JVM existente.
- Editor offline com destaque Java, autocomplete de termos FTC e erros do javac clicáveis.
- Upload local da logo oficial da Meca Tiger, sem impor identidade visual inventada.
- Renderização limitada a ~30 FPS, evitando reconstruir a lista de motores sem alteração.
- Testes Node/Chromium adicionados para validar os novos fluxos.


## Diagnóstico de sensores e conclusão Java — 13/10/2026

- Vista superior distingue yaw real da pose e yaw informado pelo IMU, com indicação de IMU congelado.
- O término do Java passa a mostrar um aviso explícito: `concluído` não garante sucesso da missão.
- Testes de regressão do yaw congelado, do `resetYaw()` e do Autônomo 3.1 com timeout de virada e motores desligados.

## 0.3-rc1 — preparação para lançamento

- Kit de teste 14/10/2026: BAT de inicialização com diagnóstico, checklist e modelo de relato de falhas no artefato Windows.

- Build Windows portátil com PyInstaller, verificação de dependências e smoke test da interface empacotada.

- Importação local de ZIP de projetos FTC com identificação e escolha do OpMode, validação de arquivos, sem extração persistente.
- Testes de ZIP, caminhos, tamanho e interface Chromium.
- Ao reabrir projeto JSON, restaura a seleção entre diferentes OpModes importados.

## 0.2 — 2026-10-13

- Importação de arquivos Java auxiliares em diferentes pacotes com compilação conjunta, persistência e testes de segurança de caminhos.
- Correção da corrida STOP/finalização tardia da JVM e teste end-to-end Chromium da importação.

- Repositório exclusivo `meca-sim`; base 0.1 preservada no histórico.
- Integração numericamente estável, falhas sintéticas de motor/encoder/IMU e paredes opcionais.
- Calculadoras de encoders e tiro ideal; salvar/reabrir projeto e trajetória CSV.
- Watchdog do navegador, expiração de entrada, gamepads sem troca de jogador e validação atômica.
- Parser aceita classe final e base qualificada; strings contendo URL não quebram reconhecimento.
- Exemplo autônomo interrompe sequência se uma etapa não alcançar a meta no prazo.
- Iniciadores e diagnóstico; fixtures independentes e CI Windows/Linux/Chromium.

## 0.1 — 13/10/2026 UTC (12/10 à noite no Brasil)

- Criado projeto local com interface em português, vista de cima/lateral e editor Java.
- Implementado modelo diferencial, encoders, yaw, transformação do lançador e balística ideal.
- Implementada compilação/execução JVM com camada FTC parcial, INIT/START/STOP e limite de tempo.
- Adicionado gamepad1/gamepad2 padrão, teclado, telemetria, console, persistência e exportação.
- Adicionados exemplos, testes analíticos/integração e plano de distribuição pública futura.
- Compatibilidade explicitamente parcial; Java roda localmente sem sandbox; sem motor físico, câmera, colisão ou pontuação simulada.


## Fase 1 — shooter MS/MI e relatório (15/10/2026)

- MS+MI positivos consomem uma unidade do inventário por intervalo configurável (0,8 s inicial); estoque vazio registra tentativa sem criar lançamento.
- A trajetória lançada pelo Java usa o perfil balístico existente e produz evento que alimenta as vistas. É simulação, não leitura de RPM nem calibração de robô.
- Botão Terminar Simulação gera relatório persistente no navegador com resultado Java, métricas, telemetria, logs e diagnósticos; exportação JSON/CSV e descarte explícito.
- O relatório diferencia fim normal do Java de sucesso da missão. Pontuação permanece parcial; FLOWER/GARDEN, penalidades e arbitragem completa ainda estão pendentes.

- Telemetria pode ser recolhida e agora mostra Gamepad 1/2 (botões e eixos) junto com os sensores, motores, estoque, tempo e diagnósticos.
- Orientação inicial das CELLs foi alinhada à configuração de partida: red-lower e blue-upper.


## Fase 1 — depósito em FLOWER pelo servo virtual (15/10/2026)

- O OpMode deposita uma peça do inventário ao mover o servo configurado de abaixo para a posição de acionamento; precisa estar iniciado/executando e o robô a até 0,65 m do FLOWER mais próximo (alcance e posição são configuráveis).
- Cada borda de acionamento consome uma peça, registra tipo, FLOWER e ordem, e aparece no painel Driver Station; precisa retrair o servo antes de um novo ciclo.
- Sem peça, fora de alcance ou com OpMode parado, não há depósito. A interação respeita o comando Java, sem botão paralelo que ignore o OpMode.
- Alcance por distância ao centro é aproximação didática; ordem/estado são registrados, mas pontuação oficial, propriedade, condições de Nectar e regras G410 continuam pendentes.


## Fase 1 — regras de entrada de NECTAR (15/10/2026)

- Criado módulo `rules.py`, separado da física, para acompanhar TIPs, NECTAR reservado/introduzido, disponibilidade da aliança e penalidades registradas.
- Cada TIP simulado libera uma entrada de NECTAR; nos últimos 60 s, todas as peças restantes da aliança ficam disponíveis. O botão explícito Human Player introduz uma por vez na Loading Zone esquemática.
- O depósito de NECTAR em FLOWER antes dos últimos 60 s registra G410 como falta grave por peça. O depósito continua no modelo; o simulador não arbitra pontos nem substitui o árbitro.
- O TIP continua derivado do limiar didático de 8 POLLEN; a posição da Loading Zone é aproximada. Esta entrega não implementa pontuação completa, fases automáticas Auto/TeleOp, GARDEN ou configuração personalizada das regras.
- Referência normativa consultada: FIRST BIOBUZZ Competition Manual TU05, atualização de 15/10/2026, Sections 10–11, incluindo G410 e G426.
- Testes focados adicionados em `tests/test_rules.py`; resultado será registrado após execução.

## Fase 1 — descarte definitivo do relatório (16/10/2026)

- Depois de gerar o relatório final de uma partida, a interface deixa de tratar a partida como ativa; descartar o relatório agora continua descartando-o nos ciclos seguintes de telemetria.
- O E2E espera mais de dois ciclos de polling após o descarte para detectar eventual reaparecimento.

# 16/10/2026 — Identidade e trajetória do POLLEN

- Os quatro preloads agora são desenhados dentro do robô a partir dos mesmos IDs presentes no inventário.
- Intake conserva o objeto existente; o shooter posiciona esse mesmo ID na origem configurada e atualiza sua posição/altura durante o voo.
- Acerto previsto pelo modelo do HIVE resolve o objeto no estado pontuado. Um disparo que não acerta volta ao campo ao aterrissar e pode voltar a colidir/coletar.
- Snapshot inclui IDs do inventário, estado de voo e ID do lançamento. A resolução confere o ID da trajetória para rejeitar respostas atrasadas de disparos anteriores. Adicionados testes de conservação, origem, trajetória analítica independente, acerto, erro e rota HTTP.
- Aproximação: projétil ideal sem arrasto ou colisão 3D; impacto/pontuação ainda usa a previsão existente da interface.

# 16/10/2026 — Entrada física de NECTAR pela Loading Zone

- Um NECTAR reservado mantém o mesmo ID ao ser liberado por TIP/endgame e entra pelo estado transitório `entering`, com queda visual de 0,45 m na Loading Zone; depois passa a `field` e usa colisões/intake existentes.
- A queda é uma aproximação visual vertical: o manual TU05 G426/G427 libera a entrada após TIP/último minuto e exige que o Human Player introduza o NECTAR pela Loading Zone; o elemento não é ejetado do HIVE.
- Regressão verifica queda, conservação dos 16 NECTAR, IDs únicos e coleta de uma entrada anterior enquanto outra está entrando.
- Suíte local após a etapa HIVE/FLOWER: 92 testes aprovados, 14 testes de JVM ignorados por JDK ausente; `node --test tests/model.test.mjs` passou 28/28, `node --check web/app.js`, `py_compile` e `git diff --check` passaram. GitHub Actions run 38836939974, tentativa 2, passou no Windows e Linux, incluindo JVM real, nove OpModes, cenários de falha, Chromium e pacote Windows. A tentativa 1 falhou uma vez porque um teste de TeleOp observou `compilando` onde esperava `inicializando`; o teste passou sem mudanças de código na tentativa 2.

# 16/10/2026 — Estado do HIVE, FLOWER e pontuação estimada

- Cada elemento que pontuou em HIVE mantém o ID e a CELL de destino. Um TIP valida a CELL voltada para cima, transfere os mesmos elementos para `falling` e depois `field`; não cria cópias.
- A pontuação agora é calculada a partir dos estados dos elementos: HIVE TIP (20), elementos na CELL atualmente voltada para cima (2 cada), FLOWER (2 por elemento na sequência cujo dono é determinado pela última NECTAR; bônus estimado de 5 à primeira NECTAR), GARDEN (1 por peça em zona esquemática) e Major Foul G410 (20 pontos para o adversário).
- O relatório final usa a mesma fotografia de pontuação do servidor para ambas as alianças, separa categorias e explicita limitações. G410 é atribuído à aliança do robô que depositou, não à cor da NECTAR.
- A ordem de depósito é somente uma aproximação do empilhamento vertical na FLOWER; zonas GARDEN e conteúdo de CELL são simplificados. O TIP após oito elementos é didático e não uma constante oficial. Não há ranking points ou arbitragem completa.
- Suíte Python local: 92 testes aprovados, 14 testes de JVM ignorados por falta de JDK. Validação de JavaScript e CI desta revisão pendente.

# 16/10/2026 — Personalização visual do robô e rastro

- A aba Chassi agora permite alterar cor principal, cor dos detalhes e quatro decorações simples (sem detalhes, faixa central, faixas laterais ou painel frontal). Os desenhos respeitam largura e comprimento configurados sem alterar hitbox, mecanismos ou motores.
- O rastro laranja tem controle visual independente; desligá-lo apenas pula o desenho. O histórico `state.trail` continua recebendo posições e permanece disponível ao replay/diagnóstico.
- Preferências visuais são armazenadas localmente e no JSON do projeto, mas são filtradas antes de enviar configuração física ao servidor.
- Validação local: 28/28 testes do modelo JS, `node --check`, checagem de IDs HTML, `py_compile` e `git diff --check` passaram. E2E visual deste bloco aguarda CI.

# 17/10/2026 — Regressão do percurso padrão de partida

- Calibrada a mira inicial para acertar a CELL vermelha a partir da posição inicial; tiros com mira errada continuam errando e voltam ao campo.
- Capacidade inicial de oito peças permite coletar quatro POLLEN sem descarregar os quatro pré-carregados. Preset antigo não modificado salvo no navegador migra para os padrões corrigidos.
- POLLEN inicialmente em FLOWER reage ao contato fora do intake; mira alterada durante a partida passa ao servidor para tiros posteriores sem reescrever projéteis em voo.
- Corrigida a alternância da aba Regras; POLLEN e NECTAR têm desenho distinto no campo e no estoque; a vista lateral desenha as peças liberadas em queda.
- Regressões adicionais de partida padrão, erro de tiro, alteração de mira e colisão; resultado local documentado em VALIDACAO.md.

# 16/10/2026 — Reiniciar Java após relatório e STOP

- START não exige mais descartar o relatório de uma partida anterior. A nova execução produz um novo relatório ao terminar, mesmo que o anterior esteja salvo.
- INIT imediatamente após STOP aguarda até dois segundos pela limpeza do processo Java anterior antes de responder que a execução ainda está ocupada.
- O teste de partida no Chromium inclui reinício com relatório salvo após recarregar a página.
- Ajustes numéricos do shooter passam ao Java após 150 ms de edição válida; não precisam esperar que o campo perca o foco.
