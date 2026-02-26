# PyInstaller spec for HoloVox — portable Windows executable.
# Build: pyinstaller HoloVox.spec
# Output: dist/HoloVox.exe (single-file portable executable)

# Note: pywebview recommends PyInstaller over py2exe for Windows.
# py2exe hits RecursionError with faster-whisper's dependency tree.

import sys
import os

block_cipher = None
spec_dir = os.path.dirname(os.path.abspath(SPEC))

# Get pywebview WebBrowserInterop DLL
webview_dll = None
try:
    import webview
    webview_lib = os.path.join(os.path.dirname(webview.__file__), 'lib')
    dll_name = 'WebBrowserInterop.x64.dll' if sys.maxsize > 2**32 else 'WebBrowserInterop.x86.dll'
    dll_path = os.path.join(webview_lib, dll_name)
    if os.path.isfile(dll_path):
        webview_dll = dll_path
except Exception:
    pass

datas = [
    (os.path.join(spec_dir, 'ui'), 'ui'),
    (os.path.join(spec_dir, 'Assets'), 'Assets'),
]
if webview_dll:
    datas.append((webview_dll, '.'))

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'webview',
        'faster_whisper',
        'huggingface_hub',
        'ctranslate2',
        'tokenizers',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        # Unused packages - use build.ps1 for a clean venv build with only project deps.
        # Excluding prevents DLL errors and reduces exe size when building from full env.
        'torch', 'torchvision', 'torchaudio',
        'transformers', 'sentencepiece',
        'scipy', 'pandas',
        'PIL', 'cv2', 'matplotlib',
        'tensorflow', 'keras',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='HoloVox',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
