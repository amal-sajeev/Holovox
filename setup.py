import os
import sys
from glob import glob

from distutils.core import setup
import py2exe


def collect_data_files():
    """Collect ui/, Assets/, and pywebview DLL for data_files."""
    root = os.path.dirname(os.path.abspath(__file__))
    by_dest = {}

    # ui/ folder (recursive)
    for path in glob(os.path.join(root, 'ui', '**', '*'), recursive=True):
        if os.path.isfile(path):
            rel = os.path.relpath(path, root)
            dest = os.path.dirname(rel)
            by_dest.setdefault(dest, []).append(path)

    # Assets/ folder
    assets = [f for f in glob(os.path.join(root, 'Assets', '*')) if os.path.isfile(f)]
    if assets:
        by_dest['Assets'] = assets

    # pywebview WebBrowserInterop DLL (required for Edge WebView2)
    try:
        import webview
        webview_lib = os.path.join(os.path.dirname(webview.__file__), 'lib')
        dll_name = 'WebBrowserInterop.x64.dll' if sys.maxsize > 2**32 else 'WebBrowserInterop.x86.dll'
        dll = os.path.join(webview_lib, dll_name)
        if os.path.isfile(dll):
            by_dest.setdefault('', []).append(dll)
    except Exception:
        pass

    return list(by_dest.items())


setup(
    name='HoloVox',
    version='1.0',
    description='Sci-fi console audiobook player with live transcription',
    packages=[],  # prevent setuptools from auto-discovering ui/Assets as packages
    windows=[{
        'script': 'app.py',
        'icon_resources': [],
        'dest_base': 'HoloVox',
    }],
    data_files=collect_data_files(),
    options={
        'py2exe': {
            'includes': ['webview'],
            'excludes': ['tkinter'],
            'optimize': 2,
            'bundle_files': 3,  # required for Python 3.12+
            'compressed': True,
        },
    },
)
