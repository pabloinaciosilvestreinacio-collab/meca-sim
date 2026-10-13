# MecaSim 0.3-rc1 — roteiro de testes de 14/10/2026

Este roteiro testa **o simulador no computador**, não o desempenho do robô físico. Não requer Control Hub. Use somente código Java da equipe ou de fontes confiáveis: o código executado **não tem sandbox de segurança**.

## 1. Instalação rápida (Windows)

1. Acesse o repositório `pabloinaciosilvestreinacio-collab/meca-sim`, abra **Actions → Validar Meca Sim** e escolha uma execução **verde** cujo commit seja o da versão que você quer testar.
2. Em **Artifacts**, baixe **MecaSim-Windows-portatil** e **extraia** todo o ZIP para uma pasta local, por exemplo `Documentos/MecaSim-Teste`. Não execute o EXE dentro do ZIP.
3. Execute **INICIAR_TESTE.bat** na mesma pasta. Ele verifica Java/JDK 17+, grava `mecasim-diagnostico.txt` e inicia o MecaSim. Se falhar, abra esse arquivo e registre a mensagem.
4. O navegador deve abrir `http://127.0.0.1:8765` e mostrar as vistas de cima/lateral. **Deixe a janela do servidor aberta** enquanto usar o simulador.
5. Se o JDK não for encontrado, instale JDK 17+ ou configure `JAVA_HOME` para um JDK com `bin/java.exe` **e** `bin/javac.exe`. O JDK `jbr` do Android Studio pode ser detectado automaticamente. Se a porta 8765 estiver ocupada, feche outra instância do MecaSim e tente de novo.
6. Se preferir o código-fonte: **Code → Download ZIP**, extraia e execute `iniciar.bat`. Esse caminho exige Python 3.10+ **e** JDK 17+.

A versão de teste depende de um navegador atualizado. Para testar gamepad, conecte o controle por USB antes de iniciar o TeleOp e pressione um botão para que o navegador o detecte.

## 2. Critérios mínimos (primeiros 10 minutos)

| ID | Ação | Resultado esperado |
| --- | --- | --- |
| A1 | Iniciar pelo BAT | Diagnóstico conclui sem erro; endereço local abre a interface |
| A2 | Selecionar exemplo **Autônomo · encoder + IMU**, clicar **Compilar / INIT** e depois **START** | Status passa por `inicializando` e termina em `concluído`; trajetória: ~1 m para frente, giro de ~+50° e mais ~0,6 m |
| A3 | Após o A2, verificar telemetria e motores | Yaw final próximo de +50° (desvio aceitável ~1,5° em cenário padrão); todos os comandos de motor em 0 |
| A4 | Selecionar exemplo **TeleOp**, INIT/START, clicar fora do editor, segurar W/S e A/D alternadamente | Ré, frente e giro são visíveis; ao soltar os botões, a potência zera |
| A5 | Durante TeleOp, clicar **STOP** | Status `parado`, motores em 0, Java encerrado |
| A6 | Clicar **Salvar projeto**, alterar código e **Abrir projeto** | Editor recupera o código anterior |

**Se A1–A5 não passarem, interrompa o aceite:** guarde o texto do **Console de compilação e execução**, o diagnóstico e uma captura da tela. Não altere a lógica do autônomo para compensar uma falha de inicialização.

## 3. Testes adicionais (15–25 minutos)

| ID | Ação | Resultado esperado |
| --- | --- | --- |
| B1 | Conectar gamepad USB e mover alavancas no TeleOp | Controle 1 reconhecido, direção e rotação coerentes; desligar o controle neutraliza comandos |
| B2 | Configuração do robô → **Calcular ticks**: 28 ticks/volta, 20:1, roda 90 mm | ~1980,594847 ticks/m |
| B3 | Aba **Lançador** → **Calcular tiro ideal** → **Visualizar lançamento** | Cálculo retorna velocidade finita para configuração alcançável; vistas correspondem à posição do lançador |
| B4 | **Importar arquivos Java (.java)** com um OpMode e um auxiliar | OpMode compila; código auxiliar é salvo com o projeto JSON |
| B5 | **Importar projeto FTC (.zip)** com `TeamCode/src/main/java`, escolher OpMode | Lista opções válidas, compila classes compatíveis, mantém seleção após salvar/abrir projeto |
| B6 | **Trajetória CSV** após o autônomo | Arquivo possui colunas de tempo, posição, yaw e ticks, com várias linhas |
| B7 | Marcar **IMU travada** ou **encoder esquerdo travado**, reiniciar e executar exemplo | O cenário de falha altera a observação; não interpretar divergência como calibração real |
| B8 | Alterar deslocamento do lançador e orientação do robô | O ponto do lançador continua preso ao chassi e gira com ele |

Para o ZIP de código FTC completo: somente arquivos Java dentro de `TeamCode/src/main/java` são lidos. Limites: ZIP 1 MB, até 31 arquivos Java, total Java 220 kB. Projetos usando câmera, VisionPortal, bibliotecas externas ou APIs FTC não simuladas podem **não compilar**: documente o erro, sem confundir com um defeito do compilador.

## 4. Resultado a registrar

Preencha `RESULTADO_TESTE.md` e envie o conteúdo junto com `mecasim-diagnostico.txt`, o JSON/CSV do teste e uma captura do erro quando houver. **Não envie senhas, tokens ou arquivos privados desnecessários.**

O piloto termina quando A1–A6 passarem e as falhas de B1–B8 estiverem anotadas. Ainda permanecem fora do aceite: AprilTag/câmera, precisão do shooter/flywheel, colisões 3D, execução Android real e calibração de PID físico.

## Se algo falhar

- **Nada abre:** execute `INICIAR_TESTE.bat` e leia `mecasim-diagnostico.txt`; verifique Java/JDK e se a porta 8765 não está ocupada.
- **Erro ao compilar Java:** expanda **Console de compilação e execução**, guarde a primeira mensagem `error:`; informe a classe e a API FTC usada.
- **Gamepad não responde:** clique fora do editor, pressione um botão, confira se o navegador mostra **Controle 1 conectado**; teste primeiro com o teclado.
- **Trajetória vai para direção inesperada:** compare `MD/ME`, `setDirection` e **montagem física invertida** separadamente. Não presuma que o sinal virtual já corresponde ao robô real.
- **Código fica rodando:** use **STOP** e confirme que as potências ficaram em 0; feche a janela do servidor se necessário.
