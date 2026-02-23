import threading
import json
import hashlib
import atexit
from pathlib import Path


class TranscriptionEngine:
    """Wraps faster-whisper for background transcription with caching."""

    def __init__(self, cache_dir):
        self.cache_dir = Path(cache_dir)
        self._model = None
        self._lock = threading.Lock()
        self._current_filepath = None
        self._progress = {
            'status': 'idle',
            'percent': 0,
            'segments': [],
            'error': None,
        }
        atexit.register(self._save_partial)

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel
            self._model = WhisperModel('base', device='cpu', compute_type='int8')
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

            segments_iter, info = model.transcribe(
                filepath,
                word_timestamps=True,
                vad_filter=True,
            )

            duration = info.duration or 1.0
            all_segments = list(prior_segments) if prior_segments else []

            for segment in segments_iter:
                if segment.end <= resume_after:
                    continue

                with self._lock:
                    if self._is_stale(filepath):
                        return

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

                pct = min(99, int((segment.end / duration) * 100))
                with self._lock:
                    if self._is_stale(filepath):
                        return
                    self._progress['segments'] = list(all_segments)
                    self._progress['percent'] = pct

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
