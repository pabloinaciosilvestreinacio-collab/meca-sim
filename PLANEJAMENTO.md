# Plano do Meca Sim

## Etapa atual — Fase 1 experimental

Branch `feature/fase1-editor-20261015`. O simulador existente foi preservado e segue baseado em Python (física/servidor), Java (LinearOpMode com SDK parcial) e JavaScript (interface/canvas).

Concluído nesta branch: correções do editor; gamepad de teclado completo e remapeável; modelo inicial de 40 POLLEN/16 NECTAR, estados e colisões leves, captura pelo MI, tiro MS+MI com consumo de inventário e relatório final persistente/exportável.

FLOWER: interação didática pelo servo virtual do OpMode aprovada e implementada nesta branch, com inventário, proximidade configurável e sequência visível; sem pontuação oficial. Em andamento: regras BIOBUZZ completas e personalizáveis, GARDEN, desbloqueio de NECTAR, pontuação por categoria e telemetria opcional. HIVE segue com limiar de 8 peças explicitamente didático, não oficial. Ainda não considerar a Fase 1 concluída nem a branch estável.

## Aceite local

Rodar unitários, compatibilidade dos OpModes, fault scenarios e E2E Chromium; consultar CI no branch. Validar controles reais e medidas de campo somente depois, sem afirmar fidelidade física a partir da simulação.

## Limites que exigem desenvolvimento futuro

1. Acerto de posições completas do campo via CAD STEP oficial; as atuais seguem aproximadas.
2. Shooter MS/MI com perfil configurável e evidência clara entre comando, disparo estimado e peça lançada.
3. Regras BIOBUZZ TU05 com modo oficial/personalizado, estados Flower/Hive, penalidades e pontuação verificáveis.
4. Relatório final persistente, JSON/CSV, telemetria opcional e distinguir Java encerrado de missão concluída.
5. Câmera/AprilTag sintética e execução Java em navegador são etapas posteriores à validação da Fase 1.

A publicação e integração ao Hub permanecem fora desta etapa.
