import time
import base64
import io
import logging
import threading
from PIL import ImageGrab
from PIL import Image
from config import get_config
from api.client import get_api

logger = logging.getLogger("agent.screenshot")


class ScreenshotCapture:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._running = False
        self._thread = None

    def _capture_loop(self):
        interval = self.config.get("screenshot_interval", 30)
        while self._running:
            try:
                self._take_screenshot()
            except Exception as e:
                logger.error(f"Screenshot capture error: {e}")
            time.sleep(interval)

    def _take_screenshot(self):
        try:
            from trackers.activity import get_foreground_window_info
            process_name, window_title, _ = get_foreground_window_info()

            screenshot = ImageGrab.grab()
            max_width = self.config.get("screenshot_max_width", 1920)
            if screenshot.width > max_width:
                ratio = max_width / screenshot.width
                new_height = int(screenshot.height * ratio)
                screenshot = screenshot.resize((max_width, new_height), Image.LANCZOS)

            quality = self.config.get("screenshot_quality", 60)
            buffer = io.BytesIO()
            screenshot.save(buffer, format="JPEG", quality=quality, optimize=True)
            image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

            width, height = screenshot.size

            result = self.api.upload_screenshot(
                image_base64=image_base64,
                app_package=process_name or "unknown",
                app_name=window_title or process_name or "unknown",
                width=width,
                height=height,
            )

            if result:
                logger.debug(f"Screenshot sent: {width}x{height}")
            else:
                from storage.offline import get_storage
                storage = get_storage()
                storage.buffer_screenshot({
                    "image_base64": image_base64,
                    "app_package": process_name or "unknown",
                    "app_name": window_title or process_name or "unknown",
                    "width": width,
                    "height": height,
                })

        except Exception as e:
            logger.error(f"Screenshot error: {e}")

    def capture_now(self):
        self._take_screenshot()

    def start(self):
        if self._running:
            return
        if not self.config.get("screenshot_enabled", True):
            logger.info("Screenshot capture disabled")
            return
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info("Screenshot capture started")

    def stop(self):
        self._running = False
        logger.info("Screenshot capture stopped")
