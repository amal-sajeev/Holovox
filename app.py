import webview
import threading
import json
import os
import sys
import socket
import base64
import mimetypes
import hashlib
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlparse
from transcriber import TranscriptionEngine

APP_DIR = Path(__file__).parent
UI_DIR = APP_DIR / 'ui'
ASSETS_DIR = APP_DIR / 'Assets'
CONFIG_DIR = Path.home() / '.foobskin'
CACHE_DIR = CONFIG_DIR / 'cache'
SETTINGS_FILE = CONFIG_DIR / 'settings.json'
BOOKMARKS_FILE = CONFIG_DIR / 'bookmarks.json'

try:
    CONFIG_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(exist_ok=True)
except OSError:
    pass  # read-only home or permission error; persistence will fail later

KNOWN_LANGUAGES = {'auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi'}

SETTINGS_KEYS = {'library_folder', 'recent_files', 'whisper_model', 'language', 'mute_sounds'}

# Extensions for library scan (must match open-file dialog: mp3, m4a, m4b, flac, wav, ogg)
AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.m4b', '.flac', '.wav', '.ogg'}

MODEL_INFO = {
    'tiny':             {'desc': 'Fastest, least accurate',     'size': '~75 MB'},
    'tiny.en':          {'desc': 'Fastest, English only',       'size': '~75 MB'},
    'base':             {'desc': 'Fast, good accuracy',         'size': '~150 MB'},
    'base.en':          {'desc': 'Fast, English only',          'size': '~150 MB'},
    'small':            {'desc': 'Balanced speed/accuracy',     'size': '~500 MB'},
    'small.en':         {'desc': 'Balanced, English only',      'size': '~500 MB'},
    'medium':           {'desc': 'High accuracy, slower',       'size': '~1.5 GB'},
    'medium.en':        {'desc': 'High accuracy, English only', 'size': '~1.5 GB'},
    'large-v1':         {'desc': 'Very high accuracy',          'size': '~3 GB'},
    'large-v2':         {'desc': 'Improved large',              'size': '~3 GB'},
    'large-v3':         {'desc': 'Best accuracy',               'size': '~3 GB'},
    'large':            {'desc': 'Best accuracy (alias v3)',    'size': '~3 GB'},
    'turbo':            {'desc': 'Large quality, faster',       'size': '~1.6 GB'},
    'large-v3-turbo':   {'desc': 'Large quality, faster',       'size': '~1.6 GB'},
    'distil-small.en':  {'desc': 'Distilled small, English',    'size': '~400 MB'},
    'distil-medium.en': {'desc': 'Distilled medium, English',   'size': '~800 MB'},
    'distil-large-v2':  {'desc': 'Distilled large v2',          'size': '~1.5 GB'},
    'distil-large-v3':  {'desc': 'Distilled large v3',          'size': '~1.5 GB'},
    'distil-large-v3.5':{'desc': 'Distilled large v3.5',        'size': '~1.5 GB'},
}


class AudioHandler(BaseHTTPRequestHandler):
    """HTTP handler serving UI files, assets, and audio with range-request support."""

    allowed_audio_paths = []  # list of paths, capped to last 50

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == '/' or path == '/ui/index.html':
            self._serve_file(UI_DIR / 'index.html')
        elif path.startswith('/ui/'):
            self._serve_file(UI_DIR / path[4:])
        elif path.startswith('/assets/'):
            self._serve_file(ASSETS_DIR / path[8:])
        elif path.startswith('/audio/'):
            encoded = path[7:]
            try:
                filepath = base64.urlsafe_b64decode(encoded).decode('utf-8')
            except Exception:
                self.send_error(400)
                return
            if filepath in self.allowed_audio_paths:
                self._serve_file(Path(filepath), range_support=True)
            else:
                self.send_error(403)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Range')

    def _serve_file(self, filepath, range_support=False):
        filepath = filepath.resolve()
        if not filepath.exists() or not filepath.is_file():
            self.send_error(404)
            return

        content_type, _ = mimetypes.guess_type(str(filepath))
        if not content_type:
            content_type = 'application/octet-stream'

        file_size = filepath.stat().st_size

        if range_support and 'Range' in self.headers:
            try:
                range_spec = self.headers['Range'].replace('bytes=', '')
                parts = range_spec.split('-')
                start = int(parts[0]) if parts[0] else 0
                end = int(parts[1]) if parts[1] else file_size - 1
                end = min(end, file_size - 1)
                length = end - start + 1
            except (ValueError, IndexError):
                self.send_error(416)
                return

            try:
                self.send_response(206)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', length)
                self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                self.send_header('Accept-Ranges', 'bytes')
                self._cors_headers()
                self.end_headers()

                with open(filepath, 'rb') as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(remaining, 65536))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            except (ConnectionError, BrokenPipeError, OSError):
                return
        else:
            try:
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', file_size)
                if range_support:
                    self.send_header('Accept-Ranges', 'bytes')
                self._cors_headers()
                self.end_headers()

                with open(filepath, 'rb') as f:
                    while True:
                        chunk = f.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except (ConnectionError, BrokenPipeError, OSError):
                return

    def log_message(self, format, *args):
        pass


