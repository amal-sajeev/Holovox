# Distributing HoloVox on Windows

Making HoloVox portable or distributable often triggers antivirus or Windows SmartScreen when using PyInstaller. Below are practical options, from least to most likely to be flagged.

---

## Option 1: Portable folder (recommended — avoids exe packing)

No single packed executable: you ship a folder with Python embedded and your code. Antivirus rarely flags this because the only `.exe` is the official Python interpreter.

### Steps

1. **Download the Windows embeddable package**
   - Go to [python.org/downloads](https://www.python.org/downloads/) and get the **Windows embeddable package (64-bit)** for the same Python version you develop with (e.g. 3.11 or 3.12).
   - Or direct: `https://www.python.org/ftp/python/3.12.x/python-3.12.x-embed-amd64.zip`.

2. **Create the portable layout**
   ```
   HoloVoxPortable/
   ├── python.exe          # from the embed zip
   ├── python312.dll       # (version in name)
   ├── python312._pth      # edit as below
   ├── run.bat             # launcher
   ├── app.py              # your app
   ├── transcriber.py
   ├── requirements.txt
   ├── ui/
   │   ├── index.html
   │   ├── css/
   │   ├── js/
   │   └── fonts/
   └── Assets/
   ```

3. **Unzip the embeddable package** into `HoloVoxPortable/`.

4. **Edit `pythonXXX._pth`** (e.g. `python312._pth`) in a text editor:
   - Uncomment or add a line: `import site`
   - Ensure the file lists your base directory (e.g. a line with `.` or the folder name) so that `app.py` and packages are found.

   Example contents:
   ```
   python312.zip
   .
   import site
   ```

5. **Install dependencies into this Python**
   - Open a command prompt in `HoloVoxPortable/`.
   - Install pip (embed doesn’t include it by default):
     - Download [get-pip.py](https://bootstrap.pypa.io/get-pip.py), then run:
       `.\python.exe get-pip.py`
   - Install app dependencies:
     `.\python.exe -m pip install -r requirements.txt`

6. **Add `run.bat`** in `HoloVoxPortable/`:
   ```batch
   @echo off
   cd /d "%~dp0"
   start "" pythonw.exe app.py
   ```
   Use `pythonw.exe` so no console window appears (copy it from a full Python install if the embed zip doesn’t include it; or use `python.exe` if you prefer a visible console for errors).

   If the embed package doesn’t include `pythonw.exe`, you can use `python.exe` and add to the batch:
   ```batch
   @echo off
   cd /d "%~dp0"
   python.exe app.py
   pause
   ```
   Or create a shortcut that runs `pythonw.exe app.py` with “Start in” set to the folder.

7. **Zip the folder** and distribute `HoloVoxPortable.zip`.  
   Users: unzip anywhere and run `run.bat`.

**Pros:** No packed exe, minimal AV/SmartScreen issues; portable (e.g. USB).  
**Cons:** Larger than a single exe; requires including the embed Python (~25–50 MB).

---

## Option 2: Nuitka (portable Windows app, recommended for single exe)

[Nuitka](https://nuitka.net/) compiles Python to C and produces a native executable. HoloVox is set up for **portable** behavior when run frozen: all persistent data lives next to the exe so you can move the folder or run from USB without leaving data in `%USERPROFILE%`.

### Portable data when frozen

When you run the Nuitka-built executable (e.g. `D:\HoloVox\HoloVox.exe`):

| Data | Location |
|------|----------|
| Settings / bookmarks | `HoloVox_data/settings.json`, `bookmarks.json` (next to the exe) |
| Transcript cache | `HoloVox_data/cache/*.json` |
| Whisper models | `HoloVox_data/hub/` (Hugging Face cache) |

Only the **base** Whisper model (~150 MB) is bundled so the app works out of the box with no first-run download. Additional models (small, medium, large, etc.) can be downloaded from the app when needed and are stored in the same portable `HoloVox_data/hub` folder.

### Build requirements

- **C compiler**: MSVC or MinGW (Nuitka will prompt to download if missing).
- **Nuitka**: `pip install nuitka`
- **pywebview**: use Nuitka’s plugin: `--enable-plugin=pywebview`

### Build steps

1. **Pre-download the base model** (optional but recommended so the app runs without network on first launch):

   From the repo root:

   ```bash
   python scripts/download_base_model.py
   ```

   This creates `staging/HoloVox_data/hub/` with the faster-whisper base model. The Nuitka command below includes this folder so the built app has the base model bundled.

2. **Build with Nuitka** (standalone directory — recommended for portable):

   ```bash
   pip install nuitka
   nuitka --standalone --assume-yes-for-downloads --output-dir=dist --output-filename=HoloVox.exe --include-data-dir=ui=ui --include-data-dir=Assets=Assets --windows-disable-console --enable-plugin=pywebview app.py
   ```

   If you ran the base-model script and want to bundle it:

   ```bash
   nuitka --standalone --assume-yes-for-downloads --output-dir=dist --output-filename=HoloVox.exe --include-data-dir=ui=ui --include-data-dir=Assets=Assets --include-data-dir=./staging/HoloVox_data=HoloVox_data --windows-disable-console --enable-plugin=pywebview app.py
   ```

   Result: `dist/app.dist/` contains `HoloVox.exe`, `ui/`, `Assets/`, and (if included) `HoloVox_data/hub/`. Ship that whole folder; the user runs `HoloVox.exe` from it and `HoloVox_data` (settings, cache, extra models) is created or extended there.

3. **Onefile build** (single exe; config/cache/models still go next to the exe):

   Add `--onefile`:

   ```bash
   nuitka --standalone --onefile --assume-yes-for-downloads --output-dir=dist --output-filename=HoloVox.exe --include-data-dir=ui=ui --include-data-dir=Assets=Assets --windows-disable-console --enable-plugin=pywebview app.py
   ```

   With base model bundle (run `python scripts/download_base_model.py` first):

   ```bash
   nuitka --standalone --onefile --assume-yes-for-downloads --output-dir=dist --output-filename=HoloVox.exe --include-data-dir=ui=ui --include-data-dir=Assets=Assets --include-data-dir=./staging/HoloVox_data=HoloVox_data --windows-disable-console --enable-plugin=pywebview app.py
   ```

**Pros:** Portable folder or single exe; no Python on target; data stays next to the exe.  
**Cons:** Build is slower; some AV may flag until the binary is signed or has reputation.

---

## Option 3: PyInstaller with mitigations

If you still use PyInstaller:

- Prefer **`--onedir`** over `--onefile` (one folder + exe often triggers fewer heuristics than one big packed exe).
- Add **version info** and a **manifest** so the exe looks like a normal app:
  ```bash
  pyinstaller --onedir --windowed --name HoloVox --add-data "ui;ui" --add-data "Assets;Assets" --version-file version_info.txt app.py
  ```
- Build in a **clean VM or clean environment** to avoid pulling in unwanted files.
- **Sign the executable** (see Option 4); this is what actually reduces SmartScreen and many AV blocks.

Your `app.py` should resolve paths when frozen, for example:

```python
import sys
if getattr(sys, 'frozen', False):
    APP_DIR = Path(sys._MEIPASS)
else:
    APP_DIR = Path(__file__).parent
```

(For Nuitka you may use a different check; see Nuitka docs.)

---

## Option 4: Code signing (best for wide distribution)

Signing the executable (and installer if you have one) is what reliably reduces:

- Windows SmartScreen “unknown publisher” warnings  
- Many antivirus blocks on “unknown” executables  

**Steps:**

1. Get a **code signing certificate** (e.g. from Sectigo, DigiCert, SSL.com). Standard code signing is often ~$100–300/year; EV (Extended Validation) gets faster SmartScreen reputation.
2. Sign the exe (and installer) with `signtool.exe` (Windows SDK) or your build script.
3. Over time, signed builds gain reputation and trigger fewer prompts.

Without signing, any single-file or packed executable (PyInstaller, Nuitka, etc.) can still be flagged by some AV; signing doesn’t guarantee zero flags but greatly improves it.

---

## Summary

| Method              | AV/SmartScreen risk | Effort   | Result           |
|---------------------|---------------------|----------|------------------|
| Portable folder     | Low                 | Medium   | Folder + run.bat |
| Nuitka              | Medium              | Medium   | Single exe       |
| PyInstaller (onedir)| Medium–high         | Low      | Folder + exe     |
| PyInstaller + sign  | Lower               | Medium+  | Signed exe       |

For minimal virus alerts and a portable Windows app, **Option 1 (portable folder)** is the most reliable. For a single exe that you plan to distribute more widely, combine **Nuitka or PyInstaller with code signing (Option 4)**.
