# Meca Sim 0.2 — laboratório FTC em duas vistas

Simulador **local e independente** da Meca Tiger: cole uma classe Java `LinearOpMode`, configure o chassi diferencial, execute INIT/START e observe encoders, IMU, telemetria e trajetória. Inclui controles USB e teclado, vista de cima e estudo balístico lateral.

**Candidato a teste no computador da equipe.** SDK parcial; não substitui o robô. Modelos de falha são sintéticos e não são calibração. Repositório privado, ainda sem licença de distribuição definida.

## Abrir em três passos

1. Instale **Python 3.10+ e JDK 17+**. O iniciador procura também o JDK `jbr` do Android Studio no local padrão do Windows.
2. No GitHub, use **Code → Download ZIP**, extraia e abra `iniciar.bat`. Linux/macOS: `sh iniciar.sh`.
3. O navegador abre **http://127.0.0.1:8765**. Clique **Compilar / INIT**, aguarde `inicializando`, clique **START**. **STOP** encerra a JVM e zera motores.

Deixe o terminal aberto. Não exige bibliotecas Python para utilizar. Para diagnóstico, execute `python iniciar.py --diagnostico`. Outra porta: variável `SIM_PORT`. O servidor escuta exclusivamente o computador local.

**Cole somente Java confiável.** A JVM tem as permissões da sua conta e não está isolada para código malicioso. Esta implementação não deve ser usada como serviço público de execução de código.

## O que testar

| Área | Disponível na 0.2 |
| --- | --- |
| Java | Uma classe pública `LinearOpMode`, imports, pacote e auxiliares no mesmo arquivo; compilação real com `javac` |
| Movimento | Reta, ré, arcos e giro pelo centro; integração exata para velocidade constante |
| Configuração | Nomes, montagem física, bitola, largura/comprimento, posição e calculadora ticks/redução/roda |
| Sensores | Encoders lógicos, reset, IMU/yaw, resetYaw, temporizadores |
| Cenários | Motores com ganhos diferentes, limitação de aceleração, patinagem, encoders travados, IMU travada/atrasada/com deriva |
| Paredes | Bloqueio geométrico opcional do chassi no campo; rodas continuam patinando no modelo |
| Controles | Dois gamepads standard com índices preservados; teclado W/S, A/D, espaço, B/X/Y, setas |
| Proteções | STOP, duração máxima, watchdog JVM, entradas expiradas e perda de conexão do navegador |
| Lançador | Offset local preso ao chassi, altura, elevação, azimute, alvo e velocidade; solução inversa do tiro ideal |
| Arquivos | Salvar/reabrir projeto JSON, resultado JSON e trajetória CSV temporal |

O perfil inicial usa ME FORWARD, MD REVERSE e montagem direita invertida. É uma hipótese editável. O TeleOp histórico da equipe tem outra mistura; o teste preservado usa montagem dos dois lados invertida e **não comprova sinais do robô**.

Teclado: W/S alimenta `left_stick_y`, A/D alimenta `right_stick_x`, espaço é A. Foco no editor ou em campo não aciona teclado. Um gamepad conectado substitui o teclado do jogador 1. Desconectar o jogador 1 não transforma o jogador 2 em jogador 1. Ao perder foco, entradas zeram; ao ocultar a página, STOP; sem entradas por 0,3 s, controles zeram; sem heartbeat por 2 s, STOP. Botões LB/RB e gatilhos requerem gamepad físico nesta versão.

## Precisão e limites

- SI: metros, segundos; interface em graus. Yaw zero aponta para +Y, positivo anti-horário. **Não é mecanum e não anda de lado.**
- Física padrão ideal. Aceleração/ganhos/patinagem e falhas de sensor são parâmetros artificiais para testar lógica.
- Paredes rejeitam passos que colocariam parte do chassi fora do campo. Não simulam forças, rebote, obstáculos internos ou contato 3D.
- A parábola usa g=9,81 m/s², bola pontual sem arrasto. O cálculo inverso resolve velocidade e azimute com elevação fixa; não determina potência/RPM de MS nem confirma pontuação.
- MS/MI guardam comandos e ticks idealizados; não possuem peças, flywheel ou mecanismos simulados. Servo guarda posição lógica. Câmera/AprilTag, Android, Road Runner, SDK completo e projetos Java de múltiplos arquivos não estão implementados.
- Java e Python comunicam em tempo real; escalonamento do sistema introduz variações. Não há replay determinístico nem validação de ajuste PID físico.
- `RUN_TO_POSITION` é ideal e para até 2 ticks do alvo; com aceleração configurada, esse modo continua instantâneo. `RUN_USING_ENCODER` não simula o controlador interno REV.

Leia [cálculos e convenções](CALCULOS.md), [validação](VALIDACAO.md), [teste local](TESTE_LOCAL.md), [mudanças](CHANGELOG.md) e [próximas etapas](PLANEJAMENTO.md).

## Testes reproduzíveis

Execute na raiz deste repositório:

```sh
python -m unittest discover -s tests -v
node --test tests/model.test.mjs
python tests/repository_compatibility.py
python tests/fault_scenarios.py
```

JDK é obrigatório para os testes Java. Sem ele, os unitários marcam integração como ignorada; isso não é validação de Java. Node é apenas para testes. A CI executa Windows e Linux com Python 3.11, JDK 17, Node 22 e Chromium. Para testar interface: `pip install playwright==1.58.0`, `python -m playwright install chromium`, `python tests/browser_e2e.py`.

## Origem e histórico

Base 0.1 extraída de `meca-tiger-autonomo`, commit `d8363b58e502611ca5d5948fbd2f791b0a2e6cee`. O código do robô permanece naquele projeto. `tests/fixtures` contém cópias preservadas de nove OpModes somente para regressão; não são arquivos a instalar juntos no Control Hub.

Os commits são registrados diretamente neste repositório conforme solicitado. Para reverter uma evolução, use `git revert <commit>`; nunca é necessário apagar o histórico.
