import time
import logging
import threading
from config import get_config
from api.client import get_api

logger = logging.getLogger("agent.location")


class LocationTracker:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._running = False
        self._thread = None
        self._last_lat = None
        self._last_lon = None

    def _track_loop(self):
        interval = self.config.get("location_interval", 30)
        while self._running:
            try:
                self._get_and_send_location()
            except Exception as e:
                logger.error(f"Location tracking error: {e}")
            time.sleep(interval)

    def _get_and_send_location(self):
        try:
            import geocoder
            g = geocoder.ip("me")

            if g.ok:
                lat = g.lat
                lon = g.lng
                accuracy = getattr(g, "accuracy", 0) or 0

                if lat and lon:
                    if (lat == self._last_lat and lon == self._last_lon):
                        return

                    self._last_lat = lat
                    self._last_lon = lon

                    result = self.api.upload_location(
                        latitude=lat,
                        longitude=lon,
                        accuracy=accuracy,
                    )

                    if result:
                        logger.debug(f"Location sent: {lat}, {lon}")
                    else:
                        from storage.offline import get_storage
                        storage = get_storage()
                        storage.buffer_location({
                            "latitude": lat,
                            "longitude": lon,
                            "accuracy": accuracy,
                        })
            else:
                logger.warning("Could not get location from IP")

        except ImportError:
            logger.warning("geocoder not installed, skipping location")
        except Exception as e:
            logger.error(f"Location error: {e}")

    def start(self):
        if self._running:
            return
        if not self.config.get("location_enabled", True):
            logger.info("Location tracking disabled")
            return
        self._running = True
        self._thread = threading.Thread(target=self._track_loop, daemon=True)
        self._thread.start()
        logger.info("Location tracker started")

    def stop(self):
        self._running = False
        logger.info("Location tracker stopped")
