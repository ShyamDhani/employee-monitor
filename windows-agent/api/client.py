import logging
import time
import json
import threading
import requests
from datetime import datetime, timezone
from config import get_config

logger = logging.getLogger("agent.api")


class APIClient:
    def __init__(self):
        self.config = get_config()
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "EmployeeMonitor-Windows/1.0"
        })
        self._lock = threading.Lock()

    def _url(self, path):
        return f"{self.config.server_url}{path}"

    def _post(self, path, data=None, files=None):
        try:
            url = self._url(path)
            if files:
                resp = self.session.post(url, data=data, files=files, timeout=30)
            else:
                resp = self.session.post(url, json=data, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.ConnectionError:
            logger.warning(f"Connection failed: {path}")
            return None
        except requests.exceptions.Timeout:
            logger.warning(f"Request timed out: {path}")
            return None
        except Exception as e:
            logger.error(f"API POST error {path}: {e}")
            return None

    def _get(self, path):
        try:
            url = self._url(path)
            resp = self.session.get(url, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.ConnectionError:
            return None
        except Exception as e:
            logger.error(f"API GET error {path}: {e}")
            return None

    def register_device(self):
        device_id = self.config.device_id
        info = self.config.device_info
        data = {
            "device_id": device_id,
            "name": info["hostname"],
            "os": info["os"],
            "os_version": info["os_version"],
            "platform": "windows",
            "manufacturer": info["processor"] or "Unknown",
            "model": info["machine"],
        }
        result = self._post("/api/employees/register", data)
        if result and result.get("success"):
            emp_id = result.get("employee_id", "")
            if emp_id:
                self.config.set("employee_id", emp_id)
                self.config.set("employee_name", result.get("name", info["hostname"]))
                logger.info(f"Registered as employee: {emp_id}")
                return emp_id
        return None

    def ensure_registered(self):
        if not self.config.employee_id:
            return self.register_device()
        return self.config.employee_id

    def upload_activity(self, app_package, app_name, duration_ms, start_time, end_time):
        emp_id = self.config.employee_id
        if not emp_id:
            return None

        data = {
            "employee_id": emp_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "app_package": app_package,
            "app_name": app_name,
            "duration_ms": duration_ms,
            "start_time": start_time,
            "end_time": end_time,
            "battery_level": self._get_battery_level(),
        }
        return self._post("/api/activity/upload", data)

    def upload_screenshot(self, image_base64, app_package, app_name, width, height):
        emp_id = self.config.employee_id
        if not emp_id:
            return None

        data = {
            "employee_id": emp_id,
            "timestamp": int(time.time() * 1000),
            "image_base64": image_base64,
            "app_package": app_package,
            "app_name": app_name,
            "width": width,
            "height": height,
            "battery_level": self._get_battery_level(),
        }
        return self._post("/api/screenshot/upload", data)

    def upload_location(self, latitude, longitude, accuracy=0, altitude=0, speed=0, bearing=0):
        emp_id = self.config.employee_id
        if not emp_id:
            return None

        data = {
            "employee_id": emp_id,
            "timestamp": int(time.time() * 1000),
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": accuracy,
            "altitude": altitude,
            "speed": speed,
            "bearing": bearing,
        }
        return self._post("/api/location/upload", data)

    def upload_alert(self, alert_type, severity, title, message, app_package="", app_name=""):
        emp_id = self.config.employee_id
        if not emp_id:
            return None

        data = {
            "employee_id": emp_id,
            "timestamp": int(time.time() * 1000),
            "app_package": app_package,
            "app_name": app_name,
            "type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
        }
        return self._post("/api/alerts", data)

    def upload_audio(self, audio_data, duration_ms, sample_rate=16000):
        emp_id = self.config.employee_id
        if not emp_id:
            return None

        files = {
            "audio": ("recording.wav", audio_data, "audio/wav")
        }
        data = {
            "employee_id": emp_id,
            "timestamp": str(int(time.time() * 1000)),
            "sample_rate": str(sample_rate),
            "duration_ms": str(duration_ms),
        }
        return self._post("/api/audio/upload", data=data, files=files)

    def poll_commands(self):
        emp_id = self.config.employee_id
        if not emp_id:
            return []

        result = self._get(f"/api/settings/commands/{emp_id}")
        if result and result.get("success"):
            return result.get("commands", [])
        return []

    def _get_battery_level(self):
        try:
            import psutil
            battery = psutil.sensors_battery()
            if battery:
                return battery.percent
        except Exception:
            pass
        return 100


_api_client = None


def get_api():
    global _api_client
    if _api_client is None:
        _api_client = APIClient()
    return _api_client
