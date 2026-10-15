"""Servidor local e execução REAL de Java com hardware FTC idealizado."""
import base64
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from physics import World, Motor
from elements import starting_elements, starting_inventory, deposit_to_flower
from sdk import write_sdk
from project_import import import_ftc_zip
from diagnostics import Inspector

ROOT = Path(__file__).resolve().parent


def validate_java_files(files):
    """Caminhos relativos Java: impedir traversal e limites excessivos."""
    if files is None:
        return {}
    if not isinstance(files, dict) or len(files) > 30:
        raise ValueError("Envie no máximo 30 arquivos auxiliares Java")
    validated = {}
    for name, content in files.items():
        if not isinstance(name, str) or not re.fullmatch(
            r"(?:[A-Za-z_$][A-Za-z0-9_$]*/)*[A-Za-z_$][A-Za-z0-9_$]*\.java", name
        ):
            raise ValueError("Caminho Java inválido: use pacote/Nome.java, sem .. ou barras invertidas")
        if not isinstance(content, str) or not content.strip() or "\x00" in content:
            raise ValueError("Conteúdo Java inválido")
        if len(name) > 220 or len(content.encode("utf-8")) > 200000:
            raise ValueError("Arquivo Java excede o limite")
        validated[name] = content
    return validated


def executable(name):
    home = os.environ.get("JAVA_HOME")
    candidate = Path(home) / "bin" / (name + (".exe" if os.name == "nt" else "")) if home else None
    return str(candidate) if candidate and candidate.is_file() else shutil.which(name)


