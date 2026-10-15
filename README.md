# Meca Sim 0.3-rc2 — laboratório FTC em duas vistas

Simulador **local e independente** da Meca Tiger: cole uma classe Java `LinearOpMode`, configure o chassi diferencial, execute INIT/START e observe encoders, IMU, telemetria e trajetória. Inclui controles USB e teclado, vista de cima e estudo balístico lateral.

### Referência Desmos: arena e viabilidade do lançamento

- Arena BIOBUZZ com disposição ilustrativa baseada na imagem Desmos da equipe: CELLS vermelhas à esquerda, azuis à direita, zonas vermelhas e azuis nas bordas correspondentes e marcadores laranja. As coordenadas são estimadas visualmente, não levantadas do CAD.
- Vista de cima: posição, heading, trilha e mira. Vista lateral: altura, ângulo da rampa, trajetória parabólica pontilhada, alvo e indicação matemática SIM/NÃO.
- Dois modos: força média equivalente em newtons ou velocidade de saída em m/s. No modo força, `v=sqrt(2*eficiência*força*curso/massa)`; `força` não representa torque/potência do shooter MS.
- A verificação SIM/NÃO utiliza alcance horizontal, erro lateral e diferença de altura na distância do alvo, segundo tolerâncias ajustáveis. Não representa pontuação oficial nem inclui arrasto, spin, impacto, mecanismos ou perdas variáveis.

### Atualização rc2: física, shooter e configuração

- **Parede física ativa por padrão:** somente as quatro paredes externas bloqueiam o chassi. FLOWERS, HIVE e marcações do campo continuam visuais, sem colisão.
- **Shooter conectado às duas vistas:** controles de esquerda/direita, frente/trás e altura usam a mesma origem presa ao chassi. Um acerto em uma CELL configurada do HIVE deixa a peça desenhada dentro dela. É um modelo balístico ideal com gravidade, não pontuação oficial.
- **Drivetrain selecionável:** diferencial é o perfil padrão da Mequinha (ME/MD). Mecanum é um modo alternativo, com FL/FR/BL/BR e cinemática ideal, para testar projetos de outras equipes.
- **Escala e visual:** a arena é 3,66 × 3,66 m no modelo; a interface utiliza a marca vetorial Meca Tiger, cor de robô configurável e painéis Código/Chassi/Shooter.

### Nova interface: campos, projetos e editor

- **Arena:** seletor entre `BIOBUZZ 2026–2027` e `Arena livre`. As dimensões principais agora refletem o manual oficial: quadro HIVE de 1,2565 × 0,9895 m, pivô a 1,1165 m, espaçamento das CELLS 0,478 m, abertura dos FLOWERS a 0,546 m, GARDENS 0,584 × 0,051 m e LOADING ZONES 0,584 × 0,2795 m. Posições individuais e orientação das CELLS/FLOWERS continuam **esquemáticas**, não reproduzidas do STEP oficial; não existem colisões internas, articulações ou pontuação.
- **POLLEN/NECTAR e intake (experimental):** 40 POLLEN e 16 NECTAR têm tipo, tamanho e estado separados (em campo, FLOWER/HIVE, preload/inventário ou reservado). O modelo posiciona peças em FLORES, GARDENS, CELLS e zonas por aproximação 2D. Quatro POLLEN começam no inventário do robô. A região frontal do intake acompanha a largura e o alcance editáveis (padrão 0,15 m); MI positivo coleta somente dentro da região e até a capacidade configurada (padrão 4). Peças livres têm amortecimento e colisões leves com outras peças, chassi e paredes. Massas, contatos 3D, posições finas, chute via MS e pontuação oficial ainda não estão completos.
- **Posição inicial:** `Definir posição inicial no campo` (ou Shift+clique). O robô deve caber inteiramente no retângulo 3,66 m × 3,66 m. O clique simples continua apontando o alvo do lançador.
- **Biblioteca:** `Guardar no menu` salva até 12 projetos nomeados no armazenamento local do navegador; o seletor `Exemplo de partida` mostra os exemplos e os projetos. `Salvar projeto` exporta JSON e também adiciona o código à biblioteca, usando o nome da classe Java quando possível. Abrir JSON também tenta adicioná-lo à biblioteca.
- **Driver Station virtual:** INIT, START e STOP na área de hardware executam as mesmas ações do painel superior. Não se conecta ao Driver Hub.
- **Editor Java:** texto editável, realce local leve, sugestões via digitação/Ctrl+Espaço, Tab para completar, Ctrl+S para exportar o projeto JSON e atalhos nativos do campo de texto para desfazer/refazer/copiar/colar/recortar/selecionar tudo; erros do `javac` mostram arquivo e linha. Não é um IDE completo nem oferece compreensão semântica das bibliotecas FTC ausentes.
- **Identidade:** o botão `Inserir logo da equipe` permite escolher o PNG/JPG/WebP oficial, reduzido para armazenamento local e mostrado na marca do cabeçalho. Enquanto o arquivo não for fornecido, aparece uma marca provisória `MT`. A logo **não é enviada ao GitHub ou a servidores**.

