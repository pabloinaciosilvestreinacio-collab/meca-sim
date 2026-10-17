## Bloco autorizado: regras configuráveis e fases — 16/10/2026

Autorização: resposta “Sim” à proposta de implementar regras e fases; retomada “Continue este chat”. Branch experimental `fix/pollen-lifecycle-20261016`; main e Hub preservados.

Decisões: perfil padrão denominado “Oficial — regras implementadas”, com cobertura parcial explícita; personalizado configura G410, penalidades implementadas, G426 e três grupos de pontuação. Perfil fixo após INIT para evitar reinterpretação retroativa da partida. Somente a fase pode mudar ao vivo, no tempo livre. A fase manual afeta condições temporais, não o OpMode, relógio ou inventário. Fonte: manual FIRST BIOBUZZ TU05, consultado em 16/10/2026, https://ftc-resources.firstinspires.org/ftc/game/manual (G410, G426, G427, tabelas 10-2 e 10-4).

Critérios: tempo livre não libera reservas pelo tempo; fase manual libera/restringe entradas futuras sem recolher peças liberadas; desligar pontos/penalidades não apaga efeitos físicos; G426 desligada nunca cria peças adicionais; dados de projeto e relatório preservam configuração; restauração e projetos antigos usam flags oficiais implementadas.

Validação local: 112 testes Python passaram sem skips (12 novos), 30 testes JavaScript passaram, nove OpModes compilaram contra o SDK parcial e os três cenários de falha passaram com motores zerados. Sintaxe Python/JavaScript e diff passaram. O ambiente não expõe o binário javac; um wrapper temporário invocou o módulo jdk.compiler da JVM 17 instalada. CI concluído com sucesso para `c9d11608f719340caebe73bd708f66f353acf593`: 112 testes Python sem skips e 30 JavaScript em Windows e Linux, compatibilidade e cenários de falha. Chromium/JVM real aprovou interface geral, ciclo de peças e novas partidas com perfis/fases, relatório, persistência JSON/recarga, restauração oficial e projeto antigo. Conferidas as capturas desktop/mobile; nenhum overflow horizontal no teste. Diagnóstico e smoke test do EXE Windows passaram, incluindo o painel e o perfil exposto pelo backend. Não houve execução local de navegador nesta etapa; os testes de navegador ocorreram no CI.

