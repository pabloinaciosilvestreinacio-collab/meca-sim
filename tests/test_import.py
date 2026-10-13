"""Validação da importação ZIP FTC (sem extrair no filesystem)."""
import base64
import io
import os
import sys
import unittest
import zipfile

sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
from project_import import import_ftc_zip

BASE="FtcRobotController-master/TeamCode/src/main/java/"
MAIN="""package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
public class MeuAutonomo extends LinearOpMode {
    public void runOpMode() { waitForStart(); }
}
"""
UTIL="""package org.firstinspires.ftc.teamcode.util;
public class Auxiliar { public static int valor() { return 42; } }"""


def zipped(items):
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as out:
        for name,content in items.items():
            out.writestr(name,content)
    return base64.b64encode(buffer.getvalue()).decode('ascii')


class ZipImportTests(unittest.TestCase):
    def test_imports_opmode_and_helper_without_extracting(self):
        result=import_ftc_zip(zipped({
            BASE+"org/firstinspires/ftc/teamcode/MeuAutonomo.java":MAIN,
            BASE+"org/firstinspires/ftc/teamcode/util/Auxiliar.java":UTIL,
            "FtcRobotController-master/RobotCore/src/main/java/Sdk.java":"class Sdk {}",
        }))
        self.assertEqual(len(result['files']),2)
        self.assertEqual(result['opmodes'][0]['name'],'MeuAutonomo')
        self.assertIn('org/firstinspires/ftc/teamcode/util/Auxiliar.java',result['files'])

    def test_rejects_traversal(self):
        with self.assertRaisesRegex(ValueError,'caminho'):
            import_ftc_zip(zipped({"folder/../TeamCode/src/main/java/A.java":MAIN}))

    def test_rejects_zip_bomb_after_metadata_check(self):
        with self.assertRaisesRegex(ValueError,'grande demais|220 kB'):
            import_ftc_zip(zipped({BASE+'Huge.java':'x'*230000}))

    def test_rejects_archives_without_teamcode(self):
        with self.assertRaisesRegex(ValueError,'Nenhuma'):
            import_ftc_zip(zipped({'Other/src/main/java/MeuAutonomo.java':MAIN}))

    def test_rejects_invalid_data(self):
        for data in ('abc','',None):
            with self.subTest(data=data),self.assertRaises(ValueError):import_ftc_zip(data)

    def test_opmode_options_preserve_multiple(self):
        result=import_ftc_zip(zipped({
            BASE+"org/firstinspires/ftc/teamcode/Um.java":MAIN.replace("MeuAutonomo","Um"),
            BASE+"org/firstinspires/ftc/teamcode/Dois.java":MAIN.replace("MeuAutonomo","Dois"),
        }))
        self.assertEqual([x['name'] for x in result['opmodes']],['Um','Dois'])


if __name__=='__main__':
    unittest.main()