- **Replay:** `Linha do tempo` permite carregar a última trajetória registrada (amostras de aproximadamente 0,05 s), selecionar instantes e reproduzir/pausar a visualização. O Java não é pausado nem controlado durante replay; use STOP normalmente.
- **Diagnóstico automático:** exibe avisos de IMU/encoder congelados, motor comandado sem avanço, polaridade provável invertida e timeout indicado por telemetria. Avisos não substituem diagnóstico do robô físico, nem alteram potência.
- **Rotas:** `Editor de trajetórias` cria até 16 waypoints em metros e gera Java com giros relativos e deslocamentos por encoders. O sistema alerta quando um trecho atravessa a base esquemática do HIVE; não há cálculo de rota evitando obstáculos nem calibração de PID real.

Os projetos da biblioteca e a logo ficam apenas no **navegador usado**, podendo ser perdidos ao limpar os dados do site; exporte JSON para backup.

**Candidato de lançamento técnico, ainda sujeito a validação física e testes de uso no computador da equipe.** SDK parcial; não substitui o robô. Modelos de falha são sintéticos e não são calibração. Repositório privado, ainda sem licença de distribuição definida.

**Interpretação dos resultados:** o estado `concluído` indica apenas que o programa Java terminou normalmente; uma sequência autônoma também pode terminar por timeout ou falha controlada. Confira sempre a telemetria. A interface mostra separadamente o **yaw real** da pose simulada e o **yaw IMU** que o Java recebe (relativo ao último `resetYaw()`), além de indicar quando a opção de IMU travado está ativa.

## Para o teste de 14/10/2026

Use o pacote Windows da última execução **aprovada** no GitHub Actions. Ele contém `MecaSim.exe`, `INICIAR_TESTE.bat`, `TESTE_AMANHA.md` e `RESULTADO_TESTE.md`. Extraia todos na mesma pasta, execute **INICIAR_TESTE.bat** e siga a tabela A1–A6 do roteiro. O diagnóstico é salvo em `mecasim-diagnostico.txt`. Consulte [roteiro de amanhã](TESTE_AMANHA.md) e [registro de resultados](RESULTADO_TESTE.md).

## Windows sem instalar Python

O pipeline de CI prepara um executável portátil **MecaSim.exe**, disponível em **Actions → Validar Meca Sim → execução aprovada → Artifacts → MecaSim-Windows-portatil**. Extraia o artefato antes de executar. O executável inclui Python, servidor e interface e é verificado por um teste de inicialização no Windows. **Ele ainda exige JDK 17+ com java e javac**: pode reutilizar um JDK instalado ou o `jbr` do Android Studio. O arquivo não é assinado e o Windows pode emitir um aviso SmartScreen. Ainda não é uma distribuição pública com instalador.

## Abrir em três passos

1. Instale **Python 3.10+ e JDK 17+**. O iniciador procura também o JDK `jbr` do Android Studio no local padrão do Windows.
2. No GitHub, use **Code → Download ZIP**, extraia e abra `iniciar.bat`. Linux/macOS: `sh iniciar.sh`.
3. O navegador abre **http://127.0.0.1:8765**. Clique **Compilar / INIT**, aguarde `inicializando`, clique **START**. **STOP** encerra a JVM e zera motores.