Evidência: [execução 38923070880](https://github.com/pabloinaciosilvestreinacio-collab/meca-sim/actions/runs/38923070880). [Pacote Windows deste bloco](https://github.com/pabloinaciosilvestreinacio-collab/meca-sim/actions/runs/38923070880/artifacts/12055448075). Evidências Linux `12055671966` e Windows `12055782629`. O commit seguinte apenas registra estes resultados, sem alterar o código testado.

Pendências fora deste bloco: autocomplete avançado; regras oficiais não modeladas (LEAVE/PARK, cartões, ranking points, acumulação AUTO/TELEOP), precisão de campo/CAD, controles físicos e fidelidade mecânica. As limitações estão também na interface; o perfil Oficial não é uma alegação de cobertura integral.

---

## Bloco: relatório e sobreposição inicial — 16/10/2026

Correções autorizadas após a auditoria: contador de tentativas vazias conectado ao relatório; contadores cumulativos de acertos, erros e tiros ainda em voo preservados após TIP/recaptura; categorias e registros completos no CSV; relatórios antigos exibem campos ausentes como não registrados; rótulo de pontos recebidos por penalidades corrigido. JSON e persistência mantidos.

Peças inicialmente dentro do chassi agora saem integralmente pela face viável mais próxima, incluindo a profundidade e o raio, sem escolher uma saída através da parede externa. Testes confrontam a distância ao retângulo com solução independente em quatro orientações e repetem o reinício sobre GARDEN da auditoria.

Arquivos: `elements.py`, `physics.py`, `server.py`, `web/app.js`, novo `web/report.mjs`; regressões em `tests/test_report_collision.py`, `tests/test_hive_cycle.py`, `tests/model.test.mjs`, `tests/partida_e2e.py` e `tests/packaged_smoke.py`.

Os modos de regras, controle manual de fases e autocomplete avançado continuam pendentes. Física permanece simplificada; esta alteração não é um solver rígido geral.

Validação concluída no commit `980f8e7c39b6deb19594ca0862efbe6bb7183592`: 100 testes Python e 30 JavaScript passaram localmente e em Windows/Linux, sem skips. Nove OpModes e três cenários de falha passaram localmente e no CI. Sintaxe e diff passaram. Chromium com JVM real aprovou a interface, partida, contadores do relatório, exportação CSV e persistência após recarregar em ambos os sistemas. O diagnóstico e smoke test do executável Windows passaram, incluindo o novo módulo `/report.mjs`.

Evidência: [execução 38886267563](https://github.com/pabloinaciosilvestreinacio-collab/meca-sim/actions/runs/38886267563). [Pacote Windows deste bloco](https://github.com/pabloinaciosilvestreinacio-collab/meca-sim/actions/runs/38886267563/artifacts/12039788844). Nenhuma publicação na main ou alteração no Hub. As pendências de relatório e sobreposição da auditoria abaixo descrevem o estado anterior.

---

# Auditoria de aderência aos pedidos — 16/10/2026

**Conclusão: o ciclo básico da partida está validado nos cenários ensaiados; o conjunto completo de pedidos da Fase 1 ainda não está concluído.** Aprovação dos testes existentes não representa cobertura de todos os requisitos.

Verificação desta revisão: 97 testes Python repetidos, todos passaram sem skips, e 28 testes JavaScript repetidos, todos passaram. Os logs da execução `38880163800`, do mesmo código funcional entregue, confirmam as partidas Chromium/JVM em Windows e Linux; o navegador não foi executado novamente localmente nesta revisão.

Comprovado: quatro preloads, redução de inventário por disparo, ausência de disparo vazio, captura via teclado/MI removendo a peça da arena, relançamento do mesmo ID, contribuição do NECTAR inicial, sete IDs liberados pelo TIP, queda até o piso, conservação 40 POLLEN + 16 NECTAR e recaptura de NECTAR no teste de física. A relação 3 NECTAR + 4 POLLEN é uma calibração de treino configurável, não uma massa ou um limiar oficial medido.

Pendências e defeitos reproduzidos:

1. **Relatório final — defeito confirmado:** executando a função real `reportData` com `launcher_status.empty_feed_attempts=5`, `activity.emptyFeedAttempts` não existe. A interface e o CSV leem esse campo e recebem `undefined`. O CSV também não contém todas as categorias de pontuação/penalidade solicitadas; contagem cumulativa completa de acertos e erros não está pronta. Arquivo: `web/app.js`.
2. **Autocomplete — requisito incompleto:** `candidates` para `DcMotor intakeEscolar;\nintakeEsc` devolve `[]`; `setPo` sugere apenas a string `setPower`, sem assinatura/parâmetros. Existe lista fixa, mas não análise dos símbolos locais nem sugestões completas por tipo. Arquivo: `web/editor.mjs`.
3. **Regras — requisito incompleto:** não existe modo Oficial/Personalizado com grupos de regras e penalidades habilitáveis/restauráveis. A pontuação é parcial e baseada em aproximações 2D. Arquivos: `rules.py`, `server.py`, interface.
4. **Tempo livre — requisito incompleto:** desativar o limite não oferece controle manual de fases. Ensaio TeleOp, cronômetro desativado, tempo 90 s: `endgame_unlocked=true`, pois o desbloqueio continua derivado do tempo decorrido. Não há comando implementado para escolher manualmente a fase relevante.
5. **Colisão em sobreposição inicial — defeito de borda reproduzido:** `Session({'x':.4,'y':.225})` é uma posição válida do chassi no campo. Após um passo de 0,01 s, `pollen-garden-red-2` e `pollen-garden-red-3` ainda têm o centro dentro do chassi. `_robot_collision` desloca pelo raio, mas não inclui toda a profundidade quando a peça começa dentro do retângulo. Isso não invalida os testes de contato externo, mas deixa este caso sem resolução imediata. Arquivo: `elements.py`.
6. **Validação restante:** controle físico não ensaiado, posições oficiais exatas e fidelidade mecânica não comprovadas. Aparência e opção de rastro estão implementadas, mas não receberam nesta revisão ensaio visual específico equivalente ao ciclo de peças.

Prioridade recomendada: relatório e sobreposição inicial; depois modos de regras/fases; depois autocomplete. Nenhuma mudança funcional foi aplicada nesta auditoria. Fases 2 e 3 continuam fora do escopo atual.

---

# Correção integrada da partida — 16/10/2026

Autorização: corrigir os nove defeitos apontados, mantendo o trabalho na branch experimental. Main e Meca Tiger Hub não foram alterados.

Causas confirmadas: a prévia incrementava um contador visual próprio; o TeleOp do bundle `examples.json` não acionava MI/MS; tombamento não considerava NECTAR inicial; `drawSide` desreferenciava `shot` nulo durante lançamento Java; direção do projétil convertia yaw que já estava em radianos. A combinação permitia tela congelada e contabilização visual sem alteração física.

Agora o servidor decide trajetória, entrada, carga e descarga. Renderização usa IDs/estados do snapshot. Teste independente verifica a parábola e compara Python/JavaScript em quatro orientações. O ciclo conserva 40 POLLEN + 16 NECTAR em captura, disparo, pontuação, queda e recaptura. A carga de treino é explicitamente configurável, sem alegação de massa oficial.

Validação local: `python -m unittest discover -s tests -v`: 97 casos, **83 passaram e 14 foram ignorados** por falta de javac. `node --test tests/model.test.mjs`: **28 passaram**. Sintaxe de app.js e scripts E2E passou. Compatibilidade de nove OpModes não executou por falta de JDK; cenários de falha foram tentados e interromperam pelo mesmo motivo. Instalação local de Chromium falhou (download truncado). Nenhum resultado local comprova JVM/navegador.

CI acrescenta `tests/partida_e2e.py`: teclado real → Java → MI/MS, estoque 4→3→0, HIVE com 3 NECTAR + 4 POLLEN, sete IDs caindo e chegando ao piso, nenhum tiro vazio, coleta de FLOWER via W+Z, novo disparo do ID coletado e ausência de erros JavaScript. Evidências em `reports/partida-checks.json` e PNGs. Execução inicial `38840182312`: 97 testes Python, 28 JavaScript, nove OpModes, cenários de falha e a suíte de interface anterior passaram em Windows/Linux. O novo teste de partida falhou porque seu helper de espera assíncrona devolvia um snapshot antes de a condição ser atendida (Linux: motores ainda neutros; Windows: ainda sem lançamento). Helper corrigido para aguardar e devolver o mesmo snapshot validado. A execução corrigida está registrada na seção de resultado abaixo. O teste do EXE também passou a verificar build, inventário, HIVE e TeleOp MI/MS no bundle.

Limites: física 2D leve, carga didática não calibrada com equipamento real, sem validação de gamepad físico. As seções abaixo são registros históricos e não substituem este estado atual.

## Resultado confirmado da correção — commit `7444cf22`

Execução: https://github.com/pabloinaciosilvestreinacio-collab/meca-sim/actions/runs/38880163800

- Windows e Linux: 97 testes Python passaram sem skips; 28 testes JavaScript passaram; nove OpModes preservados compilaram contra o SDK parcial; cenários de encoder travado, IMU travada e motor sem resposta passaram.
- Chromium + Java em ambos: suíte de interface anterior e nova partida passaram. O teste confirmou estoque 4→3→0; três NECTAR iniciais + quatro POLLEN provocam um TIP na calibração padrão; os mesmos sete IDs caem e chegam ao piso; estoque vazio não lança; W+Z coleta quatro POLLEN da FLOWER; deixam o campo e aparecem no armazenamento; C lança o mesmo ID e reduz o estoque. Nenhum erro JavaScript registrado nessas verificações.
- Conservação e recaptura de NECTAR após queda também passaram no teste Python do ciclo, mantendo separadas as reservas do Human Player.
- Evidências da partida: `reports/partida-checks.json`, `partida-01-preloads.png`, `partida-02-queda.png` e `partida-03-coleta.png` nos artefatos `evidencias-ubuntu-latest` e `evidencias-windows-latest` dessa execução.
- Validação local adicional: os 97 testes Python, a compatibilidade e os cenários de falha passaram após usar o compilador Java 17 já presente no módulo `jdk.compiler` do ambiente, via wrapper temporário de desenvolvimento. Esse wrapper não faz parte do produto nem altera a exigência de JDK no computador do usuário.
- Pacote Windows: job `116907046047` passou, incluindo diagnóstico do EXE e smoke test que confirma build, inventário de 4 peças/56 objetos, HIVE com 3 NECTAR e carga 4, painel Controles e TeleOp MI/MS efetivamente presentes nos recursos empacotados. Artefato `MecaSim-Windows-portatil` ID `12037004423`, 8.752.863 bytes. Download: https://github.com/pabloinaciosilvestreinacio-collab/meca-sim/actions/runs/38880163800/artifacts/12037004423 . A execução completa terminou com sucesso. Este registro final altera somente documentação; o código e o pacote testados são do commit `7444cf22b8575fba8e59107274904c07391fc90e`.

Arquivos centrais: `hive.py`, `elements.py`, `rules.py`, `physics.py`, `server.py`, `web/app.js`, `web/arena.mjs`, `web/index.html`, `examples/TeleOpDemo.java` e `examples.json`. Regressões novas em `tests/test_hive_cycle.py` e `tests/partida_e2e.py`; fluxo anterior e smoke test do EXE atualizados. Documentação e workflow registram a validação. Fixtures históricas não foram editadas; main e Meca Tiger Hub permanecem preservados.

Limites mantidos: carga/atrito/queda são aproximações didáticas, sem medição no robô real; controle físico não foi ensaiado; não equivale à validação completa de todas as regras FTC ou à conclusão de toda a Fase 1.


---

# Validação — gamepad de teclado

Bloco implementado na branch experimental: emulação dos 20 slots FTC usando somente teclas, com gatilhos digitais; entrada do teclado é fallback quando Gamepad 1 físico não está conectado. O vetor é o mesmo consumido pela camada Java. Não altera OpModes nem lógica de Gamepad 2.

Mapeamento aprovado: Q/E LS-X; W/S LS-Y; A/D RS-X; R/F RS-Y; Espaço/B/X/Y A/B/X/Y; Z/C LB/RB; 1/2 LT/RT; setas D-pad; Enter/Backspace Start/Back; [/] cliques. A interface agora documenta o mapa.

Validação local deste bloco: 5 asserções sobre vetor de 20 slots, eixos, botões, gatilhos digitais, remapeamento e neutralidade passaram; `web/app.js` passou `node --input-type=module --check`; `tests/browser_e2e.py` passou compilação sintática Python. O teste de interação Chromium foi acrescentado, mas ainda aguarda execução no workflow. Nenhum controle físico foi ensaiado.

Limitação: teclas e gatilhos são digitais e não reproduzem valores analógicos intermediários. O remapeamento persiste localmente neste navegador. Controles físicos padrão permanecem prioritários.


## Fase 1 — elementos e intake (15/10/2026)

Fonte de referência consultada: Competition Manual BIOBUZZ TU05, atualizado em 15/10/2026, e Field Setup Guide v1.0. A orientação inicial agora respeita HIVE vermelho com CELL inferior ascendente e HIVE azul com CELL superior ascendente. A configuração modela 40 POLLEN (16 em FLOWERS, 8 em GARDENS, 16 preloads) e 16 NECTAR (6 em CELLS ascendentes, 10 reservados em ALLIANCE AREAS). Para o robô virtual, quatro preloads ficam no inventário; preloads dos outros três robôs são reservas sem representação física de outros robôs. Posições são aproximadas.

Critérios cobertos: distinção por tipo/tamanho e estado, inventário com capacidade, captura somente com MI positivo e overlap do intake frontal, colisão sem captura fora do intake, amortecimento e contato com paredes e entre peças soltas.

Testes executados contra os fontes desta branch: 6 testes Python passaram (contagens de início, captura, limite de capacidade, colisão lateral, parede/amortecimento e contato peça-peça); integração `build_world`/`snapshot` passou (contagem, preload, arena livre e rejeição de capacidade inválida); sintaxe Python de `elements.py`, `physics.py`, `server.py` e E2E passou; `web/app.js` passou checagem de sintaxe e o modelo de teclado passou asserções de vetor e remapeamento. O teste de interação Chromium está adicionado, mas ainda não executado; workflow remoto após estes commits não foi confirmado. Nenhum ensaio físico.

Limites: partículas em FLOWER/HIVE e itens reservados são estados discretos, não corpos 3D; não há massas calibradas nem solver rígido. MS+MI agora consome POLLEN e emite evento balístico didático; coleta de NECTAR e arbitragem de FLOWER/GARDEN ainda não estão implementadas.

## Correções solicitadas: parede, HIVE e tempo

A colisão com a parede externa é agora imposta pelo servidor, portanto um valor antigo salvo no navegador não pode desligá-la. FLOWERS, HIVE e desenhos de campo seguem sem colisão, conforme o escopo solicitado.

O HIVE é modelado como quatro CELLs centrais selecionáveis a partir da vista superior. O corte lateral desenha um apoio triangular e uma face inclinada baseada na referência Desmos; é esquema 2D, não CAD. A condição de entrada usa trajetória ideal com gravidade, alcance, desvio lateral, raio do projétil e faixa vertical da abertura. Bolinhas acertadas ficam registradas nas duas vistas. “Tombamento” é estado visual de missão, não cálculo de impacto/massa.

Autônomo limita a 30 s e TeleOp a 120 s quando o cronômetro está habilitado; pode ser desligado para ensaio manual. A execução ainda depende de STOP, desconexão ou finalização do Java.

O diagnóstico do executável Windows tolera até 45 s para o primeiro processo Java, evitando falso negativo por inicialização lenta do runner.

CI deste commit deve ser consultada antes de qualificar esta versão como validada.

## Desmos: correção da arena e física do shooter

Disposição da arena estimada da imagem Desmos enviada pelo usuário (não CAD). Projeção lateral ao longo da direção de tiro. O veredito geométrico utiliza (i) projeção do deslocamento do alvo no eixo do tiro, (ii) desvio lateral na planta, (iii) altura no plano vertical do alvo e (iv) distância máxima até o solo. A velocidade por força usa trabalho ideal 0,5*m*v²=η*F*d; força média equivalente transmitida ao projétil não é diretamente a força do motor. Tolerâncias em metros, configuráveis; nenhum resultado determina pontuação oficial. Confirmar testes Actions deste commit.



## Implementações autorizadas (13/10/2026)

Linha do tempo visual com reprodução/parada/scrub do histórico gerado pela simulação (sem pausar a JVM), diagnóstico automático dos sensores e motors e editor diferencial (16 waypoints com giros e avanço). O gerador Java usa API FTC simulada e requer calibração, conferência de sinais e inspeção antes do uso físico. Posições dos elementos BIOBUZZ ainda aproximadas; dimensões da base HIVE 1,2565 × 0,9895 m, pivô 1,1165 m, abertura dos FLOWERS 0,546 m, GARDEN e LOADING ZONE conforme manual seção 9. Fonte: https://ftc-resources.firstinspires.org/ftc/archive/2027/game e CAD: https://ftc-resources.firstinspires.org/ftc/archive/2027/field. Não afirmar fidelidade à posição física completa da arena sem extrair/validar o STEP.

CI deste commit deve ser consultada antes de qualificar a versão como validada.

## Ampliação de interface (13/10/2026)

Arena BIOBUZZ desenhada em canvas como esquema didático e identificada como não calibrada; referências: https://ftc-resources.firstinspires.org/ftc/archive/2027/game e https://ftc-resources.firstinspires.org/ftc/archive/2027/field. O campo usa 3,66 m, mas zonas e elementos estão representados visualmente sem reprodução exata de CAD e sem colisões internas.

Fluxos adicionais de teste: escolha arena livre, alterar partida por clique e recuperar projeto da biblioteca; usar painel Driver Station; erro de compilação clicável; autocomplete local; disponibilizar novos módulos no EXE. Os novos testes dependem do resultado do Actions no commit correspondente. A logo oficial só aparecerá após a equipe fornecer o arquivo de imagem.


## Resultado local

Executados em Linux, Python e OpenJDK 17.0.20:

- Testes Python/JVM e Node: logs em `reports/python-tests.txt` e `reports/javascript-tests.txt`.
- Mil cenários de arco versus solução analítica, tolerância 1e-10 m; 500 soluções inversas balísticas confrontadas com equação direta.
- Nove OpModes originais compilaram contra a camada simulada; hashes em `tests/fixtures/ORIGEM.json`.
- Autonomo35 completo: aproximadamente 12,41 s, yaw 49,90°, motores zerados. TeleOp13: entrada, rampa, neutralização e STOP. Log `reports/compatibility.jsonl`.
- Falhas sintéticas do Autonomo35: encoder esquerdo travado, IMU travada e motor direito sem resposta. Resultado em `reports/fault-scenarios.json`.
- Diagnóstico do iniciador encontrou Java/javac 17 e Python.

Não confundir término normal da JVM (`concluído`) com sucesso do autônomo: nos cenários de falha, a telemetria deve informar interrupção e motores zerados.

### Revisão do diagnóstico do IMU — 13/10/2026

O painel agora exibe o yaw físico da simulação e a leitura de yaw entregue ao Java, indicando explicitamente quando o IMU está congelado. Foi acrescentada regressão para a versão histórica do Autônomo 3.1 com IMU travado: ela deve encerrar a primeira virada por timeout, publicar `Tempo limite da virada`, zerar motores e **não** publicar conclusão da missão. Essa verificação depende da execução dos testes Python/JVM no CI após o commit; não equivale a teste no Control Hub.

## Integração e interface

O navegador remoto deste ambiente não alcança o servidor local (conexão recusada). A CI foi preparada para executar servidor + JVM + Chromium em Windows e Linux, incluindo INIT/START, lançamento, calculadora, exportar/reabrir projeto, CSV, teclado/STOP, erro de compilação e capturas desktop/celular. A base anterior, no commit `dcf77a4`, passou na CI Windows e Linux. As funções adicionais de ZIP e empacotamento exigem uma nova execução completa do Actions, incluindo testes Chromium e EXE.

## Importação de múltiplos arquivos Java

Testes adicionados para caminhos inválidos e compilação real de OpMode com classe auxiliar de outro pacote. Incluído teste Chromium para importar dois arquivos, compilar, executar e preservar o auxiliar no JSON. O resultado da nova CI ainda precisa ser confirmado no Actions; não representa calibração física.

## Importação de ZIP

Criados testes de ZIP válido, múltiplos OpModes, caminhos maliciosos, limites e execução no Chromium. Validar na nova CI Windows/Linux antes de marcar aprovada.

## EXE Windows portátil

Pipeline acrescentado: build PyInstaller, diagnóstico `java`/`javac`, teste HTTP de servidor com assets embutidos e upload de artefato somente após aprovação de Windows e Linux. Teste de execução em ambiente do usuário continua pendente.

## Piloto presencial em 14/10/2026

Foi criado um pacote de teste com `INICIAR_TESTE.bat`, roteiro A1–A6 / B1–B8 e modelo de resultado. O status do empacotamento deve ser conferido no último GitHub Actions aprovado. O diagnóstico verifica o ambiente local mas não comprova integração com hardware real.

## Não validado

Controle USB físico, instalação no Windows do usuário, robô real, câmera, arrasto, flywheel, obstáculos internos e pontuação. O servidor não isola Java malicioso. Ganhos, patinagem e falhas configuradas são aproximações sintéticas, não medição física.

## Reproduzir/reverter

Comandos no README. Para repetir a versão, usar o commit exato de Actions. Para desfazer código, `git revert` no commit desejado; o repositório antigo e suas fontes não foram alterados pela migração.


## rc2 — validação adicional exigida

1. Diferencial: dirigir contra cada parede, em yaw 0°, 90°, 180° e -90°; a pose não pode ultrapassar os 3,66 m e FLORES/HIVE não podem bloquear.
2. Shooter: alterar cada controle de posição e confirmar mudança simultânea na origem superior/lateral; acertar uma CELL e verificar que a peça fica desenhada no HIVE.
3. Mecanum: em arena livre, FL/FR/BL/BR iguais avançam; padrão de strafe ideal desloca lateralmente; confirmar que esse perfil não altera o padrão diferencial ME/MD.

## Regressão E2E — relatório entre partidas (15/10/2026)

A execução `38826162266` (commit `71a5901`) passou nos testes Python/JVM, Node, compatibilidade de OpModes e cenários de falha, mas falhou nos dois sistemas operacionais no fluxo Chromium de múltiplos arquivos Java. A causa encontrada foi o fluxo do teste: após concluir uma partida, a interface exibe e preserva o relatório final; o botão START impede iniciar outra até que o relatório seja descartado. O E2E tentava executar mais partidas sem descartar o relatório anterior.

### Correção da regressão de interface — 16/10/2026

A revisão `91e8bca` removeu acidentalmente aproximadamente 390 linhas do final de `web/app.js`, incluindo a carga do exemplo inicial e handlers de início/parada, relatório, projetos e exportação. Por isso, a Action `38828881007` falhou no Chromium antes do primeiro passo de interface, embora testes Python/JVM, Node, nove OpModes e três falhas sintéticas tenham passado nos dois sistemas. O log apontou timeout aguardando o exemplo Java.

O arquivo completo da revisão anterior foi restaurado e recebeu apenas a alteração necessária em `buildFinalReport()` para encerrar o estado de partida ao montar o relatório. A suíte E2E agora também registra erros JavaScript, erros de console e requests com falha se o exemplo não carregar. A Action `38829334579` será usada para verificar esta correção; até seu resultado, interface permanece não validada.

Na Action `38829590023`, o E2E passou pelo exemplo inicial, movimentos, shooter/HIVE, Java, replay, exportações, projetos ZIP, TeleOp, Autônomo 3.5, autocomplete e layout móvel. O teste final de remapeamento tentou clicar em um controle oculto enquanto permanecia na aba Código. O controle fica na configuração do robô; o teste agora abre essa aba antes do clique.

Na Action `38830052723`, o E2E avançou além do teste anterior, mas falhou ao verificar a troca para outro OpMode depois de reabrir um projeto ZIP. A Action `38830336229` confirmou a causa: o teste lia duas opções antigas enquanto o JSON ainda era restaurado; o carregamento terminou depois e selecionou novamente o OpMode principal salvo. O E2E agora espera a mensagem de conclusão e confirma o OpMode principal restaurado antes de trocar para o outro. A validação Chromium completa aguarda nova execução.

`tests/browser_e2e.py` agora valida e descarta o relatório antes de cada partida seguinte. Os helpers de término também produzem status, telemetria, logs e aviso da interface caso o Java não alcance um estado terminal. Não houve alteração no comportamento do simulador.

Validação local nesta revisão (Python 3.12, OpenJDK 17.0.20, Node 24): 83 testes Python/JVM aprovados; 28 testes Node aprovados; compatibilidade compilou os nove OpModes; três cenários sintéticos de falha passaram; `py_compile` e `git diff --check` aprovados. O Chromium E2E não foi executado localmente: o download do navegador pelo Playwright retornou arquivo inválido de 0 bytes. A nova execução Actions em Windows e Linux ainda é necessária para validar este ajuste de interface.

### Correção do defeito revelado pela nova CI (16/10/2026)

A execução `38828447565` confirmou que o primeiro ajuste do teste ainda não bastava: a CI Linux chegou à execução de múltiplos arquivos, mas recebeu o aviso de que o relatório anterior não havia sido descartado. Causa: `readouts()` recriava o relatório a cada polling enquanto `matchStarted` permanecia verdadeiro, mesmo depois do clique explícito em Descartar.

`buildFinalReport()` agora encerra esse estado interno ao produzir o relatório. O E2E aguarda 250 ms (mais de dois ciclos de polling) e afirma que o relatório descartado continua oculto. Esta correção altera a interface; a nova CI Windows/Linux é necessária antes de considerar o bloco validado.

Verificação local da revisão: 83 testes Python/JVM, 28 testes Node, compatibilidade dos nove OpModes e três cenários sintéticos de falha aprovados; `py_compile`, `node --check` e `git diff --check` aprovados. E2E Chromium continua pendente localmente pelo download inválido do navegador; a nova Actions será o teste visual/integrado.


## Fase 1 — editor e atalhos (15/10/2026)

Escopo deste bloco: Ctrl+S no foco do editor chama o salvamento JSON existente; Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+C, Ctrl+V, Ctrl+X e Ctrl+A permanecem no comportamento nativo do textarea. A regressão Chromium verifica o projeto exportado, o histórico, seleção e cópia/colagem, e que Ctrl+S não inicia o OpMode. Ctrl+X permanece no comportamento nativo do textarea, mas o recorte não é aferido automaticamente porque o Chromium headless não o reproduziu de forma consistente; requer conferência manual. A validação da branch deve ser consultada antes de considerar o bloco aprovado.


## Correções solicitadas: parede, HIVE e tempo

A colisão com a parede externa é agora imposta pelo servidor, portanto um valor antigo salvo no navegador não pode desligá-la. FLOWERS, HIVE e desenhos de campo seguem sem colisão, conforme o escopo solicitado.

O HIVE é modelado como quatro CELLs centrais selecionáveis a partir da vista superior. O corte lateral desenha um apoio triangular e uma face inclinada baseada na referência Desmos; é esquema 2D, não CAD. A condição de entrada usa trajetória ideal com gravidade, alcance, desvio lateral, raio do projétil e faixa vertical da abertura. Bolinhas acertadas ficam registradas nas duas vistas. “Tombamento” é estado visual de missão, não cálculo de impacto/massa.

Autônomo limita a 30 s e TeleOp a 120 s quando o cronômetro está habilitado; pode ser desligado para ensaio manual. A execução ainda depende de STOP, desconexão ou finalização do Java.

O diagnóstico do executável Windows tolera até 45 s para o primeiro processo Java, evitando falso negativo por inicialização lenta do runner.

CI deste commit deve ser consultada antes de qualificar esta versão como validada.

## Desmos: correção da arena e física do shooter

Disposição da arena estimada da imagem Desmos enviada pelo usuário (não CAD). Projeção lateral ao longo da direção de tiro. O veredito geométrico utiliza (i) projeção do deslocamento do alvo no eixo do tiro, (ii) desvio lateral na planta, (iii) altura no plano vertical do alvo e (iv) distância máxima até o solo. A velocidade por força usa trabalho ideal 0,5*m*v²=η*F*d; força média equivalente transmitida ao projétil não é diretamente a força do motor. Tolerâncias em metros, configuráveis; nenhum resultado determina pontuação oficial. Confirmar testes Actions deste commit.



## Implementações autorizadas (13/10/2026)

Linha do tempo visual com reprodução/parada/scrub do histórico gerado pela simulação (sem pausar a JVM), diagnóstico automático dos sensores e motors e editor diferencial (16 waypoints com giros e avanço). O gerador Java usa API FTC simulada e requer calibração, conferência de sinais e inspeção antes do uso físico. Posições dos elementos BIOBUZZ ainda aproximadas; dimensões da base HIVE 1,2565 × 0,9895 m, pivô 1,1165 m, abertura dos FLOWERS 0,546 m, GARDEN e LOADING ZONE conforme manual seção 9. Fonte: https://ftc-resources.firstinspires.org/ftc/archive/2027/game e CAD: https://ftc-resources.firstinspires.org/ftc/archive/2027/field. Não afirmar fidelidade à posição física completa da arena sem extrair/validar o STEP.

CI deste commit deve ser consultada antes de qualificar a versão como validada.

## Ampliação de interface (13/10/2026)

Arena BIOBUZZ desenhada em canvas como esquema didático e identificada como não calibrada; referências: https://ftc-resources.firstinspires.org/ftc/archive/2027/game e https://ftc-resources.firstinspires.org/ftc/archive/2027/field. O campo usa 3,66 m, mas zonas e elementos estão representados visualmente sem reprodução exata de CAD e sem colisões internas.

Fluxos adicionais de teste: escolha arena livre, alterar partida por clique e recuperar projeto da biblioteca; usar painel Driver Station; erro de compilação clicável; autocomplete local; disponibilizar novos módulos no EXE. Os novos testes dependem do resultado do Actions no commit correspondente. A logo oficial só aparecerá após a equipe fornecer o arquivo de imagem.


## Resultado local

Executados em Linux, Python e OpenJDK 17.0.20:

- Testes Python/JVM e Node: logs em `reports/python-tests.txt` e `reports/javascript-tests.txt`.
- Mil cenários de arco versus solução analítica, tolerância 1e-10 m; 500 soluções inversas balísticas confrontadas com equação direta.
- Nove OpModes originais compilaram contra a camada simulada; hashes em `tests/fixtures/ORIGEM.json`.
- Autonomo35 completo: aproximadamente 12,41 s, yaw 49,90°, motores zerados. TeleOp13: entrada, rampa, neutralização e STOP. Log `reports/compatibility.jsonl`.
- Falhas sintéticas do Autonomo35: encoder esquerdo travado, IMU travada e motor direito sem resposta. Resultado em `reports/fault-scenarios.json`.
- Diagnóstico do iniciador encontrou Java/javac 17 e Python.

Não confundir término normal da JVM (`concluído`) com sucesso do autônomo: nos cenários de falha, a telemetria deve informar interrupção e motores zerados.

### Revisão do diagnóstico do IMU — 13/10/2026

O painel agora exibe o yaw físico da simulação e a leitura de yaw entregue ao Java, indicando explicitamente quando o IMU está congelado. Foi acrescentada regressão para a versão histórica do Autônomo 3.1 com IMU travado: ela deve encerrar a primeira virada por timeout, publicar `Tempo limite da virada`, zerar motores e **não** publicar conclusão da missão. Essa verificação depende da execução dos testes Python/JVM no CI após o commit; não equivale a teste no Control Hub.

## Integração e interface

O navegador remoto deste ambiente não alcança o servidor local (conexão recusada). A CI foi preparada para executar servidor + JVM + Chromium em Windows e Linux, incluindo INIT/START, lançamento, calculadora, exportar/reabrir projeto, CSV, teclado/STOP, erro de compilação e capturas desktop/celular. A base anterior, no commit `dcf77a4`, passou na CI Windows e Linux. As funções adicionais de ZIP e empacotamento exigem uma nova execução completa do Actions, incluindo testes Chromium e EXE.

## Importação de múltiplos arquivos Java

Testes adicionados para caminhos inválidos e compilação real de OpMode com classe auxiliar de outro pacote. Incluído teste Chromium para importar dois arquivos, compilar, executar e preservar o auxiliar no JSON. O resultado da nova CI ainda precisa ser confirmado no Actions; não representa calibração física.

## Importação de ZIP

Criados testes de ZIP válido, múltiplos OpModes, caminhos maliciosos, limites e execução no Chromium. Validar na nova CI Windows/Linux antes de marcar aprovada.

## EXE Windows portátil

Pipeline acrescentado: build PyInstaller, diagnóstico `java`/`javac`, teste HTTP de servidor com assets embutidos e upload de artefato somente após aprovação de Windows e Linux. Teste de execução em ambiente do usuário continua pendente.

## Piloto presencial em 14/10/2026

Foi criado um pacote de teste com `INICIAR_TESTE.bat`, roteiro A1–A6 / B1–B8 e modelo de resultado. O status do empacotamento deve ser conferido no último GitHub Actions aprovado. O diagnóstico verifica o ambiente local mas não comprova integração com hardware real.

## Não validado

Controle USB físico, instalação no Windows do usuário, robô real, câmera, arrasto, flywheel, obstáculos internos e pontuação. O servidor não isola Java malicioso. Ganhos, patinagem e falhas configuradas são aproximações sintéticas, não medição física.

## Reproduzir/reverter

Comandos no README. Para repetir a versão, usar o commit exato de Actions. Para desfazer código, `git revert` no commit desejado; o repositório antigo e suas fontes não foram alterados pela migração.


## rc2 — validação adicional exigida

1. Diferencial: dirigir contra cada parede, em yaw 0°, 90°, 180° e -90°; a pose não pode ultrapassar os 3,66 m e FLORES/HIVE não podem bloquear.
2. Shooter: alterar cada controle de posição e confirmar mudança simultânea na origem superior/lateral; acertar uma CELL e verificar que a peça fica desenhada no HIVE.
3. Mecanum: em arena livre, FL/FR/BL/BR iguais avançam; padrão de strafe ideal desloca lateralmente; confirmar que esse perfil não altera o padrão diferencial ME/MD.


## Fase 1 — editor e atalhos (15/10/2026)

Escopo deste bloco: Ctrl+S no foco do editor chama o salvamento JSON existente; Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+C, Ctrl+V, Ctrl+X e Ctrl+A permanecem no comportamento nativo do textarea. A regressão Chromium verifica o projeto exportado, o histórico, seleção e cópia/colagem, e que Ctrl+S não inicia o OpMode. Ctrl+X permanece no comportamento nativo do textarea, mas o recorte não é aferido automaticamente porque o Chromium headless não o reproduziu de forma consistente; requer conferência manual. A validação da branch deve ser consultada antes de considerar o bloco aprovado.


## Shooter e relatório final (15/10/2026)

MS acima de 0,5 e MI acima de 0,5 alimentam o shooter virtual; cada intervalo (0,8 s inicial, configurável) consome uma peça do inventário. Estoque vazio não produz disparo e incrementa `empty_feed_attempts`. A velocidade ainda vem do perfil balístico configurado, sem leitura de RPM.

`Terminar simulação` encerra o OpMode e preserva um relatório no navegador até descarte. O relatório inclui estado final do Java, duração, elementos coletados/lançados, tentativas vazias, logs, telemetria e diagnósticos; JSON/CSV podem ser exportados. O valor de pontuação é parcial e didático: não inclui FLOWER/GARDEN, penalidades ou ranking points. Java `concluído` significa apenas término normal do programa, não êxito da missão.

Testes unitários executados neste bloco: `tests/test_elements.py` (8/8 aprovados, incluindo MS/MI e inventário vazio); validação de configuração de tiro e limites inválidos passou; sintaxe de `server.py`/`tests/browser_e2e.py` e `web/app.js` foi checada. O painel de telemetria é recolhível e inclui entradas digitais/eixos dos gamepads. E2E Chromium e CI remoto após estes commits ainda não foram executados/confirmados.


## Interação com FLOWER — servo do OpMode (15/10/2026)

Implementada em branch experimental. Configura-se o nome do servo (padrão `flower`), a posição de acionamento (0,8) e o alcance ao centro do FLOWER (0,65 m). A transição abaixo→acima da posição, feita pelo OpMode Java enquanto executa, consome a primeira peça do inventário, atualiza o estado e registra a sequência. É necessário retrair para acionar novamente. Sem inventário, fora da distância configurada ou sem execução Java, nenhuma peça é consumida. O painel Driver Station exibe os oito depósitos mais recentes.

A proximidade é uma aproximação didática ao centro da estrutura. Este bloco não decide pontuação, posse, sequências oficiais nem liberação de NECTAR; não declarar regras FLOWER completas.

Testes em `tests/test_elements.py`: 12/12 passaram em execução Python em memória com os módulos da branch (incluindo consumo/ordem, proximidade, acionamento por borda e bloqueio sem OpMode ativo). Sintaxe Python dos quatro arquivos e sintaxe JavaScript de `web/app.js` também passaram. A CI remota não apresentou workflows/status para o commit, e E2E Chromium não foi executado; continua pendente a validação visual/integrada.

## Validação Chromium da branch experimental (16/10/2026)

Na Action `38830725490`, os testes de Python/JVM, JavaScript, nove OpModes e cenários de falha passaram no Linux e Windows. O Chromium passou por partida, Java, replay, exportação, ZIP, TeleOp, editor e layout responsivo; o teste final falhou pois não expandia “Personalizar teclas”. Na Action `38831238464`, após abrir o painel, o E2E avançou pelo remapeamento A e detectou ambiguidade no seletor de B (também correspondia a “Back”). O teste agora usa correspondência exata. O simulador não foi alterado nesses ajustes; a validação integral deve ser repetida antes de considerar este bloco fechado.

## Ciclo do POLLEN — validação em andamento (16/10/2026)

O mesmo ID acompanha inventário, origem do shooter, trajetória, acerto previsto ou aterrissagem no campo. A trajetória balística foi comparada com as equações independentes de movimento uniforme horizontal e queda sob gravidade. A vista de cima desenha os quatro elementos do inventário dentro do robô e os disparos a partir do estado do mundo.

Resultados locais da etapa POLLEN: `python -m unittest discover -s tests -v` executou 87 testes, todos passaram; 14 testes Java foram ignorados porque `javac` não está instalado neste ambiente. `node --test tests/model.test.mjs` passou 28/28; `node --check web/app.js`, `python -m py_compile elements.py physics.py server.py tests/test_elements.py` e `git diff --check` passaram. `tests/repository_compatibility.py` e `tests/fault_scenarios.py` não puderam executar localmente pela falta do JDK; `tests/browser_e2e.py` não iniciou porque o Chromium do Playwright não está instalado. A Action `38834259628` passou no Windows e Linux, incluindo JVM, compatibilidade de nove OpModes, falhas, Chromium e smoke test do pacote portátil Windows. Limites: voo ideal sem arrasto/colisão 3D e avaliação do HIVE permanece didática.

## Entrada e coleta física de NECTAR pela Loading Zone (16/10/2026)

O Human Player agora muda o mesmo NECTAR reservado para `entering`; o objeto é renderizado durante uma queda vertical aproximada de 0,45 m e então passa a `field`, onde a física de colisão e o intake já existentes podem interagir com ele. G426/G427 foram conferidas no manual TU05: o TIP libera uma entrada, mas o Human Player continua introduzindo a peça pela Loading Zone; não há ejeção física de NECTAR do HIVE. O estado anterior de NECTAR no campo continua ativo enquanto a entrada seguinte ocorre.

Resultados locais: `python -m unittest discover -s tests -v` passou 88 testes, com 14 testes de JVM ignorados por falta de JDK; teste dedicado percorre entrada, queda, conservação de 16 IDs e captura enquanto uma segunda peça entra. `python -m unittest tests.test_rules -v` passou 10/10; `node --test tests/model.test.mjs` passou 28/28. E2E Chromium, verificações que exigem JDK e CI para este commit ainda não executados. A queda 0,45 m é somente uma aproximação visual, e as posições das Loading Zones continuam esquemáticas.

## HIVE/FLOWER — liberação e estimativa de pontuação (16/10/2026)

Cada elemento que pontuou em uma CELL mantém seu ID; ao virar o HIVE, a CELL que passou a ficar para baixo libera os elementos como `falling`, e eles retornam ao piso como `field`. O TIP valida a CELL ativa no servidor. FLOWER calcula o dono pela última NECTAR depositada, contabiliza 2 pontos por elemento nessa FLOWER e estima o bônus de 5 pontos da NECTAR inferior pela ordem de depósito. GARDEN soma peças cujo círculo intersecta zonas 2D esquemáticas. O snapshot de pontuação é a fonte do relatório para as duas alianças.

G410 é registrado quando NECTAR é depositada antes dos últimos 60 segundos; os 20 pontos estimados são atribuídos à aliança do robô infrator. HIVE TIP vale 20 pontos. Elementos na CELL ativa valem 2 pontos por item. A ativação do TIP usa oito elementos como gatilho didático, não como requisito oficial.

Validação local desta revisão: `python -m unittest discover -s tests -v` executou 92 testes, todos passaram; 14 testes que exigem JDK foram ignorados por ausência de `javac`. `node --test tests/model.test.mjs` passou 28/28; `node --check web/app.js`, `python -m py_compile rules.py elements.py physics.py server.py tests/test_rules.py tests/test_elements.py` e `git diff --check` passaram. GitHub Actions run 38836939974, tentativa 2, passou no Windows e Linux, incluindo Java real, nove OpModes, cenários de falha, Chromium e pacote portátil Windows. Na tentativa 1, um teste de TeleOp falhou ao observar o estado transitório `compilando`; passou na repetição sem mudança de código. Limites: ordem de depósito não mede posição vertical da FLOWER; zonas GARDEN, queda após TIP e estado das CELLs são aproximações 2D; não há ranking points nem arbitragem completa.

## Aparência do robô e visibilidade do rastro (16/10/2026)

A aba Chassi adiciona ajustes visuais de cor do chassi/detalhes e decoração. São desenhados no canvas por coordenadas locais do corpo, sem mudar dimensões, colisões, posição do intake ou parâmetros dos motores. O checkbox do rastro controla apenas a renderização; a coleta de pontos `state.trail` permanece ativa.

Validação local: `node --check web/app.js`, `node --test tests/model.test.mjs` (28/28), verificação de IDs únicos e presença dos controles no HTML, `python -m py_compile server.py` e `git diff --check` passaram. Ainda falta executar a integração Chromium no CI para validar visualmente persistência e alternância do rastro.

## Regressão observada no percurso padrão (17/10/2026)

Reprodução anterior: sem alterar mira, o TeleOp consumia os quatro POLLEN pré-carregados e registrava quatro erros; o HIVE não virava e os três NECTAR continuavam na CELL. A mira padrão (8 N e azimute 0°) não apontava para a abertura. A correção usa parâmetros didáticos calculados para a posição inicial (7,921 N; 29,82°), mantém a detecção real da entrada na CELL e não converte erros em acertos automaticamente. A capacidade padrão passa a oito para permitir capturar até quatro peças além das quatro pré-carregadas. Um preset antigo intacto salvo no navegador migra a mira e a capacidade padrão; configurações modificadas pelo usuário são preservadas.

Foi corrigida a colisão do robô com POLLEN inicialmente nas FLOWERS fora da área de intake, a alternância da aba Regras e a aplicação de mudanças de mira ao servidor durante a execução. O lançamento em voo preserva a própria configuração; ajustes afetam apenas disparos posteriores. A vista lateral agora desenha os objetos do HIVE em queda e a vista superior distingue estoque do robô, POLLEN e NECTAR.

`python -m unittest discover -s tests -q`: 116 testes, aprovação local (14 casos Java ignorados pela ausência de JDK). `node --test tests/model.test.mjs`: 30/30. Os testes novos percorrem a trajetória padrão (4 tiros, 4 acertos, 1 TIP, 7 IDs em queda e depois no campo), mira antiga incorreta (4 erros), troca de mira em tempo de execução e colisão/captura em FLOWER. A integração Chromium/Java real e pacote distribuível ainda precisam da Action para atestar o comportamento na interface. O limiar de carga e trajetória continuam aproximações didáticas, não valores oficiais de tombamento.

Verificação adicional com compilador Java 17 local (`java -m jdk.compiler/com.sun.tools.javac.Main` disponibilizado como `javac`): os 116 testes Python passaram sem ignorados; `tests/repository_compatibility.py` compilou os nove OpModes preservados, e `tests/fault_scenarios.py` passou os três cenários de falha. `node --check web/app.js` e `git diff --check` passaram. A Action ainda não iniciou para o commit desta correção; o navegador Chromium também não pôde ser instalado aqui porque o download do Playwright retornou um arquivo ZIP inválido. Portanto, a prova ponta a ponta visual e o pacote Windows desta revisão continuam pendentes; nenhum artefato de execução anterior deve ser atribuído a este commit.
