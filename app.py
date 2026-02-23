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

CONFIG_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.m4b', '.flac', '.wav', '.ogg'}


class AudioHandler(BaseHTTPRequestHandler):
    """HTTP handler serving UI files, assets, and audio with range-request support."""

    allowed_audio_paths = set()

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
            except Exception:
                self.send_error(416)
        else:
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

    def log_message(self, format, *args):
        pass


class API:
    """Python API exposed to the JavaScript frontend via pywebview."""

    def __init__(self, server_port):
        self._server_port = server_port
        self._transcriber = TranscriptionEngine(CACHE_DIR)
        self._current_file = None
        self._load_settings()

    # ── Settings persistence ──────────────────────────────────────────

    def _load_settings(self):
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, encoding='utf-8') as f:
                self._settings = json.load(f)
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
        if os.path.isfile(filepath):
            return self._prepare_audio(filepath)
        return None

    def _prepare_audio(self, filepath):
        AudioHandler.allowed_audio_paths.add(filepath)
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

    # ── Library ───────────────────────────────────────────────────────

    def scan_library(self):
        folder = self._settings.get('library_folder', '')
        if not folder or not os.path.isdir(folder):
            return []

        files = []
        for root, _dirs, filenames in os.walk(folder):
            for fn in filenames:
                if Path(fn).suffix.lower() in AUDIO_EXTENSIONS:
                    full_path = os.path.join(root, fn)
                    files.append({
                        'path': full_path,
                        'name': fn,
                        'folder': os.path.relpath(root, folder),
                        'has_transcript': self._transcriber.has_cached(full_path),
                    })
        files.sort(key=lambda x: x['name'].lower())
        return files

    def set_library_folder(self):
        result = webview.windows[0].create_file_dialog(webview.FileDialog.FOLDER)
        if result and len(result) > 0:
            self._settings['library_folder'] = result[0]
            self._save_settings()
            return result[0]
        return None

    def get_library_folder(self):
        return self._settings.get('library_folder', '')

    def get_recent_files(self):
        return self._settings.get('recent_files', [])

    # ── Bookmarks ─────────────────────────────────────────────────────

    def save_bookmark(self, filepath, position, label):
        bookmarks = self._load_bookmarks()
        bm_id = hashlib.md5(
            f'{filepath}:{position}:{label}'.encode()
        ).hexdigest()[:8]
        bookmarks.append({
            'id': bm_id,
            'filepath': filepath,
            'position': position,
            'label': label,
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
            with open(BOOKMARKS_FILE, encoding='utf-8') as f:
                return json.load(f)
        return []

    def _save_bookmarks(self, bookmarks):
        with open(BOOKMARKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(bookmarks, f, indent=2)

    # ── Settings ──────────────────────────────────────────────────────

    def get_settings(self):
        return dict(self._settings)

    def update_settings(self, key, value):
        self._settings[key] = value
        self._save_settings()
        return True

    # ── Window control ────────────────────────────────────────────────

    def close_window(self):
        webview.windows[0].destroy()

    def minimize_window(self):
        webview.windows[0].minimize()


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
        frameless=True,
        easy_drag=False,
        resizable=False,
        transparent=True,
    )

    webview.start(debug=False)


if __name__ == '__main__':
    main()