Deixe o terminal aberto. Não exige bibliotecas Python para utilizar. Para diagnóstico, execute `python iniciar.py --diagnostico`. Outra porta: variável `SIM_PORT`. O servidor escuta exclusivamente o computador local.

**Cole somente Java confiável.** A JVM tem as permissões da sua conta e não está isolada para código malicioso. Esta implementação não deve ser usada como serviço público de execução de código.

## O que testar

| Área | Disponível no candidato 0.3 |
| --- | --- |
| Java | Uma classe pública `LinearOpMode` e até 30 arquivos Java auxiliares; compilação real com `javac` |
| Movimento | Reta, ré, arcos e giro pelo centro; integração exata para velocidade constante |
| Configuração | Nomes, montagem física, bitola, largura/comprimento, posição e calculadora ticks/redução/roda |
| Sensores | Encoders lógicos, reset, IMU/yaw, resetYaw, temporizadores |
| Cenários | Motores com ganhos diferentes, limitação de aceleração, patinagem, encoders travados, IMU travada/atrasada/com deriva |
| Paredes | Bloqueio geométrico opcional do chassi no campo; rodas continuam patinando no modelo |
| Controles | Dois gamepads standard com índices preservados; teclado W/S, A/D, espaço, B/X/Y, setas |
| Proteções | STOP, duração máxima, watchdog JVM, entradas expiradas e perda de conexão do navegador |
| Lançador | Offset local preso ao chassi, altura, elevação, azimute, alvo e velocidade; solução inversa do tiro ideal |
| Arquivos | Salvar/reabrir projeto JSON, importar arquivos `.java`/ZIP TeamCode, resultado JSON e trajetória CSV temporal |

### Importar projeto FTC ZIP

Na aba **Código Java**, também é possível carregar um ZIP de projeto FTC contendo a pasta `TeamCode/src/main/java`. O importador lê arquivos Java sem extraí-los no computador, detecta OpModes que estendam `LinearOpMode` e permite escolher qual executar. Outros arquivos Java ficam como auxiliares na compilação. ZIP até 1 MB; código Java descompactado até 220 kB e 31 arquivos, incluindo o OpMode. ZIPs de projetos grandes podem exceder esses limites: importe arquivos `.java` específicos nesse caso. **Não há compatibilidade integral com Gradle, hardware Android, bibliotecas externas ou FTC SDK.**

### Importar classes Java auxiliares

Na aba **Código Java**, use **Importar arquivos Java (.java)** para selecionar vários arquivos ao mesmo tempo. O simulador identifica um OpMode que estenda `LinearOpMode`, coloca-o no editor e compila as demais classes junto com ele. Também é possível colar o OpMode e importar só os auxiliares. O caminho de cada classe é inferido da declaração `package`.

O projeto JSON salvo preserva os arquivos auxiliares e os JSON anteriores continuam abrindo. Limites: 30 auxiliares, 220 kB de código Java, 250 kB por compilação enviada. O importador ZIP possui limites próprios. Não executa Gradle nem carrega bibliotecas Android ou todas as APIs FTC. Importar arquivos Java desconhecidos pode executar código arbitrário na sua máquina: utilize somente fontes confiáveis.

O perfil inicial usa ME FORWARD, MD REVERSE e montagem direita invertida. É uma hipótese editável. O TeleOp histórico da equipe tem outra mistura; o teste preservado usa montagem dos dois lados invertida e **não comprova sinais do robô**.

Teclado: W/S alimenta `left_stick_y`, A/D alimenta `right_stick_x`, espaço é A. Foco no editor ou em campo não aciona teclado. Um gamepad conectado substitui o teclado do jogador 1. Desconectar o jogador 1 não transforma o jogador 2 em jogador 1. Ao perder foco, entradas zeram; ao ocultar a página, STOP; sem entradas por 0,3 s, controles zeram; sem heartbeat por 2 s, STOP. Botões LB/RB e gatilhos requerem gamepad físico nesta versão. No editor, Ctrl+S exporta o projeto JSON e os demais atalhos de texto permanecem nativos do navegador.

## Precisão e limites

