import time
import logging
import threading
import ctypes
import ctypes.wintypes
from datetime import datetime, timezone
from config import get_config
from api.client import get_api

logger = logging.getLogger("agent.activity")

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

GetForegroundWindow = user32.GetForegroundWindow
GetWindowTextW = user32.GetWindowTextW
GetWindowTextLengthW = user32.GetWindowTextLengthW
GetWindowThreadProcessId = user32.GetWindowThreadProcessId

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_VM_READ = 0x0010

try:
    from psutil import Process
except ImportError:
    Process = None


def get_foreground_window_info():
    try:
        hwnd = GetForegroundWindow()
        if not hwnd:
            return None, None, None

        length = GetWindowTextLengthW(hwnd)
        if length == 0:
            return None, None, None

        buf = ctypes.create_unicode_buffer(length + 1)
        GetWindowTextW(hwnd, buf, length + 1)
        window_title = buf.value

        pid = ctypes.wintypes.DWORD()
        GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        pid = pid.value

        process_name = "unknown"
        exe_path = ""
        if Process:
            try:
                p = Process(pid)
                process_name = p.name()
                exe_path = p.exe()
            except Exception:
                pass

        return process_name, window_title, exe_path
    except Exception as e:
        logger.error(f"Error getting foreground window: {e}")
        return None, None, None


class ActivityTracker:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._running = False
        self._thread = None
        self._current_app = None
        self._current_title = None
        self._start_time = None
        self._session_buffer = []
        self._buffer_lock = threading.Lock()

    def _track_loop(self):
        interval = self.config.get("activity_interval", 3)
        while self._running:
            try:
                process_name, window_title, exe_path = get_foreground_window_info()

                if process_name and process_name != "unknown":
                    now = time.time()
                    now_iso = datetime.now(timezone.utc).isoformat()

                    if process_name != self._current_app:
                        if self._current_app and self._start_time:
                            duration_ms = int((now - self._start_time) * 1000)
                            if duration_ms > 1000:
                                self._send_activity(
                                    self._current_app, self._current_title,
                                    duration_ms, self._start_time_iso, now_iso
                                )

                        self._current_app = process_name
                        self._current_title = window_title
                        self._start_time = now
                        self._start_time_iso = now_iso

            except Exception as e:
                logger.error(f"Activity tracking error: {e}")

            time.sleep(interval)

    def _send_activity(self, app_package, app_name, duration_ms, start_time, end_time):
        try:
            result = self.api.upload_activity(
                app_package=app_package,
                app_name=app_name or app_package,
                duration_ms=duration_ms,
                start_time=start_time,
                end_time=end_time,
            )
            if result:
                logger.debug(f"Activity sent: {app_package} {duration_ms}ms")
            else:
                self._buffer_activity(app_package, app_name, duration_ms, start_time, end_time)
        except Exception as e:
            logger.error(f"Failed to send activity: {e}")
            self._buffer_activity(app_package, app_name, duration_ms, start_time, end_time)

    def _buffer_activity(self, app_package, app_name, duration_ms, start_time, end_time):
        from storage.offline import get_storage
        storage = get_storage()
        storage.buffer_activity({
            "app_package": app_package,
            "app_name": app_name,
            "duration_ms": duration_ms,
            "start_time": start_time,
            "end_time": end_time,
        })

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._track_loop, daemon=True)
        self._thread.start()
        logger.info("Activity tracker started")

    def stop(self):
        self._running = False
        if self._current_app and self._start_time:
            now = time.time()
            duration_ms = int((now - self._start_time) * 1000)
            if duration_ms > 1000:
                now_iso = datetime.now(timezone.utc).isoformat()
                self._send_activity(
                    self._current_app, self._current_title,
                    duration_ms, self._start_time_iso, now_iso
                )
        logger.info("Activity tracker stopped")
