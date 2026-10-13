# Teste no computador da equipe

**Para 14/10/2026, use primeiro [TESTE_AMANHA.md](TESTE_AMANHA.md) e preencha [RESULTADO_TESTE.md](RESULTADO_TESTE.md).** O pacote Windows inclui `INICIAR_TESTE.bat` e mantém o diagnóstico salvo em arquivo.


1. Baixar ZIP da fonte e abrir `iniciar.bat`, ou baixar artefato `MecaSim-Windows-portatil` de um Actions aprovado e executar `MecaSim.exe`. Guardar mensagem completa se o JDK falhar.
2. Exemplo autônomo: INIT, esperar inicialização, START. Esperado: avançar 1 m, girar para cerca de +50°, avançar 0,6 m e zerar motores. Anotar pose e tempo; não exigir tempo idêntico entre computadores.
3. Exemplo TeleOp: compilar, START, clicar fora do editor, usar W/S e A/D. Conferir reta, ré e giro; STOP deve encerrar e zerar potências.
4. Conectar controle USB, pressionar botão, observar detecção. Conferir eixos e A/B/X/Y. Desconectar durante movimento: entrada deve zerar. Testar dois controles sem troca de jogadores.
5. Lançador: ajustar offset e girar o robô; o ponto deve acompanhar o chassi. Selecionar alvo e calcular tiro ideal. Esse teste não valida alcance real.
6. Salvar projeto, trocar valores e reabrir. Exportar CSV e conferir trajetória e encoders.
7. Colar Autonomo35: usar Y e depois A durante INIT antes de START. Para código próprio, conferir nomes e sinais de montagem.
8. Importar um ZIP FTC contendo `TeamCode/src/main/java`, escolher o OpMode e confirmar compilação; repetir com dois `.java` em pacotes diferentes e salvar/reabrir projeto JSON.
9. Registrar sistema, navegador, modelo do controle, commit, comportamento esperado/observado e JSON/CSV do resultado.

Ainda precisam de aferição física: bitola efetiva, diâmetro de roda, redução, ticks, sentidos de cada motor/yaw, velocidade máxima e velocidade real de lançamento. Não transferir ganhos de PID do simulador diretamente para o robô.
