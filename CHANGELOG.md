# Histórico de alterações

## 0.3-rc1 — preparação para lançamento

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
