# Validação — candidato 0.3-rc1

## Resultado local

Executados em Linux, Python e OpenJDK 17.0.20:

- Testes Python/JVM e Node: logs em `reports/python-tests.txt` e `reports/javascript-tests.txt`.
- Mil cenários de arco versus solução analítica, tolerância 1e-10 m; 500 soluções inversas balísticas confrontadas com equação direta.
- Nove OpModes originais compilaram contra a camada simulada; hashes em `tests/fixtures/ORIGEM.json`.
- Autonomo35 completo: aproximadamente 12,41 s, yaw 49,90°, motores zerados. TeleOp13: entrada, rampa, neutralização e STOP. Log `reports/compatibility.jsonl`.
- Falhas sintéticas do Autonomo35: encoder esquerdo travado, IMU travada e motor direito sem resposta. Resultado em `reports/fault-scenarios.json`.
- Diagnóstico do iniciador encontrou Java/javac 17 e Python.

Não confundir término normal da JVM (`concluído`) com sucesso do autônomo: nos cenários de falha, a telemetria deve informar interrupção e motores zerados.

## Integração e interface

O navegador remoto deste ambiente não alcança o servidor local (conexão recusada). A CI foi preparada para executar servidor + JVM + Chromium em Windows e Linux, incluindo INIT/START, lançamento, calculadora, exportar/reabrir projeto, CSV, teclado/STOP, erro de compilação e capturas desktop/celular. A base anterior, no commit `dcf77a4`, passou na CI Windows e Linux. As funções adicionais de ZIP e empacotamento exigem uma nova execução completa do Actions, incluindo testes Chromium e EXE.

## Importação de múltiplos arquivos Java

Testes adicionados para caminhos inválidos e compilação real de OpMode com classe auxiliar de outro pacote. Incluído teste Chromium para importar dois arquivos, compilar, executar e preservar o auxiliar no JSON. O resultado da nova CI ainda precisa ser confirmado no Actions; não representa calibração física.

## Importação de ZIP

Criados testes de ZIP válido, múltiplos OpModes, caminhos maliciosos, limites e execução no Chromium. Validar na nova CI Windows/Linux antes de marcar aprovada.

## EXE Windows portátil

Pipeline acrescentado: build PyInstaller, diagnóstico `java`/`javac`, teste HTTP de servidor com assets embutidos e upload de artefato somente após aprovação de Windows e Linux. Teste de execução em ambiente do usuário continua pendente.

## Não validado

Controle USB físico, instalação no Windows do usuário, robô real, câmera, arrasto, flywheel, obstáculos internos e pontuação. O servidor não isola Java malicioso. Ganhos, patinagem e falhas configuradas são aproximações sintéticas, não medição física.

## Reproduzir/reverter

Comandos no README. Para repetir a versão, usar o commit exato de Actions. Para desfazer código, `git revert` no commit desejado; o repositório antigo e suas fontes não foram alterados pela migração.
