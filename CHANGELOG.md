## Fase 1 — gamepad completo pelo teclado (15/10/2026)

- Teclas encaminhadas ao vetor virtual FTC de 20 slots do Gamepad 1; o OpMode recebe os mesmos eixos e botões usados pelo SDK parcial.
- Mapeamento: Q/E LS-X, W/S LS-Y, A/D RS-X, R/F RS-Y; Espaço/B/X/Y; Z/C LB/RB; 1/2 LT/RT digitais; setas D-pad; Enter/Backspace Start/Back; [/] cliques dos analógicos.
- Controle físico com mapeamento padrão permanece prioritário. Inputs do editor e controles HTML não são capturados como gamepad.
- Eixos e gatilhos via teclado são discretos; teste de mapeamento cobre os 20 slots. O mapa pode ser remapeado na interface e restaurado ao padrão; teclas duplicadas são rejeitadas.

## Fase 1 — atalhos do editor (15/10/2026)

- Ctrl+S no editor exporta o projeto pelo fluxo JSON existente; desfazer/refazer e clipboard permanecem nativos do textarea.
- Regressão Chromium adicionada para salvar, histórico de edição, seleção e clipboard.

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
