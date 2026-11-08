#!/usr/bin/env python3
"""
ClassOverFlow Unified Development Server Launcher
Runs both the FastAPI backend and Vite frontend concurrently with clean shutdown.
"""

import os
import shutil
import signal
import subprocess
import sys
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
IS_WINDOWS = os.name == "nt"
VENV_BIN_DIR = os.path.join(ROOT_DIR, ".venv", "Scripts" if IS_WINDOWS else "bin")
VENV_PYTHON = os.path.join(VENV_BIN_DIR, "python.exe" if IS_WINDOWS else "python3")
UVICORN_BIN = os.path.join(VENV_BIN_DIR, "uvicorn.exe" if IS_WINDOWS else "uvicorn")
NPM_BIN = shutil.which("npm") or ("npm.cmd" if IS_WINDOWS else "npm")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

processes = []

def cleanup(sig=None, frame=None):
    print("\n[ClassOverFlow] Shutting down servers gracefully...")
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    print("[ClassOverFlow] All servers stopped.")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def main():
    print("=" * 60)
    print("🚀 Starting ClassOverFlow Full-Stack Environment")
    print("=" * 60)

    # 1. Start Backend (FastAPI via Uvicorn)
    backend_cmd = [
        UVICORN_BIN if os.path.exists(UVICORN_BIN) else "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--reload",
        "--reload-dir", "app",
    ]
    print("[Backend] Starting FastAPI on http://127.0.0.1:8000 ...")
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=ROOT_DIR,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    processes.append(backend_proc)

    # Allow backend 1 second to bind port
    time.sleep(1)

    # 2. Start Frontend (Vite)
    print("[Frontend] Starting Vite on http://localhost:5173 ...")
    frontend_proc = subprocess.Popen(
        [NPM_BIN, "run", "dev"],
        cwd=FRONTEND_DIR,
    )
    processes.append(frontend_proc)

    print("\n✅ Both servers are running:")
    print("   👉 Frontend (UI):      http://localhost:5173")
    print("   👉 Backend (FastAPI): http://127.0.0.1:8000")
    print("   👉 API Docs:          http://127.0.0.1:8000/docs\n")
    print("Press Ctrl+C to stop all servers.\n")

    while True:
        time.sleep(0.5)
        for proc in processes:
            if proc.poll() is not None:
                print(f"[ClassOverFlow] Process exited with code {proc.returncode}")
                cleanup()

if __name__ == "__main__":
    main()
