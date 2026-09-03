import time
import logging
import threading
import psutil
from config import get_config
from api.client import get_api
from trackers.activity import ActivityTracker
from trackers.screenshot import ScreenshotCapture
from trackers.audio import AudioRecorder
from trackers.location import LocationTracker
from trackers.blocked import BlockedAppsDetector
from commands.handler import CommandHandler
from storage.offline import get_storage

logger = logging.getLogger("agent")


class MonitoringAgent:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self.storage = get_storage()

        self.activity_tracker = ActivityTracker()
        self.screenshot_capture = ScreenshotCapture()
        self.audio_recorder = AudioRecorder()
        self.location_tracker = LocationTracker()
        self.blocked_detector = BlockedAppsDetector()
        self.command_handler = CommandHandler()

        self._sync_thread = None
        self._running = False
        self._battery_alert_sent = False

        self._setup_command_handlers()

    def _setup_command_handlers(self):
        self.command_handler.register_handler("capture_screenshot", self._cmd_capture_screenshot)
        self.command_handler.register_handler("record_audio", self._cmd_record_audio)
        self.command_handler.register_handler("track_location", self._cmd_track_location)

    def _cmd_capture_screenshot(self, data):
        logger.info("Remote command: capture screenshot")
        self.screenshot_capture.capture_now()

    def _cmd_record_audio(self, data):
        duration = data.get("duration", self.config.get("audio_duration", 10))
        logger.info(f"Remote command: record audio for {duration}s")
        threading.Thread(
            target=self.audio_recorder.record,
            args=(duration,),
            daemon=True
        ).start()

    def _cmd_track_location(self, data):
        logger.info("Remote command: track location")
        if not self.location_tracker._running:
            self.location_tracker.start()

    def _sync_loop(self):
        interval = self.config.get("sync_interval", 60)
        while self._running:
            try:
                self.storage.sync_all()
            except Exception as e:
                logger.error(f"Sync error: {e}")
            time.sleep(interval)

    def _battery_monitor_loop(self):
        while self._running:
            try:
                battery = psutil.sensors_battery()
                if battery:
                    if battery.percent <= 4 and not battery.power_plugged:
                        if not self._battery_alert_sent:
                            self.api.upload_alert(
                                alert_type="device_offline",
                                severity="high",
                                title="Low Battery Warning",
                                message=f"Battery at {battery.percent}%. Device may go offline soon."
                            )
                            self._battery_alert_sent = True
                    else:
                        self._battery_alert_sent = False
            except Exception:
                pass
            time.sleep(15)

    def _blocked_apps_monitor(self):
        last_app = None
        while self._running:
            try:
                from trackers.activity import get_foreground_window_info
                process_name, _, _ = get_foreground_window_info()
                if process_name and process_name != last_app:
                    self.blocked_detector.check(process_name)
                    last_app = process_name
            except Exception:
                pass
            time.sleep(2)

    def start(self):
        if self._running:
            return

        logger.info("Starting Employee Monitor Agent...")
        logger.info(f"Server: {self.config.server_url}")
        logger.info(f"Device ID: {self.config.device_id}")

        emp_id = self.api.ensure_registered()
        if not emp_id:
            logger.warning("Not registered. Will retry during operation.")
        else:
            logger.info(f"Employee ID: {emp_id}")

        self._running = True

        self.activity_tracker.start()
        self.screenshot_capture.start()
        self.location_tracker.start()
        self.command_handler.start()

        self._sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self._sync_thread.start()

        self._battery_thread = threading.Thread(target=self._battery_monitor_loop, daemon=True)
        self._battery_thread.start()

        self._blocked_thread = threading.Thread(target=self._blocked_apps_monitor, daemon=True)
        self._blocked_thread.start()

        logger.info("All monitors started successfully")

    def stop(self):
        logger.info("Stopping Employee Monitor Agent...")
        self._running = False

        self.activity_tracker.stop()
        self.screenshot_capture.stop()
        self.location_tracker.stop()
        self.command_handler.stop()

        self.storage.sync_all()
        logger.info("Agent stopped")

    def get_status(self):
        return {
            "running": self._running,
            "employee_id": self.config.employee_id,
            "device_id": self.config.device_id,
            "server_url": self.config.server_url,
            "pending_sync": self.storage.get_stats(),
        }
