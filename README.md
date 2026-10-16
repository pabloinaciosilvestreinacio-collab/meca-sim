# Meca Sim 0.3-rc2 — laboratório FTC em duas vistas

O relatório de partida agora distingue acertos no HIVE, tiros que chegaram ao piso sem acerto, tentativas com estoque vazio e tiros ainda em voo no encerramento. Acertos são cumulativos e não desaparecem quando o HIVE descarrega. O CSV exporta também pontuação por categoria, penalidades, diagnósticos e logs, com campos hierárquicos. Peças sobrepostas ao chassi no reinício recebem correção integral de posição.


## Correção de partida — build `partida-integrada-20261016`

Use a branch experimental `fix/pollen-lifecycle-20261016` e o artefato Windows de uma execução verde desta correção. A branch principal continua preservada. A identificação do build aparece na Driver Station.

1. Feche a versão antiga antes de abrir o novo executável. Código salvo no navegador é preservado: clique em **Carregar TeleOp com intake/shooter** para experimentar o novo exemplo.
2. No Lançador, **Calcular tiro ideal** prepara a mira para o próximo INIT. Clique **INIT → START** e dê foco à arena.
3. **W/S** avança/recua, **A/D** gira, **Z (LB)** liga MI para coletar na frente, **C (RB)** liga MI+MS para alimentar e lançar. Soltar desliga. O painel **Controles** reflete o remapeamento real. Controle físico conectado tem prioridade.
4. Os quatro preloads são objetos reais; cada tiro retira um ID do armazenamento. Prévia de trajetória serve para cálculo visual e não altera peças, HIVE ou pontuação.
5. A carga do HIVE inclui POLLEN e NECTAR. Calibração de treino padrão: P=1, N=4/3, tombamento em 8 unidades (3 N + 4 P). Ajustável no Chassi. **Não é massa medida nem limite oficial FIRST**: o manual descreve carga suficiente e mecanismo biestável sem estabelecer um número universal de POLLEN. A física usa uma aproximação leve.
6. Ao tombar, os IDs acumulados caem, chegam ao piso e podem ser coletados. Os cinco NECTAR reservados por aliança continuam separados da carga inicial e obedecem ao fluxo do Human Player implementado.

