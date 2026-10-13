# Meca Sim — instruções do projeto

- Projeto independente de simulador local. Mudanças solicitadas podem ser registradas diretamente em main, conforme autorização do proprietário nesta migração; não criar PR no repositório do robô.
- Preservar `tests/fixtures` byte a byte; são fontes históricas de regressão, não destino de melhorias.
- Não declarar suporte ao SDK completo nem precisão física com base em testes do modelo.
- Usar metros, segundos e yaw positivo anti-horário, frente +Y em zero. Montagem física e direção lógica de motor são sinais separados.
- Alterações de física exigem confronto com solução independente e falhas/limites pertinentes. Alterações da interface devem passar no teste Chromium da CI.
- Rodar testes Python, Node, compatibilidade, cenários de falha e browser_e2e; registrar falhas e testes não executados.
- Sem publicação de runner Java na internet. Não mudar visibilidade/licença, apagar históricos ou forçar push sem instrução específica.
- Atualizar README, CHANGELOG e VALIDACAO quando comportamento ou suporte mudarem.
