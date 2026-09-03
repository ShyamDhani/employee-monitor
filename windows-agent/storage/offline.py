import json
import time
import logging
import sqlite3
import threading
from pathlib import Path
from datetime import datetime, timezone
from config import get_config, OFFLINE_DB
from api.client import get_api

logger = logging.getLogger("agent.storage")

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS pending_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at REAL NOT NULL
);
"""


class OfflineStorage:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._db_path = str(OFFLINE_DB)
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with self._lock:
            conn = sqlite3.connect(self._db_path)
            conn.executescript(CREATE_TABLES)
            conn.commit()
            conn.close()

    def _insert(self, table, data):
        with self._lock:
            conn = sqlite3.connect(self._db_path)
            conn.execute(
                f"INSERT INTO {table} (data, created_at) VALUES (?, ?)",
                (json.dumps(data), time.time())
            )
            conn.commit()
            conn.close()

    def _get_all(self, table):
        with self._lock:
            conn = sqlite3.connect(self._db_path)
            cursor = conn.execute(f"SELECT id, data FROM {table} ORDER BY created_at")
            rows = cursor.fetchall()
            conn.close()
            return [(row[0], json.loads(row[1])) for row in rows]

    def _delete(self, table, row_id):
        with self._lock:
            conn = sqlite3.connect(self._db_path)
            conn.execute(f"DELETE FROM {table} WHERE id = ?", (row_id,))
            conn.commit()
            conn.close()

    def _delete_old(self, table, max_age_hours=24):
        cutoff = time.time() - (max_age_hours * 3600)
        with self._lock:
            conn = sqlite3.connect(self._db_path)
            conn.execute(f"DELETE FROM {table} WHERE created_at < ?", (cutoff,))
            conn.commit()
            conn.close()

    def buffer_activity(self, data):
        self._insert("pending_activity", data)

    def buffer_screenshot(self, data):
        self._insert("pending_screenshots", data)

    def buffer_location(self, data):
        self._insert("pending_locations", data)

    def buffer_alert(self, data):
        self._insert("pending_alerts", data)

    def buffer_audio(self, data):
        self._insert("pending_audio", data)

    def sync_all(self):
        emp_id = self.config.employee_id
        if not emp_id:
            return

        self._sync_table("pending_activity", self._sync_activity)
        self._sync_table("pending_screenshots", self._sync_screenshot)
        self._sync_table("pending_locations", self._sync_location)
        self._sync_table("pending_alerts", self._sync_alert)

        for table in ["pending_activity", "pending_screenshots", "pending_locations", "pending_alerts", "pending_audio"]:
            self._delete_old(table, 24)

    def _sync_table(self, table, sync_func):
        rows = self._get_all(table)
        for row_id, data in rows:
            try:
                if sync_func(data):
                    self._delete(table, row_id)
            except Exception as e:
                logger.error(f"Sync error for {table}: {e}")

    def _sync_activity(self, data):
        result = self.api.upload_activity(
            app_package=data["app_package"],
            app_name=data["app_name"],
            duration_ms=data["duration_ms"],
            start_time=data["start_time"],
            end_time=data["end_time"],
        )
        return result is not None

    def _sync_screenshot(self, data):
        result = self.api.upload_screenshot(
            image_base64=data["image_base64"],
            app_package=data["app_package"],
            app_name=data["app_name"],
            width=data["width"],
            height=data["height"],
        )
        return result is not None

    def _sync_location(self, data):
        result = self.api.upload_location(
            latitude=data["latitude"],
            longitude=data["longitude"],
            accuracy=data.get("accuracy", 0),
        )
        return result is not None

    def _sync_alert(self, data):
        result = self.api.upload_alert(
            alert_type=data["type"],
            severity=data["severity"],
            title=data["title"],
            message=data["message"],
            app_package=data.get("app_package", ""),
            app_name=data.get("app_name", ""),
        )
        return result is not None

    def get_stats(self):
        stats = {}
        for table in ["pending_activity", "pending_screenshots", "pending_locations", "pending_alerts", "pending_audio"]:
            with self._lock:
                conn = sqlite3.connect(self._db_path)
                cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                conn.close()
                stats[table] = count
        return stats


_storage = None


def get_storage():
    global _storage
    if _storage is None:
        _storage = OfflineStorage()
    return _storage
