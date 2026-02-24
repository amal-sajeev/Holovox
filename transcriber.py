import threading
import json
import hashlib
import time
import atexit
from pathlib import Path


class TranscriptionEngine:
    """Wraps faster-whisper for background transcription with caching."""

    _ALLOW_PATTERNS = [
        "config.json",
        "preprocessor_config.json",
        "model.bin",
        "tokenizer.json",
        "vocabulary.*",
    ]

    def __init__(self, cache_dir, model_name='base', language='auto'):
        self.cache_dir = Path(cache_dir)
        self._model = None
        self._model_name = model_name
        self._language = language
        self._lock = threading.Lock()
        self._current_filepath = None
        self._progress = {
            'status': 'idle',
            'percent': 0,
            'segments': [],
            'error': None,
        }
        self._download_progress = {
            'status': 'idle',
            'percent': 0,
            'model_name': '',
            'error': None,
        }
        atexit.register(self._save_partial)

    def set_model(self, name):
        if name != self._model_name:
            self._model_name = name
            self._model = None

    def set_language(self, language):
        self._language = language

    # ── Model management (launcher) ──────────────────────────────

    def get_available_models(self):
        import huggingface_hub
        from faster_whisper.utils import _MODELS

        try:
            cache_info = huggingface_hub.scan_cache_dir()
            cached_repos = {repo.repo_id for repo in cache_info.repos}
        except Exception:
            cached_repos = set()

        results = []
        for name, repo_id in _MODELS.items():
            results.append({
                'name': name,
                'repo_id': repo_id,
                'cached': repo_id in cached_repos,
            })
        return results

    def download_model(self, name):
        with self._lock:
            self._download_progress = {
                'status': 'downloading',
                'percent': 0,
                'model_name': name,
                'error': None,
            }

        t = threading.Thread(
            target=self._download_model_thread,
            args=(name,),
            daemon=True,
        )
        t.start()

    def _download_model_thread(self, name):
        try:
            import huggingface_hub
            from faster_whisper.utils import _MODELS
            import tqdm.auto as tqdm_mod

            repo_id = _MODELS.get(name, name)
            engine = self
            orig_tqdm = tqdm_mod.tqdm

            class _ProgressTqdm(orig_tqdm):
                def update(self, n=1):
                    super().update(n)
                    if self.total:
                        pct = min(99, int(self.n / self.total * 100))
                        with engine._lock:
                            engine._download_progress['percent'] = pct

            tqdm_mod.tqdm = _ProgressTqdm
            try:
                huggingface_hub.snapshot_download(
                    repo_id,
                    allow_patterns=self._ALLOW_PATTERNS,
                )
            finally:
                tqdm_mod.tqdm = orig_tqdm

            with self._lock:
                self._download_progress = {
                    'status': 'complete',
                    'percent': 100,
                    'model_name': name,
                    'error': None,
                }
        except Exception as e:
            with self._lock:
                self._download_progress = {
                    'status': 'error',
                    'percent': 0,
                    'model_name': name,
                    'error': str(e),
                }

    def get_download_progress(self):
        with self._lock:
            return dict(self._download_progress)

    # ── Model loading ────────────────────────────────────────────

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            with self._lock:
                self._progress['status'] = 'loading'

            print(f'[Whisper] Loading model: {self._model_name}')
            self._model = WhisperModel(self._model_name, device='cpu', compute_type='int8')
            print('[Whisper] Model loaded successfully')
        return self._model

    def _cache_key(self, filepath):
        h = hashlib.md5()
        with open(filepath, 'rb') as f:
            h.update(f.read(1024 * 1024))
        h.update(filepath.encode())
        return h.hexdigest()

    def _cache_path(self, filepath):
        return self.cache_dir / f'{self._cache_key(filepath)}.transcript.json'

    def _partial_cache_path(self, filepath):
        return self.cache_dir / f'{self._cache_key(filepath)}.partial.json'

    def has_cached(self, filepath):
        try:
            return self._cache_path(filepath).exists()
        except Exception:
            return False

    def get_cached(self, filepath):
        try:
            cp = self._cache_path(filepath)
            if cp.exists():
                with open(cp, encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return None

    def clear_cache(self, filepath):
        try:
            self._cache_path(filepath).unlink(missing_ok=True)
            self._partial_cache_path(filepath).unlink(missing_ok=True)
        except Exception:
            pass

    def _get_partial(self, filepath):
        try:
            pp = self._partial_cache_path(filepath)
            if pp.exists():
                with open(pp, encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return None

    def _save_partial(self):
        with self._lock:
            fp = self._current_filepath
            status = self._progress.get('status')
            segments = self._progress.get('segments', [])

        if not fp or status not in ('transcribing', 'loading') or not segments:
            return

        try:
            partial = {
                'status': 'partial',
                'segments': segments,
                'resume_after': segments[-1]['end'],
            }
            pp = self._partial_cache_path(fp)
            with open(pp, 'w', encoding='utf-8') as f:
                json.dump(partial, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def start(self, filepath):
        cached = self.get_cached(filepath)
        if cached:
            with self._lock:
                self._current_filepath = filepath
                self._progress = {
                    'status': 'complete',
                    'percent': 100,
                    'segments': cached['segments'],
                    'error': None,
                }
            return

        partial = self._get_partial(filepath)
        prior_segments = partial['segments'] if partial else []
        resume_after = partial['resume_after'] if partial else 0.0

        with self._lock:
            self._current_filepath = filepath
            self._progress = {
                'status': 'loading',
                'percent': 0,
                'segments': prior_segments,
                'error': None,
            }

        t = threading.Thread(
            target=self._transcribe,
            args=(filepath, prior_segments, resume_after),
            daemon=True,
        )
        t.start()

    def _is_stale(self, filepath):
        return self._current_filepath != filepath

    def _transcribe(self, filepath, prior_segments=None, resume_after=0.0):
        try:
            model = self._get_model()

            with self._lock:
                if self._is_stale(filepath):
                    return
                self._progress['status'] = 'transcribing'

            print(f'[Whisper] Starting transcription: {filepath}')
            lang = self._language if self._language != 'auto' else None
            segments_iter, info = model.transcribe(
                filepath,
                language=lang,
                word_timestamps=True,
                vad_filter=False,
            )

            duration = info.duration or 1.0
            print(f'[Whisper] Audio duration: {duration:.1f}s, language: {info.language}')

            with self._lock:
                self._progress['duration'] = duration

            all_segments = list(prior_segments) if prior_segments else []
            wall_start = None

            print('[Whisper] Waiting for first segment...')
            for segment in segments_iter:
                if segment.end <= resume_after:
                    continue

                with self._lock:
                    if self._is_stale(filepath):
                        return

                if wall_start is None:
                    wall_start = time.monotonic()

                words = []
                if segment.words:
                    for w in segment.words:
                        words.append({
                            'start': round(w.start, 3),
                            'end': round(w.end, 3),
                            'word': w.word,
                        })

                seg_data = {
                    'start': round(segment.start, 3),
                    'end': round(segment.end, 3),
                    'text': segment.text.strip(),
                    'words': words,
                }
                all_segments.append(seg_data)

                if len(all_segments) == 1:
                    print(f'[Whisper] First segment received: {segment.start:.1f}-{segment.end:.1f}s')

                elapsed = time.monotonic() - wall_start
                rate = round(segment.end / elapsed, 2) if elapsed > 0.1 else 0

                pct = min(99, int((segment.end / duration) * 100))
                with self._lock:
                    if self._is_stale(filepath):
                        return
                    self._progress['segments'] = list(all_segments)
                    self._progress['percent'] = pct
                    self._progress['rate'] = rate
                    self._progress['transcribed_up_to'] = round(segment.end, 3)

            result = {
                'language': info.language,
                'duration': duration,
                'segments': all_segments,
            }
            cache_path = self._cache_path(filepath)
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            try:
                self._partial_cache_path(filepath).unlink(missing_ok=True)
            except Exception:
                pass

            with self._lock:
                if self._is_stale(filepath):
                    return
                self._progress = {
                    'status': 'complete',
                    'percent': 100,
                    'segments': all_segments,
                    'error': None,
                }

        except Exception as e:
            print(f'[Whisper] Transcription error: {e}')
            with self._lock:
                if self._is_stale(filepath):
                    return
                self._progress = {
                    'status': 'error',
                    'percent': 0,
                    'segments': [],
                    'error': str(e),
                }

    def get_progress(self):
        with self._lock:
            return dict(self._progress)
