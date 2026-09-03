import logging
from config import get_config
from api.client import get_api

logger = logging.getLogger("agent.blocked")


class BlockedAppsDetector:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._alerted_apps = set()
        self._cooldown = 30

    def check(self, process_name):
        if not self.config.get("blocked_apps_enabled", True):
            return False

        blocked = self.config.get("blocked_apps", [])
        process_lower = process_name.lower()

        for blocked_app in blocked:
            if blocked_app.lower() == process_lower:
                if process_lower not in self._alerted_apps:
                    self._alerted_apps.add(process_lower)
                    self._send_alert(process_name)
                    self._reset_cooldown(process_lower)
                return True

        return False

    def _send_alert(self, process_name):
        try:
            result = self.api.upload_alert(
                alert_type="unauthorized_app",
                severity="high",
                title="Unprofessional App Detected",
                message=f"Employee opened {process_name} which is on the blocked list",
                app_package=process_name,
                app_name=process_name,
            )
            if result:
                logger.warning(f"Blocked app alert sent: {process_name}")
            else:
                from storage.offline import get_storage
                storage = get_storage()
                storage.buffer_alert({
                    "type": "unauthorized_app",
                    "severity": "high",
                    "title": "Unprofessional App Detected",
                    "message": f"Employee opened {process_name} which is on the blocked list",
                    "app_package": process_name,
                    "app_name": process_name,
                })
        except Exception as e:
            logger.error(f"Failed to send blocked app alert: {e}")

    def _reset_cooldown(self, process_name):
        import threading
        def remove():
            self._alerted_apps.discard(process_name)
        timer = threading.Timer(self._cooldown, remove)
        timer.daemon = True
        timer.start()

    def start(self):
        if not self.config.get("blocked_apps_enabled", True):
            return
        logger.info("Blocked apps detector ready")

    def stop(self):
        pass