def build_world(config):
    if not isinstance(config, dict): raise ValueError("Configuração deve ser um objeto")
    world = World()
    alliance = str(config.get('alliance', 'red'))
    arena = str(config.get('arena', 'biobuzz'))
    if arena not in ('biobuzz', 'livre'): raise ValueError("Arena inválida")
    world.elements = starting_elements(alliance) if arena == 'biobuzz' else []
    world.inventory = starting_inventory(world.elements)
    bounds = {"track": (.05, 2), "width": (.05, 2), "length": (.05, 2),
              "max_speed": (.05, 10), "ticks_per_m": (1, 100000), "x": (-10, 10), "y": (-10, 10),
              "acceleration": (0, 20), "imu_delay": (0, 2), "imu_drift": (-10, 10),
              "intake_reach": (.05, .40)}
    for key, (low, high) in bounds.items():
        value = float(config.get(key, getattr(world, key)))
        if not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f"{key}: valor deve estar entre {low} e {high}")
        setattr(world, key, value)
    capacity = config.get("intake_capacity", 4)
    if isinstance(capacity, bool) or not isinstance(capacity, int) or not 1 <= capacity <= 20:
        raise ValueError("Capacidade do intake deve ser um inteiro entre 1 e 20")
    world.intake_capacity = capacity
    flower_servo_name = config.get("flower-servo-name", "flower")
    if not isinstance(flower_servo_name, str) or not re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$-]{0,39}", flower_servo_name):
        raise ValueError("Nome do servo de FLOWER inválido")
    world.flower_servo_name = flower_servo_name
    flower_deploy = float(config.get("flower-deploy-position", .8))
    if not math.isfinite(flower_deploy) or not .1 <= flower_deploy <= 1:
        raise ValueError("Posição de acionamento do FLOWER deve estar entre 0,1 e 1")
    world.flower_deploy_position = flower_deploy
    flower_range = float(config.get("flower-range", .65))
    if not math.isfinite(flower_range) or not .15 <= flower_range <= 1.5:
        raise ValueError("Alcance do FLOWER deve estar entre 0,15 e 1,5 m")
    world.flower_range = flower_range
    launcher = config.get("launcher", {})
    if not isinstance(launcher, dict):
        raise ValueError("Configuração do lançador inválida")
    launcher_defaults = {"shot-mode": "force", "force": 8.0, "speed": 5.0,
                         "projectile-mass": .05, "acceleration-stroke": .15,
                         "shot-efficiency": .65, "offset-x": .1125,
                         "offset-y": .225, "height": .30, "elevation": 78.0,
                         "azimuth": 0.0, "feed-interval": .8}
    launcher_ranges = {"force": (.01, 150), "speed": (.1, 30),
                       "projectile-mass": (.001, 2), "acceleration-stroke": (.01, 2),
                       "shot-efficiency": (.01, 1), "offset-x": (-.6, .6),
                       "offset-y": (-.6, .6), "height": (.05, 1.5),
                       "elevation": (0, 89), "azimuth": (-180, 180),
                       "feed-interval": (.1, 5)}
    if launcher.get("shot-mode", "force") not in ("force", "speed"):
        raise ValueError("Modo do lançador inválido")
    world.launcher = {"shot-mode": launcher.get("shot-mode", "force")}
    for key, (low, high) in launcher_ranges.items():
        value = float(launcher.get(key, launcher_defaults[key]))
        if not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f"Parâmetro do lançador {key} fora do limite")
        world.launcher[key] = value
    if world.launcher["shot-mode"] == "force":
        f, m, stroke, eta = (world.launcher[k] for k in
                             ("force", "projectile-mass", "acceleration-stroke", "shot-efficiency"))
        world.launcher["speed"] = math.sqrt(2*eta*f*stroke/m)
        if world.launcher["speed"] > 30:
            raise ValueError("Velocidade calculada acima de 30 m/s")
    world.launcher["interval"] = world.launcher.pop("feed-interval")
    world.launcher["lateral"] = world.launcher.pop("offset-x")
    world.launcher["forward"] = world.launcher.pop("offset-y")
    world.launcher["hive"] = str(launcher.get("hive", "red-lower"))
    if world.launcher["hive"] not in ("red-lower", "red-upper", "blue-lower", "blue-upper"):
        raise ValueError("CELL do lançador inválida")
    drivetrain = str(config.get("drivetrain", "differential"))
    if drivetrain not in ("differential", "mecanum"):
        raise ValueError("Drivetrain deve ser diferencial ou mecanum")
    world.drivetrain = drivetrain
    yaw = float(config.get("yaw", 0))
    if not math.isfinite(yaw): raise ValueError("Yaw inválido")
    world.yaw = math.radians(yaw)
    # A interface sempre usa paredes externas: configurações antigas do navegador não podem desligá-las.
    world.walls = True
    world.imu_frozen = bool(config.get("imu_frozen", False))
    if world.walls and not world.inside(): raise ValueError("Posição inicial atravessa a parede; ajuste X, Y e dimensões")
    if drivetrain == "mecanum":
        names = {key: str(config.get(key, default)) for key, default in
                 (("front_left","FL"),("front_right","FR"),("back_left","BL"),("back_right","BR"))}
        if len(set(names.values())) != 4 or any(not name or name in ("MS","MI") for name in names.values()):
            raise ValueError("Os quatro motores mecanum devem ter nomes distintos")
        world.motors = {names["front_left"]: Motor("fl"), names["front_right"]: Motor("fr"),
                        names["back_left"]: Motor("bl"), names["back_right"]: Motor("br"),
                        "MS": Motor(), "MI": Motor()}
    else:
        left, right = str(config.get("left", "ME")), str(config.get("right", "MD"))
        if not left or not right or left == right or left in ("MS", "MI") or right in ("MS", "MI"):
            raise ValueError("Nomes dos motores devem ser distintos e não podem ser MS/MI auxiliares")
        world.motors = {left: Motor("left", -1 if config.get("invert_left", False) else 1),
                        right: Motor("right", -1 if config.get("invert_right", True) else 1),
                        "MS": Motor(), "MI": Motor()}
    for motor in world.motors.values():
        if motor.side in ("aux",): continue
        motor.gain = 1
        motor.slip = 0
    for side, name in (("left", str(config.get("left", "ME"))), ("right", str(config.get("right", "MD")))):
        if name not in world.motors: continue
        motor = world.motors[name]
        for key, low, high, default in (("gain", 0, 2, 1), ("slip", 0, 1, 0)):
            value = float(config.get(side+"_"+key, default))
            if not math.isfinite(value) or not low <= value <= high: raise ValueError(f"{side}_{key} inválido")
            setattr(motor, key, value)
        motor.encoder_frozen = bool(config.get(side+"_encoder_frozen", False))
    return world


