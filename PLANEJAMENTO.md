# Plano do Meca Sim

## Etapa atual — candidato 0.3-rc1

Projeto independente, duas vistas, execução Java local, chassi diferencial, gamepads, cenários de falha, cálculos de lançamento, persistência e relatórios. Testes de unidade, regressão Java e integração da interface executados ou registrados na validação.

## Aceite local

Executar TESTE_LOCAL.md no computador da equipe. Resolver incompatibilidades de controle/driver e diferenças do ambiente antes de declarar uma versão estável.

## Limites que exigem desenvolvimento futuro

1. Ampliar APIs FTC a partir de casos reais; a importação de ZIP e múltiplos `.java` não executa tarefas Gradle nem suporta bibliotecas externas.
2. Modelo de lançador ligado ao motor MS e ao alimentador MI, baseado em medições de RPM, perdas e velocidade da bola.
3. Obstáculos internos e modelo de contato mais completo. A 0.2 tem apenas bloqueio geométrico nas paredes.
4. Câmera/AprilTag sintética com extrínsecos, IDs e poses oficiais verificadas; visão real requer ensaio próprio.
5. O EXE portátil automatizado elimina a instalação manual do Python, mas exige JDK 17+. Avaliar bundle legalmente distribuível de JDK para remover a dependência.
6. Distribuição pública e escolha de licença pelo proprietário. Não hospedar a JVM atual como executor público.

Nenhuma destas etapas é apresentada como pronta. O objetivo imediato é testar trajetórias e lógica de controle em desktop.
