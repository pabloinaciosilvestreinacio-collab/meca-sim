"""Importação local, limitada e sem extração em disco, de TeamCode/src/main/java."""
import base64
import binascii
import io
import re
import zipfile

MAX_ZIP = 1_000_000
MAX_JAVA = 220_000
MAX_FILES = 31
JAVA_PATH = re.compile(r"(?:[A-Za-z_$][A-Za-z0-9_$]*/)*[A-Za-z_$][A-Za-z0-9_$]*\.java\Z")
OPMODE = re.compile(r"\bpublic\s+(?:(?:final|strictfp)\s+)*class\s+([A-Za-z_$][\w$]*)\s+extends\s+(?:com\.qualcomm\.robotcore\.eventloop\.opmode\.)?LinearOpMode\b")


def import_ftc_zip(encoded):
    if not isinstance(encoded, str) or len(encoded) > 1_400_000:
        raise ValueError("ZIP excede 1 MB")
    try:
        binary = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("ZIP codificado incorretamente") from error
    if not binary or len(binary) > MAX_ZIP:
        raise ValueError("ZIP excede 1 MB")
    files, total = {}, 0
    try:
        with zipfile.ZipFile(io.BytesIO(binary)) as archive:
            entries = archive.infolist()
            if len(entries) > 1500:
                raise ValueError("ZIP possui entradas demais")
            for entry in entries:
                if entry.is_dir():
                    continue
                name = entry.filename
                if "\\" in name or ".." in name.split("/") or name.startswith("/"):
                    raise ValueError("ZIP possui caminho inválido")
                if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError("ZIP contém link simbólico")
                parts = name.split("/")
                marker = next((i for i in range(len(parts)-3)
                               if parts[i].lower() == "teamcode" and parts[i+1:i+4] == ["src","main","java"]), None)
                if marker is None or not name.endswith(".java"):
                    continue
                path = "/".join(parts[marker+4:])
                if not JAVA_PATH.fullmatch(path):
                    raise ValueError("Nome Java inválido no ZIP")
                if path in files:
                    raise ValueError("Há caminhos Java duplicados no ZIP")
                if entry.file_size < 1 or entry.file_size > MAX_JAVA:
                    raise ValueError("Arquivo Java vazio ou grande demais")
                total += entry.file_size
                if total > MAX_JAVA or len(files) >= MAX_FILES:
                    raise ValueError("Projeto excede 220 kB ou 31 arquivos Java; reduza o conjunto")
                raw = archive.read(entry)
                if len(raw) != entry.file_size:
                    raise ValueError("Arquivo ZIP inconsistente")
                files[path] = raw.decode("utf-8-sig")
    except (zipfile.BadZipFile, UnicodeDecodeError, RuntimeError, EOFError) as error:
        raise ValueError("ZIP inválido ou Java não está em UTF-8") from error
    opmodes = []
    for path, source in files.items():
        match = OPMODE.search(source)
        if match:
            opmodes.append({"path": path, "name": match.group(1)})
    if not opmodes:
        raise ValueError("Nenhuma classe pública extends LinearOpMode encontrada em TeamCode/src/main/java")
    return {"files": files, "opmodes": opmodes}