- SI: metros, segundos; interface em graus. Yaw zero aponta para +Y, positivo anti-horário. **Não é mecanum e não anda de lado.**
- Física padrão ideal. Aceleração/ganhos/patinagem e falhas de sensor são parâmetros artificiais para testar lógica.
- Paredes rejeitam passos que colocariam parte do chassi fora do campo. Não simulam forças, rebote, obstáculos internos ou contato 3D.
- A parábola usa g=9,81 m/s², bola pontual sem arrasto. O cálculo inverso resolve velocidade e azimute com elevação fixa; não determina potência/RPM de MS nem confirma pontuação.
- MI agora aciona a captura didática de peças no servidor; MS ainda guarda comandos/ticks idealizados, sem flywheel ou disparo de peça. Servo guarda posição lógica. Câmera/AprilTag, Android, Road Runner e SDK completo não estão implementados; projetos Java com múltiplos arquivos são aceitos com limites e APIs parciais.
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


### Correção de campo: HIVE selecionável, paredes e tempo

- As quatro CELLs centrais — vermelhas à esquerda e azuis à direita — são as únicas miras do HIVE no modo BIOBUZZ. Clique em uma delas: a mira e a linha pontilhada passam exatamente pelo centro da CELL escolhida.
- A parede externa está forçada no servidor e na interface; configurações antigas salvas no navegador não conseguem mais desligá-la. HIVE, FLOWERS e pintura do campo não recebem colisão.
- Ao terminar a parábola, o modelo verifica alcance, desvio lateral, raio do projétil e altura da abertura. Acerto deixa a bolinha dentro da CELL nas vistas superior/lateral; erro é informado. O estado de “tombamento” exibido no HIVE é visual de missão, não simulação de massa/impacto.
- “Remover bolinhas” limpa os registros de tiros e o estado visual do HIVE. Autônomo usa no máximo 30 s, TeleOp 2 min; o cronômetro pode ser desligado para ensaio manual.

- O diagnóstico do executável portátil tolera a primeira inicialização lenta do JDK no Windows; ele ainda exige `java` e `javac` funcionais.

## Revisão estrutural — 13/10/2026 (branch de validação)

- **HIVE lateral:** representa o A-frame triangular, pivô a 1,1165 m, barra articulada e duas CELLS com boca e contorno pentagonal. O desenho 2D é uma aproximação do corte de referência da equipe/Desmos, não o CAD completo do campo.
- **POLLEN em continuidade:** uma única bolinha se desloca até o plano da abertura, desacelera ao entrar e segue até o lugar de repouso visual nas vistas superior e lateral; a trajetória verde de mira termina no plano do alvo. Acertos são decididos durante o voo, não ao fim da parábola.
- **Tombamento didático:** oito POLLEN capturados no mesmo HIVE invertem a gangorra com animação; a contagem zera e o HIVE passa a aceitar lançamentos na outra CELL. O manual FIRST **não define oito como constante oficial**: depende de massa/posição dos elementos, amortecedores e da mecânica real. O protótipo não simula NECTAR, momento angular nem colisão rígida da gangorra.
- **Editor grande:** o textarea mostra texto real com rolagem nativa, contador de linhas/bytes e aba Código em foco, eliminando a sobreposição transparente que deixava parte do código invisível. A compilação ainda usa um subconjunto das APIs do FTC SDK e os limites de importação informados acima.
- **Autônomo 3.5:** durante INIT selecione Y/B/X/↑, confirme com A no Driver Station virtual, aguarde telemetria Confirmado:true e depois use START. O controle de pré-START é necessário para a execução; classes externas e câmera real continuam fora do SDK parcial.
- **Identidade:** marca retirada do arquivo de imagem já utilizado no cabeçalho do site oficial da equipe no repositório `mecatiger-hub/public/Screenshot_20261004_131612_Instagram.jpg`, em vez de uma nova logomarca inventada.
- **Navegação:** abas dedicadas Simulador, Código Java e Trajetórias/replay, sem remover os painéis existentes.

Regressões complementares: `tests/model.test.mjs` (captura e 8 POLLEN) e `tests/browser_e2e.py` (8 tiros, Autonomo35 completo, confirmação Java, troca de abas, colagem de 35 kB). As regressões do navegador devem ser confirmadas no GitHub Actions; testes sem validação de hardware não comprovam fidelidade física.