Referência conferida: [página oficial do manual BIOBUZZ](https://ftc-resources.firstinspires.org/ftc/game), TU05 de 15/10/2026; [Seção 9](https://ftc-resources.firstinspires.org/ftc/game/manual-09), TU04. Posições e mecânica continuam esquemáticas.


Simulador **local e independente** da Meca Tiger: cole uma classe Java `LinearOpMode`, configure o chassi diferencial, execute INIT/START e observe encoders, IMU, telemetria e trajetória. Inclui controles USB e teclado, vista de cima e estudo balístico lateral.

### Referência Desmos: arena e viabilidade do lançamento

- Arena BIOBUZZ com disposição ilustrativa baseada na imagem Desmos da equipe: CELLS vermelhas à esquerda, azuis à direita, zonas vermelhas e azuis nas bordas correspondentes e marcadores laranja. As coordenadas são estimadas visualmente, não levantadas do CAD.
- Vista de cima: posição, heading, trilha e mira. Vista lateral: altura, ângulo da rampa, trajetória parabólica pontilhada, alvo e indicação matemática SIM/NÃO.
- Dois modos: força média equivalente em newtons ou velocidade de saída em m/s. No modo força, `v=sqrt(2*eficiência*força*curso/massa)`; `força` não representa torque/potência do shooter MS.
- A verificação SIM/NÃO utiliza alcance horizontal, erro lateral e diferença de altura na distância do alvo, segundo tolerâncias ajustáveis. Não representa pontuação oficial nem inclui arrasto, spin, impacto, mecanismos ou perdas variáveis.

### Atualização rc2: física, shooter e configuração

- **Parede física ativa por padrão:** somente as quatro paredes externas bloqueiam o chassi. FLOWERS, HIVE e marcações do campo continuam visuais, sem colisão.
- **Shooter Java (modelo didático):** MS armado e MI alimentando consomem uma peça por intervalo configurável (0,8 s inicial). A trajetória usa a configuração balística atual; não há sensor de RPM nem calibração física. Prévia manual continua separada do comando Java. A telemetria é recolhível e inclui estado dos gamepads. O HIVE usa carga de treino ponderada de POLLEN e NECTAR, com limiar configurável, e não substitui arbitragem oficial.
- **Drivetrain selecionável:** diferencial é o perfil padrão da Mequinha (ME/MD). Mecanum é um modo alternativo, com FL/FR/BL/BR e cinemática ideal, para testar projetos de outras equipes.
- **Escala e visual:** a arena é 3,66 × 3,66 m no modelo; a interface utiliza a marca vetorial Meca Tiger, cor de robô configurável e painéis Código/Chassi/Shooter.

### Nova interface: campos, projetos e editor

- **Arena:** seletor entre `BIOBUZZ 2026–2027` e `Arena livre`. As dimensões principais agora refletem o manual oficial: quadro HIVE de 1,2565 × 0,9895 m, pivô a 1,1165 m, espaçamento das CELLS 0,478 m, abertura dos FLOWERS a 0,546 m, GARDENS 0,584 × 0,051 m e LOADING ZONES 0,584 × 0,2795 m. Posições individuais e orientação das CELLS/FLOWERS continuam **esquemáticas**, não reproduzidas do STEP oficial; não existem colisões rígidas internas nem articulações 3D; a pontuação implementada é estimada a partir dos estados das peças.
- **POLLEN/NECTAR e intake (experimental):** 40 POLLEN e 16 NECTAR têm tipo, tamanho e estado separados (em campo, FLOWER/HIVE, preload/inventário ou reservado). O modelo posiciona peças em FLOWERS, GARDENS, CELLS e zonas por aproximação 2D. Quatro POLLEN começam no inventário do robô. A região frontal do intake acompanha a largura e o alcance editáveis (padrão 0,15 m); MI positivo coleta somente dentro da região e até a capacidade configurada (padrão 4). Peças livres têm amortecimento e colisões leves com outras peças, chassi e paredes. Massas, contatos 3D e posições oficiais exatas ainda não estão completos.
- **Ciclo do POLLEN (experimental):** cada peça mantém o mesmo ID ao ser coletada, aparecer no estoque visual do robô, sair da posição do shooter e percorrer a trajetória. Um acerto previsto transfere esse ID ao estado pontuado; um erro devolve o mesmo objeto ao piso, onde volta a interagir com a física. A trajetória usa velocidade e ângulo configurados sem arrasto ou colisão 3D; a decisão de acerto continua no modelo didático do HIVE.
- **Aparência do robô:** cor do chassi, cor dos detalhes e decoração (faixa, faixas laterais, painel frontal ou sem detalhes) são opções visuais. O controle do rastro laranja só oculta o desenho; o histórico de trajetória continua sendo registrado para replay e diagnóstico. Preferências ficam no projeto local/exportado e não entram na configuração enviada à física do robô.
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
- **Tombamento didático:** a carga ponderada dos elementos reais da CELL inverte a gangorra quando alcança o limiar de treino. A CELL descarrega seus POLLEN/NECTAR e a outra passa a aceitar tiros. O modelo inclui NECTAR físico, mas não calcula momento angular nem colisão rígida da gangorra. Não há um número universal de POLLEN definido como limiar oficial.
- **Editor grande:** o textarea mostra texto real com rolagem nativa, contador de linhas/bytes e aba Código em foco, eliminando a sobreposição transparente que deixava parte do código invisível. A compilação ainda usa um subconjunto das APIs do FTC SDK e os limites de importação informados acima.
- **Autônomo 3.5:** durante INIT selecione Y/B/X/↑, confirme com A no Driver Station virtual, aguarde telemetria Confirmado:true e depois use START. O controle de pré-START é necessário para a execução; classes externas e câmera real continuam fora do SDK parcial.
- **Identidade:** marca retirada do arquivo de imagem já utilizado no cabeçalho do site oficial da equipe no repositório `mecatiger-hub/public/Screenshot_20261004_131612_Instagram.jpg`, em vez de uma nova logomarca inventada.
- **Navegação:** abas dedicadas Simulador, Código Java e Trajetórias/replay, sem remover os painéis existentes.

Regressões complementares: `tests/model.test.mjs` (geometria balística), `tests/browser_e2e.py` (prévia sem mutação, Autonomo35 completo, confirmação Java, troca de abas, colagem de 35 kB) e `tests/partida_e2e.py` (disparos e coleta reais via teclado/JVM). As regressões do navegador devem ser confirmadas no GitHub Actions; testes sem validação de hardware não comprovam fidelidade física.


### Regras BIOBUZZ experimentais — entrada de NECTAR

- O painel Driver Station permite ao Human Player introduzir manualmente NECTAR reservado na Loading Zone, após TIP do HIVE da aliança ou nos últimos 60 s. Cada TIP que libera entrada é derivado da carga configurável de POLLEN + NECTAR do HIVE. A aproximação de carga não é um sensor nem um limiar oficial.
- A mesma peça cai visualmente cerca de 0,45 m na Loading Zone, depois interage com colisões e intake do piso; a queda representa a entrada do Human Player, não uma ejeção do HIVE.
- HIVE TIP libera no campo os mesmos objetos pontuados que estavam na CELL que virou para baixo; eles caem e voltam à física do piso. A origem do TIP é a carga ponderada configurável de treino, sem alegação de um limiar físico oficial.
- **Estimativa de pontuação:** inclui 20 pontos por HIVE TIP, 2 por peça em CELL voltada para cima, pontuação de FLOWER baseada na última NECTAR depositada e 5 pontos para a primeira NECTAR (aproximação do elemento inferior), 1 por elemento sobre GARDEN e 20 pontos recebidos por Major Foul G410. A posição/volume vertical da FLOWER, zonas GARDEN e HIVE são aproximados; não substitui arbitragem, placar oficial, ranking ou resultado da missão.
- Depósito de NECTAR em FLOWER antes dos últimos 60 s registra G410 e atribui 20 pontos estimados à aliança adversária. Centros das Loading Zones e demais posições de campo continuam aproximados.
- Referência consultada: FIRST BIOBUZZ Competition Manual TU05 (15/10/2026), Sections 10–11, G410 e G426. A implementação cobre somente as categorias descritas acima; não implementa todas as regras, ranking points, arbitragem ou pontuação vertical exata.
