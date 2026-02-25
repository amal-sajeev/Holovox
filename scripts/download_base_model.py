"""
Pre-download the faster-whisper base model into staging/HoloVox_data/hub
so a Nuitka build can include it (--include-data-dir=./staging/HoloVox_data=HoloVox_data).
Run from repo root: python scripts/download_base_model.py
"""
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STAGING = REPO_ROOT / "staging" / "HoloVox_data"
STAGING.mkdir(parents=True, exist_ok=True)

# HF uses HUGGINGFACE_HUB_CACHE/hub; point to HoloVox_data so layout is HoloVox_data/hub/...
os.environ["HUGGINGFACE_HUB_CACHE"] = str(STAGING)

def main():
    from faster_whisper.utils import _MODELS
    from huggingface_hub import snapshot_download

    repo_id = _MODELS.get("base")
    if not repo_id:
        print("faster_whisper.utils._MODELS['base'] not found", file=sys.stderr)
        sys.exit(1)
    print("Downloading base model:", repo_id, "into", STAGING)
    snapshot_download(repo_id=repo_id)
    print("Done. Use with Nuitka: --include-data-dir=./staging/HoloVox_data=HoloVox_data")

if __name__ == "__main__":
    main()