class API:
    """Python API exposed to the JavaScript frontend via pywebview."""

    def __init__(self, server_port):
        self._server_port = server_port
        self._current_file = None
        self._load_settings()
        self._transcriber = TranscriptionEngine(
            CACHE_DIR,
            model_name=self._settings.get('whisper_model', 'base'),
            language=self._settings.get('language', 'auto'),
        )

    # ── Settings persistence ──────────────────────────────────────────

    def _load_settings(self):
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, encoding='utf-8') as f:
                    self._settings = json.load(f)
            except (json.JSONDecodeError, OSError):
                self._settings = {
                    'library_folder': '',
                    'recent_files': [],
                    'whisper_model': 'base',
                    'language': 'auto',
                }
                self._save_settings()
        else:
            self._settings = {
                'library_folder': '',
                'recent_files': [],
                'whisper_model': 'base',
                'language': 'auto',
            }
            self._save_settings()

    def _save_settings(self):
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(self._settings, f, indent=2)

    # ── File / audio operations ───────────────────────────────────────

    def open_file(self):
        if not webview.windows:
            return None
        result = webview.windows[0].create_file_dialog(
            webview.FileDialog.OPEN,
            file_types=(
                'Audio Files (*.mp3;*.m4a;*.m4b;*.flac;*.wav;*.ogg)',
                'All Files (*.*)',
            ),
        )
        if result and len(result) > 0:
            return self._prepare_audio(result[0])
        return None

    def load_file(self, filepath):
        if not filepath or '..' in filepath:
            return None
        if os.path.isfile(filepath):
            return self._prepare_audio(filepath)
        return None

    def _prepare_audio(self, filepath):
        AudioHandler.allowed_audio_paths.append(filepath)
        if len(AudioHandler.allowed_audio_paths) > 50:
            AudioHandler.allowed_audio_paths = AudioHandler.allowed_audio_paths[-50:]
        encoded = base64.urlsafe_b64encode(filepath.encode()).decode()
        url = f'http://localhost:{self._server_port}/audio/{encoded}'
        self._current_file = filepath

        recent = self._settings.get('recent_files', [])
        if filepath in recent:
            recent.remove(filepath)
        recent.insert(0, filepath)
        self._settings['recent_files'] = recent[:20]
        self._save_settings()

        return {
            'url': url,
            'filename': os.path.basename(filepath),
            'filepath': filepath,
        }

    # ── Transcription ─────────────────────────────────────────────────

    def start_transcription(self, filepath):
        self._transcriber.start(filepath)
        return True

    def get_transcription_progress(self):
        return self._transcriber.get_progress()

    def get_cached_transcription(self, filepath):
        return self._transcriber.get_cached(filepath)

    def retranscribe(self):
        if not self._current_file:
            return False
        self._transcriber.clear_cache(self._current_file)
        self._transcriber.start(self._current_file)
        return True

    # ── Model management (launcher) ───────────────────────────────────

    def get_available_models(self):
        raw = self._transcriber.get_available_models()
        configured = self._settings.get('whisper_model', 'base')
        result = []
        for m in raw:
            info = MODEL_INFO.get(m['name'], {})
            result.append({
                'name': m['name'],
                'cached': m['cached'],
                'desc': info.get('desc', ''),
                'size': info.get('size', ''),
                'configured': m['name'] == configured,
            })
        return result

    def download_model(self, name):
        if name not in MODEL_INFO:
            return False
        self._transcriber.set_model(name)
        self._settings['whisper_model'] = name
        self._save_settings()
        self._transcriber.download_model(name)
        return True

    def get_download_progress(self):
        return self._transcriber.get_download_progress()

    # ── Library ───────────────────────────────────────────────────────

    def scan_library(self):
        folder = self._settings.get('library_folder', '')
        if not folder or not os.path.isdir(folder):
            return {'loose': [], 'books': []}

        folder_path = Path(folder)
        loose = []
        books = []

        # Loose: audio files directly in the library root
        try:
            for fn in os.listdir(folder):
                p = folder_path / fn
                if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS:
                    full_path = os.path.normpath(p)
                    loose.append({
                        'path': full_path,
                        'name': fn,
                        'has_transcript': self._transcriber.has_cached(full_path),
                    })
        except OSError:
            pass
        loose.sort(key=lambda x: x['name'].lower())

        # Books: immediate subdirs that contain at least one audio file
        try:
            for entry in os.scandir(folder):
                if not entry.is_dir():
                    continue
                sub_path = Path(entry.path)
                files_in_dir = []
                for root, _dirs, filenames in os.walk(entry.path):
                    for fn in filenames:
                        if Path(fn).suffix.lower() in AUDIO_EXTENSIONS:
                            full_path = os.path.normpath(os.path.join(root, fn))
                            files_in_dir.append({
                                'path': full_path,
                                'name': fn,
                                'has_transcript': self._transcriber.has_cached(full_path),
                            })
                if files_in_dir:
                    files_in_dir.sort(key=lambda x: (x['path'].lower(), x['name'].lower()))
                    books.append({
                        'path': os.path.normpath(entry.path),
                        'name': entry.name,
                        'files': files_in_dir,
                    })
        except OSError:
            pass
        books.sort(key=lambda x: x['name'].lower())

        return {'loose': loose, 'books': books}

    def set_library_folder(self):
        if not webview.windows:
            return None
        result = webview.windows[0].create_file_dialog(webview.FileDialog.FOLDER)
        if result is None or len(result) == 0:
            return None
        self._settings['library_folder'] = result[0]
        self._save_settings()
        return result[0]

    def get_library_folder(self):
        return self._settings.get('library_folder', '')

    def get_recent_files(self):
        return self._settings.get('recent_files', [])

    # ── Bookmarks ─────────────────────────────────────────────────────

    def save_bookmark(self, filepath, position, label):
        if not filepath or not isinstance(filepath, str) or not filepath.strip():
            return None
        try:
            pos = float(position)
        except (TypeError, ValueError):
            return None
        if not (pos >= 0 and pos != float('inf')):
            return None
        bookmarks = self._load_bookmarks()
        bm_id = hashlib.md5(
            f'{filepath}:{position}:{label}'.encode()
        ).hexdigest()[:8]
        bookmarks.append({
            'id': bm_id,
            'filepath': filepath,
            'position': pos,
            'label': label or '',
        })
        self._save_bookmarks(bookmarks)
        return bm_id

    def get_bookmarks(self, filepath):
        return [b for b in self._load_bookmarks() if b['filepath'] == filepath]

    def delete_bookmark(self, bm_id):
        bookmarks = [b for b in self._load_bookmarks() if b['id'] != bm_id]
        self._save_bookmarks(bookmarks)
        return True

    def _load_bookmarks(self):
        if BOOKMARKS_FILE.exists():
            try:
                with open(BOOKMARKS_FILE, encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return []

    def _save_bookmarks(self, bookmarks):
        with open(BOOKMARKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(bookmarks, f, indent=2)

    # ── Settings ──────────────────────────────────────────────────────

    def get_settings(self):
        return dict(self._settings)

    def update_settings(self, key, value):
        if key not in SETTINGS_KEYS:
            return False
        if key == 'whisper_model' and value not in MODEL_INFO:
            return False
        if key == 'language' and value not in KNOWN_LANGUAGES:
            return False
        self._settings[key] = value
        self._save_settings()
        if key == 'whisper_model':
            self._transcriber.set_model(value)
        elif key == 'language':
            self._transcriber.set_language(value)
        return True

    # ── Window control ────────────────────────────────────────────────

    def close_window(self):
        if webview.windows:
            webview.windows[0].destroy()

    def minimize_window(self):
        if webview.windows:
            webview.windows[0].minimize()

    def get_window_geometry(self):
        if not webview.windows:
            return {'x': 0, 'y': 0, 'w': 900, 'h': 720}
        w = webview.windows[0]
        return {'x': w.x, 'y': w.y, 'w': w.width, 'h': w.height}

    def set_window_rect(self, x, y, w, h):
        if not webview.windows:
            return
        win = webview.windows[0]
        x, y, w, h = int(x), int(y), int(w), int(h)
        # Use pywebview API first (works when backend respects resizable=True on frameless)
        try:
            win.resize(w, h)
            win.move(x, y)
        except Exception:
            pass
        # On Windows, also apply via Win API so resize takes effect on frameless windows
        if sys.platform == 'win32':
            import ctypes
            HWND_TOP = 0
            SWP_NOZORDER = 0x0004
            SWP_NOACTIVATE = 0x0010
            flags = SWP_NOZORDER | SWP_NOACTIVATE

            def find_main_window():
                hwnd = ctypes.windll.user32.FindWindowW(None, 'AudioBook Player')
                if hwnd:
                    return hwnd
                # Fallback: enumerate top-level windows and match by title
                result = ctypes.c_void_p()

                def enum_cb(h, _):
                    buf = ctypes.create_unicode_buffer(256)
                    if ctypes.windll.user32.GetWindowTextW(h, buf, 256) and 'AudioBook Player' in buf.value:
                        result.value = h
                        return False  # stop
                    return True

                WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
                ctypes.windll.user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
                return result.value if result.value else None

            hwnd = find_main_window()
            if hwnd:
                ctypes.windll.user32.SetWindowPos(
                    hwnd, HWND_TOP, x, y, w, h, flags)


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('localhost', 0))
        return s.getsockname()[1]


def start_server(port):
    server = HTTPServer(('localhost', port), AudioHandler)
    server.serve_forever()


def main():
    port = find_free_port()

    server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    server_thread.start()

    api = API(port)

    window = webview.create_window(
        'AudioBook Player',
        url=f'http://localhost:{port}/ui/index.html',
        js_api=api,
        width=900,
        height=720,
        easy_drag=False,
        frameless=True,
        resizable=True,
        min_size=(950, 500),
        background_color='#0a0c0e',
    )

    webview.start(debug=False)


if __name__ == '__main__':
    main()