class Session:
    def __init__(self, config=None):
        self.world = build_world(config or {})
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.process = None
        self.started = False
        self.clock = 0.0
        self.status = "pronto"
        self.logs = ""
        self.telemetry = ""
        self.gamepads = [[0] * 20, [0] * 20]
        self.servos = {"servo": .5, self.world.flower_servo_name: .5}
        settings = config or {}
        self.match_mode = str(settings.get("match-mode", "auto"))
        if self.match_mode not in ("auto", "teleop"):
            raise ValueError("Modo de partida deve ser auto ou teleop")
        self.timer_enabled = bool(settings.get("timer-enabled", True))
        # A interface envia match-mode e aplica as regras FTC. A duração livre é
        # preservada somente para a API legada e para cenários automatizados.
        if "match-mode" in settings:
            self.limit = 30.0 if self.match_mode == "auto" else 120.0
        else:
            self.limit = float(settings.get("duration", 30))
            if not math.isfinite(self.limit) or not 1 <= self.limit <= 180:
                raise ValueError("Duração deve ser de 1 a 180 segundos")
        self.worker = None
        self.client_required = False
        self.client_seen = time.monotonic()
        self.input_seen = time.monotonic()
        self.history = []
        self.inspector = Inspector()

    def log(self, message):
        with self.lock:
            self.logs = (self.logs + str(message))[-24000:]

    def stop(self):
        self.stop_event.set()
        with self.lock:
            for motor in self.world.motors.values():
                motor.power = 0
                motor.velocity = 0
            if self.status not in ("concluído", "erro"):
                self.status = "parado"
            process = self.process
        if process and process.poll() is None:
            try:
                process.terminate()
            except OSError:
                pass

    def snapshot(self):
        with self.lock:
            result = self.world.snapshot()
            result.update(status=self.status, logs=self.logs, telemetry=self.telemetry, servos=self.servos.copy(),
                          gamepads=[pad[:] for pad in self.gamepads],
                          diagnostics=[entry.copy() for entry in self.inspector.warnings],
                          imu_yaw=math.degrees((self.world.sensor_yaw() - self.world.yaw_zero + math.pi)
                                               % (2 * math.pi) - math.pi),
                          imu_frozen=self.world.imu_frozen)
            return result

    def tick(self):
        next_tick = time.monotonic()
        while not self.stop_event.is_set():
            next_tick += .01
            with self.lock:
                self.clock += .01
                now = time.monotonic()
                if self.client_required and now-self.input_seen > .3:
                    self.gamepads = [[0]*20, [0]*20]
                if self.client_required and now-self.client_seen > 2:
                    self.log("\nNavegador desconectado por 2 s: STOP automático.\n")
                    self.stop()
                if self.started and self.status == "executando":
                    self.world.step(.01)
                    self.inspector.inspect(self.world,True)
                    if not self.history or self.world.elapsed-self.history[-1][0] >= .049:
                        self.history.append([self.world.elapsed, self.world.x, self.world.y, math.degrees(self.world.yaw)] +
                                            [self.world.motors[n].position() for n in self.world.motors])
                    if self.timer_enabled and self.world.elapsed >= self.limit:
                        self.log("\nLimite de tempo atingido.\n")
                        self.inspector.warn('DURACAO','Duração máxima da simulação atingida. STOP automático.','atenção',self.world.elapsed)
                        self.stop()
            self.stop_event.wait(max(0, next_tick-time.monotonic()))
            # Evita acumular passos depois de suspensão do computador.
            if time.monotonic() - next_tick > .1:
                next_tick = time.monotonic()

    def rpc(self, op, *args):
        if op == "idle":
            self.stop_event.wait(.01)
            return ""
        with self.lock:
            w = self.world
            if op == "time": return str(self.clock)
            if op == "active": return str(self.started and not self.stop_event.is_set()).lower()
            if op == "started": return str(self.started).lower()
            if op == "stopped": return str(self.stop_event.is_set()).lower()
            if op in ("stop", "finish"):
                # Um finish atrasado da JVM não pode anular o STOP do usuário.
                if op == "stop" and self.status != "erro":
                    self.status = "parado"
                elif op == "finish" and not self.stop_event.is_set() and self.status not in ("parado", "erro"):
                    self.status = "concluído"
                self.stop_event.set()
                for m in w.motors.values(): m.power = 0; m.velocity = 0
                return ""
            if op == "device":
                kind, name = args
                # Motores precisam existir no chassi configurado; servo e IMU são
                # dispositivos lógicos genéricos para que novos OpModes não dependam
                # de um nome de exemplo fixo do simulador.
                if kind == "Servo":
                    self.servos.setdefault(name, .5)
                    return ""
                valid = (kind in ("DcMotor", "DcMotorEx") and name in w.motors) or kind == "IMU"
                if not valid: raise ValueError(f"Hardware não configurado: {kind} '{name}'")
                return ""
            if op == "gamepad":
                return ",".join(str(x) for x in self.gamepads[int(args[0])-1])
            if op == "telemetry":
                self.telemetry = args[0][-12000:]
                self.inspector.inspect_telemetry(self.telemetry,self.world.elapsed)
                return ""
            if op == "yaw": return str(math.degrees((w.sensor_yaw()-w.yaw_zero+math.pi) % (2*math.pi)-math.pi))
            if op == "resetYaw":
                w.yaw_zero = w.sensor_yaw()
                return ""
            if op == "servo":
                name, action, *values = args
                if action == "get": return str(self.servos[name])
                position = float(values[0])
                if not math.isfinite(position): raise ValueError("Posição de servo inválida")
                previous = self.servos.get(name, .5)
                self.servos[name] = max(0, min(1, position))
                threshold = self.world.flower_deploy_position
                if (name == self.world.flower_servo_name and self.started
                        and self.status == "executando" and not self.stop_event.is_set()
                        and previous < threshold <= self.servos[name]):
                    event = deposit_to_flower(self.world)
                    if event:
                        self.log(f"\\nFLOWER {event['flower']}: {event['kind']} depositado (#{event['sequence']}).\\n")
                return ""
            if op == "motor":
                name, action, *values = args
                m = w.motors[name]
                getters = {"getPower": m.power, "getDirection": "FORWARD" if m.direction == 1 else "REVERSE",
                           "getMode": m.mode, "encoder": m.position(), "getTarget": m.target, "getBrake": m.brake,
                           "busy": str(m.mode == "RUN_TO_POSITION" and abs(m.target-m.position()) > 2).lower()}
                if action in getters: return str(getters[action])
                if action == "power":
                    power = float(values[0])
                    if not math.isfinite(power): raise ValueError("Potência não finita")
                    m.power = 0 if self.stop_event.is_set() else max(-1, min(1, power))
                elif action == "direction": m.direction = 1 if values[0] == "FORWARD" else -1
                elif action == "mode":
                    m.mode = values[0]
                    if m.mode == "STOP_AND_RESET_ENCODER":
                        m.zero = m.frozen_ticks if m.encoder_frozen else m.raw_ticks
                        m.power = 0
                        m.velocity = 0
                        m.target = 0
                elif action == "target": m.target = int(values[0])
                elif action == "brake": m.brake = values[0]
                else: raise ValueError("Operação de motor não implementada: " + action)
                return ""
            raise ValueError("API não implementada: " + op)

    def run(self, source, java_files=None):
        if not isinstance(source, str) or not source.strip():
            raise ValueError("Código Java principal ausente")
        total = len(source.encode("utf-8"))
        if total > 200000:
            raise ValueError("Código Java principal excede 200 kB")
        extras = validate_java_files(java_files)
        total += sum(len(content.encode("utf-8")) for content in extras.values())
        if total > 220000:
            raise ValueError("Conjunto Java excede 220 kB")
        self.status = "compilando"
        self.worker = threading.Thread(target=self._execute, args=(source, extras), daemon=True)
        self.worker.start()

    def _execute(self, source, java_files):
        ticker = None
        watchdog = None
        try:
            compiler, java = executable("javac"), executable("java")
            if not compiler or not java:
                raise ValueError("Instale JDK 17 ou superior; configure JAVA_HOME ou PATH. Java sem javac não compila código.")
            # Preserve strings while discarding comments; URLs inside Java strings are not comments.
            stripped = re.sub(r'""".*?"""|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|/\*.*?\*/|//[^\n]*',
                              lambda m: ' ' if m.group().startswith(('//', '/*', '"', "'")) else m.group(), source, flags=re.S)
            match = re.search(r"\bpublic\s+(?:(?:final|strictfp)\s+)*class\s+([A-Za-z_$][\w$]*)\s+extends\s+(?:com\.qualcomm\.robotcore\.eventloop\.opmode\.)?LinearOpMode\b", stripped)
            package = re.search(r"\bpackage\s+([\w.]+)\s*;", stripped)
            if not match:
                raise ValueError("Cole uma classe pública que estenda LinearOpMode, com imports e runOpMode().")
            classname = match.group(1)
            qualified = (package.group(1) + "." if package else "") + classname
            with tempfile.TemporaryDirectory(prefix="meca-sim-") as directory:
                files = write_sdk(directory)
                user = Path(directory) / "usuario" / "principal" / (classname + ".java")
                user.parent.mkdir(parents=True, exist_ok=True)
                user.write_text(source, encoding="utf-8")
                sources = [str(user)]
                for name, content in java_files.items():
                    helper = Path(directory) / "usuario" / "auxiliares" / name
                    helper.parent.mkdir(parents=True, exist_ok=True)
                    helper.write_text(content, encoding="utf-8")
                    sources.append(str(helper))
                classes = Path(directory) / "classes"
                result = subprocess.run([compiler, "-J-Dfile.encoding=UTF-8", "-encoding", "UTF-8", "-d", str(classes), *files, *sources],
                                        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
                self.log(result.stdout + result.stderr)
                if result.returncode:
                    raise ValueError("Compilação falhou. Veja erros acima; APIs fora da camada suportada precisam ser implementadas.")
                if self.stop_event.is_set(): return
                with self.lock:
                    self.status = "inicializando"
                    self.process = subprocess.Popen([java, "-Dfile.encoding=UTF-8", "-Xmx128m", "-cp", str(classes), "sim.Bridge", qualified],
                                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                                    text=True, encoding="utf-8", errors="replace", bufsize=1)
                watchdog = threading.Timer(self.limit + 10, self.stop) if self.timer_enabled else None
                if watchdog:
                    watchdog.daemon = True
                    watchdog.start()
                ticker = threading.Thread(target=self.tick, daemon=True)
                ticker.start()
                for line in self.process.stdout:
                    if line.startswith("@SIM@"):
                        args = [base64.b64decode(s).decode("utf-8") for s in line[5:].strip().split("|")]
                        try:
                            answer = self.rpc(*args)
                        except (ValueError, KeyError, IndexError) as error:
                            answer = "ERROR:" + str(error)
                        self.process.stdin.write(base64.b64encode(answer.encode()).decode() + "\n")
                        self.process.stdin.flush()
                    else:
                        self.log(line)
                code = self.process.wait(timeout=2)
                if code and self.status != "parado":
                    raise ValueError(f"Execução Java terminou com código {code}")
                if self.status not in ("parado", "erro"):
                    self.status = "concluído"
        except Exception as error:
            if self.status != "parado":
                self.status = "erro"
                self.log("\n" + str(error) + "\n")
        finally:
            if watchdog: watchdog.cancel()
            self.stop_event.set()
            with self.lock:
                for m in self.world.motors.values(): m.power = 0; m.velocity = 0
            if self.process:
                if self.process.poll() is None:
                    self.process.kill()
                self.process.wait()
                self.process.stdout.close()
                self.process.stdin.close()
            if ticker: ticker.join(timeout=1)


class App:
    def __init__(self):
        self.session = Session()
        self.lock = threading.RLock()
        self.token = secrets.token_urlsafe(32)


def handler_for(app):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args): pass

        def send(self, data, status=200, mime="application/json; charset=utf-8"):
            body = json.dumps(data, ensure_ascii=False).encode() if mime.startswith("application/json") else data
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def allowed_host(self):
            host = self.headers.get("Host", "").split(":")[0]
            return host in ("127.0.0.1", "localhost")

        def do_GET(self):
            if not self.allowed_host(): return self.send({"error": "Host inválido"}, 403)
            path = urlparse(self.path).path
            if path == "/api/state": return self.send(app.session.snapshot())
            if path == "/api/recording":
                with app.session.lock:
                    return self.send({"columns": ["time_s", "x_m", "y_m", "yaw_deg"] + [n+"_ticks" for n in app.session.world.motors],
                                      "rows": list(app.session.history)})
            files = {"/": ("web/index.html", "text/html; charset=utf-8"),
                     "/app.js": ("web/app.js", "text/javascript; charset=utf-8"),
                     "/model.mjs": ("web/model.mjs", "text/javascript; charset=utf-8"),
                     "/arena.mjs": ("web/arena.mjs", "text/javascript; charset=utf-8"),
                     "/editor.mjs": ("web/editor.mjs", "text/javascript; charset=utf-8"),
                     "/route.mjs": ("web/route.mjs", "text/javascript; charset=utf-8"),
                     "/meca-tiger-mark.svg": ("web/meca-tiger-mark.svg", "image/svg+xml"),
                     "/style.css": ("web/style.css", "text/css; charset=utf-8"),
                     "/examples": ("examples.json", "application/json; charset=utf-8")}
            if path not in files: return self.send({"error": "Não encontrado"}, 404)
            name, mime = files[path]
            body = (ROOT / name).read_bytes()
            if path == "/": body = body.replace(b"__TOKEN__", app.token.encode())
            self.send(body, mime=mime if not mime.startswith("application/json") else "text/plain; charset=utf-8")

        def do_POST(self):
            origin = self.headers.get("Origin")
            if not self.allowed_host() or self.headers.get("X-Sim-Token") != app.token:
                return self.send({"error": "Acesso recusado"}, 403)
            if origin and origin != "http://" + self.headers.get("Host", ""):
                return self.send({"error": "Origem inválida"}, 403)
            try:
                length = int(self.headers.get("Content-Length", 0))
                limit = 1_400_000 if self.path == "/api/import-zip" else 250000
                if not 0 < length <= limit: raise ValueError("Conteúdo ausente ou grande demais")
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict): raise ValueError("Corpo deve ser um objeto JSON")
                with app.lock:
                    session = app.session
                    if self.path == "/api/import-zip":
                        return self.send(import_ftc_zip(data.get("zip_base64")))
                    if self.path == "/api/run":
                        if session.worker and session.worker.is_alive():
                            return self.send({"error": "Pare a execução atual antes de compilar outra"}, 409)
                        source = data.get("source", "")
                        if not isinstance(source, str): raise ValueError("Código inválido")
                        app.session = Session(data.get("config", {}))
                        app.session.client_required = True
                        app.session.run(source, data.get("files"))
                    elif self.path == "/api/start":
                        with session.lock:
                            if session.status != "inicializando": raise ValueError("Aguarde a inicialização Java")
                            session.started = True
                            session.status = "executando"
                    elif self.path == "/api/stop": session.stop()
                    elif self.path == "/api/reset":
                        if session.worker and session.worker.is_alive():
                            return self.send({"error": "Pare e aguarde o Java encerrar antes de reiniciar"}, 409)
                        app.session = Session(data.get("config", {}))
                    elif self.path == "/api/heartbeat":
                        session.client_seen = time.monotonic()
                    elif self.path == "/api/gamepad":
                        with session.lock:
                            validated = []
                            for index in range(2):
                                values = data.get(str(index+1), [0]*20)
                                if not isinstance(values, list) or len(values) != 20: raise ValueError("Gamepad inválido")
                                values = [float(v) for v in values]
                                if not all(math.isfinite(v) for v in values): raise ValueError("Gamepad inválido")
                                validated.append([max(-1, min(1,v)) for v in values[:4]] + [max(0,min(1,v)) for v in values[4:6]] + [int(bool(v)) for v in values[6:]])
                            session.gamepads = validated
                            session.input_seen = time.monotonic()
                    else: return self.send({"error": "Não encontrado"}, 404)
                self.send({"ok": True})
            except (ValueError, TypeError, KeyError) as error:
                self.send({"error": str(error)}, 400)
    return Handler


def main():
    app = App()
    port = int(os.environ.get("SIM_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(app))
    print(f"Meca Sim • abra http://127.0.0.1:{port}", flush=True)
    print("Java colado executa com as permissões da sua conta. Execute somente código confiável.", flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        app.session.stop()
        if app.session.worker: app.session.worker.join(timeout=3)
        server.server_close()


if __name__ == "__main__": main()
