
<p align="center">

```
 ██╗  ██╗ ██████╗ ██╗      ██████╗ ██╗   ██╗ ██████╗ ██╗  ██╗
 ██║  ██║██╔═══██╗██║     ██╔═══██╗██║   ██║██╔═══██╗╚██╗██╔╝
 ███████║██║   ██║██║     ██║   ██║██║   ██║██║   ██║ ╚███╔╝
 ██╔══██║██║   ██║██║     ██║   ██║╚██╗ ██╔╝██║   ██║ ██╔██╗
 ██║  ██║╚██████╔╝███████╗╚██████╔╝ ╚████╔╝ ╚██████╔╝██╔╝ ██╗
 ╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝   ╚═══╝   ╚═════╝╚═╝  ╚═╝
```

</p>

<p align="center">
  <strong>Sci‑fi console audiobook player</strong><br>
  <em>Live transcription &bull; Word-level highlighting &bull; Language learning</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.9+-blue?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/UI-pywebview-green?style=flat-square" />
  <img src="https://img.shields.io/badge/STT-faster--whisper-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/theme-Console-666?style=flat-square" />
</p>

---

```
  ┌──────────────────────────────────────────────────────────────┐
  │  ╔══════════════════════════════════════════════════════╗    │
  │  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ║  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ║  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ╚══════════════════════════════════════════════════════╝    │
  │  ◄◄   ►   ►►   ■            ◎ VOL    ◎ SPD    [▰▰▰▱▱]     │
  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
  │  > Transcribing...                                            │
  │  > Current segment with word-level sync                      │
  └──────────────────────────────────────────────────────────────┘
```

## About

**HoloVox** is a desktop audiobook player with a sci‑fi command-deck style interface. It pairs local Whisper-based speech-to-text with word-level highlighting, making it a practical tool for language learning — or just following along with any audiobook.

Boot it up. Run through the startup sequence. Load an audiobook. Transcription runs locally with no cloud or API keys.

## Features

| | Feature | Description |
|---|---|---|
| ◈ | **Console UI** | Brushed-metal panels, display typography, scanline effects, LED status indicators |
| ◈ | **Live transcription** | Whisper-powered speech-to-text with word-level karaoke highlighting |
| ◈ | **Current segment display** | Large readout of the active phrase with sync to playback |
| ◈ | **Bookmarks** | Save and label positions across your audiobook collection |
| ◈ | **Library** | Folder-based scanning with recent files |
| ◈ | **Speed control** | 0.5x – 2.0x playback with knob controls |
| ◈ | **Smart caching** | Transcription results cached locally; partial progress saved on exit |
| ◈ | **Boot sequence** | Animated startup and optional first-run model download |

## Prerequisites

- **Python 3.9+**
- **FFmpeg** on PATH

### Installing FFmpeg (Windows)

```powershell
# Option A — winget
winget install Gyan.FFmpeg

# Option B — manual
# Download from https://www.gyan.dev/ffmpeg/builds/ ("essentials" build)
# Extract and add the bin\ folder to your system PATH
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Launch HoloVox
python app.py
```

On first launch, the Whisper speech-to-text model (~150 MB) will be downloaded automatically.

## Controls

```
  ╔════════════════════════════════════════════════╗
  ║  KEYBOARD           ACTION                    ║
  ╠════════════════════════════════════════════════╣
  ║  Space              Play / Pause              ║
  ║  ←                  Skip back 5s              ║
  ║  →                  Skip forward 5s          ║
  ║  ↑                  Volume up                ║
  ║  ↓                  Volume down              ║
  ║  Esc                Close overlay panels     ║
  ╚════════════════════════════════════════════════╝
```

- Click the **title bar** to open the audiobook library
- Drag the **VOL** and **SPD** knobs to adjust volume and playback speed
- Transcription runs automatically when a file is loaded

## Supported Formats

```
  ┌─────┬─────┬─────┬──────┬─────┬─────┐
  │ MP3 │ M4A │ M4B │ FLAC │ WAV │ OGG │
  └─────┴─────┴─────┴──────┴─────┴─────┘
```

## Settings

Access settings through the UI to configure:

- **Whisper model** — `tiny` / `base` / `small` / `medium` (trade speed for accuracy)
- **Language** — Auto-detect or lock to a specific language
- **Retranscribe** — Re-run transcription with the current model
- **UI sounds** — Toggle interface sound effects

## Building a Portable Windows Executable

For a portable Windows build (no Python install required), use **PyInstaller**. To include only project dependencies (smaller exe, avoids DLL issues), use the build script:

```powershell
.\build.ps1
```

This creates a clean virtual environment, installs only `pywebview` and `faster-whisper`, then builds. The exe is at `dist/HoloVox.exe`.

**Manual build** (uses your current Python env; may pull in extra packages):

```powershell
pip install pyinstaller
pyinstaller HoloVox.spec
```

Copy the exe anywhere to run. On first launch, a `HoloVox_data` folder is created next to the exe for settings, cache, and Whisper models.

**Note:** py2exe is not recommended due to RecursionError with faster-whisper's dependency tree.

## Project Structure

```
HoloVox/
├── app.py                 # Entry point, HTTP server, pywebview shell
├── transcriber.py         # Whisper engine, caching, background threads
├── requirements.txt
├── README.md
└── ui/
    ├── index.html         # Main interface
    ├── css/styles.css     # Console styling
    ├── js/
    │   ├── app.js         # Core controller & audio bridge
    │   ├── boot.js        # Startup sequence
    │   ├── visualizer.js  # Audio graph & volume
    │   ├── knob.js        # Draggable knob controls
    │   ├── transcription.js
    │   ├── library.js
    │   └── sounds.js
    └── fonts/
        ├── aurebesh.woff   # Decorative display font
        └── aurebesh.woff2
```

---

<p align="center">
  <code>HoloVox — local playback, local transcription</code>
</p>
