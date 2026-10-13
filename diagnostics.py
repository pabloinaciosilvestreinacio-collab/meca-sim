"""Diagnósticos observacionais e determinísticos da simulação, sem alterar atuadores."""
import re

def telemetry_timeout(message):
    return bool(re.search(r"(tempo\s+limite|timeout|tempo\s+auto\s+esgotado|tempo\s+esgotado)", message, re.IGNORECASE))

class Inspector:
    def __init__(self):
        self.warnings = []
        self.codes = set()
        self.last_pos = {}
        self.stall_since = {}
    def warn(self, code, message, severity='aviso', elapsed=0):
        if code in self.codes or len(self.warnings)>=16:
            return
        self.codes.add(code)
        self.warnings.append({'code':code,'severity':severity,'message':message,'time':round(elapsed,2)})
    def inspect(self, world, active):
        t=world.elapsed
        if world.imu_frozen:
            self.warn('IMU_CONGELADO','IMU configurado para leitura congelada. O yaw real pode divergir do medido.','falha simulada',t)
        for name,m in world.motors.items():
            if m.side not in ('left','right'):
                continue
            if m.encoder_frozen:
                self.warn('ENCODER_'+name,'Encoder '+name+' congelado na configuração.','falha simulada',t)
            old=self.last_pos.get(name)
            position=m.position()
            if old and active and abs(m.power)>.20 and not m.encoder_frozen:
                start=self.stall_since.get(name)
                if abs(position-old[0])>=3:
                    self.last_pos[name]=(position,t)
                    self.stall_since.pop(name,None)
                elif t-old[1]>=.7:
                    self.warn('MOTOR_SEM_PROGRESSO_'+name,'Motor '+name+' recebeu potência, mas o encoder não avançou em 0,7 s. Verifique motor, ganho e travamento.','atenção',t)
            else:
                self.last_pos[name]=(position,t)
                self.stall_since.pop(name,None)
        if active:
            drive=[(n,m) for n,m in world.motors.items() if m.side in ('left','right')]
            if len(drive)==2 and all(m.power>.25 for _,m in drive):
                for name,m in drive:
                    physical=m.power*m.direction*m.mount*(1-m.slip)*m.gain
                    if physical<-.05:
                        self.warn('POLARIDADE_'+name,'Comando de avanço positivo move a roda '+name+' para trás. Confira montagem invertida e setDirection().','atenção',t)
    def inspect_telemetry(self, message, elapsed):
        if telemetry_timeout(message):
            self.warn('TIMEOUT_JAVA','Telemetria Java indica timeout. Encerramento do OpMode não significa missão concluída.','atenção',elapsed)
