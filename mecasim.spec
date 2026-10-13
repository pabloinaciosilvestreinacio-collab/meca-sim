# -*- mode: python ; coding: utf-8 -*-
a = Analysis(
    ['iniciar.py'],
    pathex=['.'],
    binaries=[],
    datas=[('web', 'web'), ('examples.json', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MecaSim',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)
