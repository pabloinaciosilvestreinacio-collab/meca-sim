# Validação — candidato 0.3-rc1

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
