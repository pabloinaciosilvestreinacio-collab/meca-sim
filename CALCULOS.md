# Cálculos, unidades e hipóteses

## Chassi diferencial

Distâncias em metros, tempo em segundos e ângulos internos em radianos. O eixo X global aponta para a direita e Y para cima; yaw zero aponta a frente para +Y. Bitola b é a distância entre os contatos das rodas motrizes.

`v = (vr + vl)/2`, `w = (vr - vl)/b`.

Para passo dt com velocidades constantes, `q = w dt/2` e `d = v dt sinc(q)`, com `sinc(q)=sin(q)/q` e limite `sinc(0)=1`. Então:

```
x' = x + d cos(yaw + π/2 + q)
y' = y + d sin(yaw + π/2 + q)
yaw' = normalizar(yaw + w dt)
```

A forma com sinc evita cancelamento numérico quando as rodas giram quase à mesma velocidade. O código usa expansão `1-q²/6` perto de zero. Mil cenários pseudoaleatórios são comparados com a solução analítica de arco a tolerância absoluta de 1e-10 m, apenas no modelo ideal.

Passos maiores são subdivididos em até 10 ms. Com aceleração configurada, é uma aproximação discreta; não é solução exata da dinâmica acelerada. Limites de potência, ganho, patinagem e geometria são validados na entrada.

## Encoders e sinais

`ticks/m = ticks_por_volta_motor × redução_total / (π × diâmetro_roda_m)`.

Exemplo hipotético: 28 ticks/volta, redução 20:1 e roda 0,09 m → 1980,5948473658 ticks/m. A redução efetiva deve incluir toda transmissão; não substituir medição por nominal.

`setDirection` e fator de montagem são separados. O deslocamento bruto do eixo produz ticks; a direção lógica corrige a leitura entregue ao Java. A patinagem reduz deslocamento no chão e não os ticks. Encoder travado mantém leitura, mas a roda pode continuar girando. O exemplo de conversão segue a [documentação REV](https://docs.revrobotics.com/duo-control/hello-robot-java/part-3/autonomous-navigation-onbot/converting-encoder-ticks-to-a-distance).

## Transformação do lançador

Com centro `(cx,cy)`, offset local `(u,v)` e yaw a:

```
Lx = cx + u cos(a) - v sin(a)
Ly = cy + u sin(a) + v cos(a)
```

O chassi e o lançador giram em torno do mesmo centro. Mudar u/v não altera o chassi. A vista lateral projeta o retângulo do robô no eixo de tiro; não representa uma simulação 3D de mecanismos.

## Balística ideal

Altura H, velocidade V, elevação e, distância horizontal d e gravidade g=9,81:

`h(d)=H+d tan(e)-g d²/(2 V² cos²(e))`.

Tempo de queda: `t=(V sin(e)+sqrt((V sin(e))²+2gH))/g`. Alcance: `V cos(e) t`.

Para alvo na altura T e distância horizontal d>0, com elevação fixa:

`V=sqrt(g d²/[2 cos²(e) (H+d tan(e)-T)])`.

Só existe solução finita se `H+d tan(e)-T>0`. O azimute relativo é `atan2(-dx,dy)-yaw`, normalizado, pois frente zero é +Y. Os testes conferem 500 rotações/posições e recolocam a solução na equação direta. Não há arrasto, efeito Magnus, raio da bola, variação de velocidade ou geometria do alvo. Acertar o ponto matemático não comprova pontuação.

## Falhas e paredes

Ganho multiplica velocidade de cada motor; patinagem multiplica velocidade no chão por `(1-slip)`. IMU pode congelar, atrasar até 2 s ou acumular deriva configurada. Paredes bloqueiam a atualização da pose quando o retângulo orientado ultrapassa o campo, mantendo rotação ideal das rodas. Não se modelam massas, forças de contato, torque, bateria ou travamento mecânico do motor.

## APIs

Camada de compatibilidade própria em `sdk.py`; não distribui o SDK Android. Referência para ciclo: [LinearOpMode](https://javadoc.io/static/org.firstinspires.ftc/RobotCore/10.3.0/com/qualcomm/robotcore/eventloop/opmode/LinearOpMode.html). Referência do [FTC SDK](https://github.com/FIRST-Tech-Challenge/FtcRobotController). [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API). Essas referências não significam suporte integral das APIs.
