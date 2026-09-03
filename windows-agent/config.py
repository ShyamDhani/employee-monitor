import os
import json
import uuid
import platform
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

CONFIG_FILE = DATA_DIR / "config.json"
OFFLINE_DB = DATA_DIR / "offline.db"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
AUDIO_DIR = DATA_DIR / "audio"
RECORDINGS_DIR = DATA_DIR / "recordings"

SCREENSHOTS_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)
RECORDINGS_DIR.mkdir(exist_ok=True)

DEFAULT_CONFIG = {
    "server_url": "http://localhost:3000",
    "employee_id": "",
    "employee_name": "",
    "device_id": "",
    "screenshot_interval": 30,
    "activity_interval": 3,
    "command_poll_interval": 5,
    "location_interval": 30,
    "sync_interval": 60,
    "screenshot_quality": 60,
    "screenshot_max_width": 1920,
    "audio_sample_rate": 16000,
    "audio_channels": 1,
    "audio_duration": 10,
    "blocked_apps": [
        "facebook.exe", "instagram.exe", "tiktok.exe", "twitter.exe",
        "snapchat.exe", "reddit.exe", "discord.exe", "telegram.exe",
        "netflix.exe", "spotify.exe", "youtube.exe", "twitch.exe",
        "steam.exe", "epicgameslauncher.exe", "battle.net.exe",
        "chrome.exe", "firefox.exe", "msedge.exe",
        "vlc.exe", "foobar2000.exe", "winamp.exe",
        "utorrent.exe", "bittorrent.exe", "qbittorrent.exe"
    ],
    "screenshot_enabled": True,
    "activity_enabled": True,
    "audio_enabled": True,
    "location_enabled": True,
    "blocked_apps_enabled": True,
}

_instance = None


class Config:
    def __init__(self):
        self._data = {}
        self._load()

    def _load(self):
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "r") as f:
                self._data = json.load(f)
        else:
            self._data = DEFAULT_CONFIG.copy()
            self._data["device_id"] = self._generate_device_id()
            self._save()

        for key, value in DEFAULT_CONFIG.items():
            if key not in self._data:
                self._data[key] = value

    def _generate_device_id(self):
        mac = uuid.getnode()
        return f"win-{mac:012x}"

    def _save(self):
        with open(CONFIG_FILE, "w") as f:
            json.dump(self._data, f, indent=2)

    def get(self, key, default=None):
        return self._data.get(key, default)

    def set(self, key, value):
        self._data[key] = value
        self._save()

    def update(self, data):
        self._data.update(data)
        self._save()

    @property
    def server_url(self):
        return self._data["server_url"].rstrip("/")

    @property
    def employee_id(self):
        return self._data.get("employee_id", "")

    @property
    def device_id(self):
        return self._data.get("device_id", "")

    @property
    def device_info(self):
        return {
            "os": platform.system(),
            "os_version": platform.version(),
            "hostname": platform.node(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        }


def get_config():
    global _instance
    if _instance is None:
        _instance = Config()
    return _instance
