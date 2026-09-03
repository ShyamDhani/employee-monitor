import time
import logging
import threading
from config import get_config
from api.client import get_api

logger = logging.getLogger("agent.commands")


class CommandHandler:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._running = False
        self._thread = None
        self._handlers = {}

    def register_handler(self, command_name, handler):
        self._handlers[command_name] = handler

    def _poll_loop(self):
        interval = self.config.get("command_poll_interval", 5)
        while self._running:
            try:
                commands = self.api.poll_commands()
                for cmd in commands:
                    self._handle_command(cmd)
            except Exception as e:
                logger.error(f"Command poll error: {e}")
            time.sleep(interval)

    def _handle_command(self, cmd):
        command = cmd.get("command", "")
        data = cmd.get("data", {})

        logger.info(f"Received command: {command}")

        if command in self._handlers:
            try:
                self._handlers[command](data)
            except Exception as e:
                logger.error(f"Command handler error for {command}: {e}")
        else:
            logger.warning(f"Unknown command: {command}")

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()
        logger.info("Command handler started")

    def stop(self):
        self._running = False
        logger.info("Command handler stopped")
