package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name = "Simulador: chassi, intake e shooter")
public class TeleOpDemo extends LinearOpMode {
    @Override
    public void runOpMode() throws InterruptedException {
        DcMotor ME = hardwareMap.get(DcMotor.class, "ME");
        DcMotor MD = hardwareMap.get(DcMotor.class, "MD");
        ME.setDirection(DcMotor.Direction.FORWARD);
        MD.setDirection(DcMotor.Direction.REVERSE);
        DcMotor MI = hardwareMap.get(DcMotor.class, "MI");
        DcMotor MS = hardwareMap.get(DcMotor.class, "MS");
        // WASD: chassi. LB (Z): intake. RB (C): intake + shooter.
        // As teclas podem ser remapeadas no painel Controles.
        // Soltar LB/RB para os mecanismos; sem estoque não há disparo.
        telemetry.addLine("LB/Z: coletar | RB/C: alimentar e lançar | WASD: dirigir");
        telemetry.update();
        waitForStart();
        try {
            while (opModeIsActive()) {
                double frente = -gamepad1.left_stick_y;
                double giro = -gamepad1.right_stick_x;
                double esquerda = frente - giro;
                double direita = frente + giro;
                double escala = Math.max(1, Math.max(Math.abs(esquerda), Math.abs(direita)));
                ME.setPower(esquerda / escala);
                MD.setPower(direita / escala);
                boolean atirar = gamepad1.right_bumper;
                MI.setPower(gamepad1.left_bumper || atirar ? 1 : 0);
                MS.setPower(atirar ? 1 : 0);
                telemetry.addData("Intake MI", MI.getPower());
                telemetry.addData("Shooter MS", MS.getPower());
                telemetry.addData("ME", ME.getCurrentPosition());
                telemetry.addData("MD", MD.getCurrentPosition());
                telemetry.update();
                idle();
            }
        } finally {
            ME.setPower(0);
            MD.setPower(0);
            MI.setPower(0);
            MS.setPower(0);
        }
    }
}
