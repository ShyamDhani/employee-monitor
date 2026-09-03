import sys
import time
import signal
import logging
import argparse
from pathlib import Path

Path(__file__).parent.joinpath("data").mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "data" / "agent.log"),
    ]
)
logger = logging.getLogger("main")


def run_daemon():
    from agent import MonitoringAgent
    agent = MonitoringAgent()

    def shutdown(sig, frame):
        logger.info(f"Received signal {sig}, shutting down...")
        agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    agent.start()

    logger.info("Agent running. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        agent.stop()


def run_install():
    import subprocess
    import os

    logger.info("Installing Employee Monitor Agent...")

    python = sys.executable
    req_file = Path(__file__).parent / "requirements.txt"

    logger.info("Installing Python dependencies...")
    subprocess.check_call([python, "-m", "pip", "install", "-r", str(req_file), "--quiet"])

    logger.info("Creating startup entry...")
    try:
        startup_dir = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        if startup_dir.exists():
            bat_content = f'@echo off\nstart "" /min "{python}" "{Path(__file__).parent / "main.py"}" --run\n'
            bat_path = startup_dir / "EmployeeMonitor.bat"
            with open(bat_path, "w") as f:
                f.write(bat_content)
            logger.info(f"Startup entry created: {bat_path}")
    except Exception as e:
        logger.warning(f"Could not create startup entry: {e}")

    logger.info("Installation complete!")
    logger.info("Run: python main.py --run")


def run_service_install():
    try:
        import win32serviceutil
        import win32service
        import win32event

        class EmployeeMonitorService(win32serviceutil.ServiceFramework):
            _svc_name_ = "EmployeeMonitor"
            _svc_display_name_ = "Employee Monitor Agent"
            _svc_description_ = "Employee monitoring agent for activity tracking and screenshots"

            def __init__(self, args):
                win32serviceutil.ServiceFramework.__init__(self, args)
                self.stop_event = win32event.CreateEvent(None, 0, 0, None)
                self.agent = None

            def SvcStop(self):
                self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
                if self.agent:
                    self.agent.stop()
                win32event.SetEvent(self.stop_event)

            def SvcDoRun(self):
                from agent import MonitoringAgent
                self.agent = MonitoringAgent()
                self.agent.start()
                win32event.WaitForSingleObject(self.stop_event, win32event.INFINITE)

        if len(sys.argv) == 1:
            win32serviceutil.HandleCommandLine(EmployeeMonitorService)
        else:
            win32serviceutil.HandleCommandLine(EmployeeMonitorService)

    except ImportError:
        logger.error("pywin32 not installed. Run: pip install pywin32")
        logger.info("Then run: python main.py --service install")
        sys.exit(1)


def show_status():
    from agent import MonitoringAgent
    agent = MonitoringAgent()
    status = agent.get_status()

    print("\n=== Employee Monitor Agent Status ===")
    print(f"Running:        {status['running']}")
    print(f"Employee ID:    {status['employee_id'] or 'Not registered'}")
    print(f"Device ID:      {status['device_id']}")
    print(f"Server URL:     {status['server_url']}")
    print(f"\nPending Sync:")
    for table, count in status["pending_sync"].items():
        print(f"  {table}: {count} items")
    print("=====================================\n")


def show_config():
    from config import get_config
    config = get_config()

    print("\n=== Employee Monitor Agent Config ===")
    print(f"Server URL:             {config.server_url}")
    print(f"Employee ID:            {config.employee_id or 'Not registered'}")
    print(f"Device ID:              {config.device_id}")
    print(f"Screenshot Interval:    {config.get('screenshot_interval')}s")
    print(f"Activity Interval:      {config.get('activity_interval')}s")
    print(f"Command Poll Interval:  {config.get('command_poll_interval')}s")
    print(f"Location Interval:      {config.get('location_interval')}s")
    print(f"Sync Interval:          {config.get('sync_interval')}s")
    print(f"Screenshots Enabled:    {config.get('screenshot_enabled')}")
    print(f"Activity Enabled:       {config.get('activity_enabled')}")
    print(f"Audio Enabled:          {config.get('audio_enabled')}")
    print(f"Location Enabled:       {config.get('location_enabled')}")
    print(f"Blocked Apps Enabled:   {config.get('blocked_apps_enabled')}")
    print(f"Blocked Apps:           {len(config.get('blocked_apps', []))} apps")
    print("=====================================\n")


def main():
    parser = argparse.ArgumentParser(description="Employee Monitor Agent for Windows")
    parser.add_argument("--run", action="store_true", help="Run the monitoring agent")
    parser.add_argument("--install", action="store_true", help="Install dependencies and startup entry")
    parser.add_argument("--status", action="store_true", help="Show agent status")
    parser.add_argument("--config", action="store_true", help="Show current configuration")
    parser.add_argument("--service", nargs=1, metavar="ACTION", help="Windows service: install, start, stop, remove")
    parser.add_argument("--server", type=str, help="Set server URL")
    parser.add_argument("--set", nargs=2, metavar=("KEY", "VALUE"), help="Set config value")

    args = parser.parse_args()

    if args.install:
        run_install()
    elif args.run:
        run_daemon()
    elif args.service:
        action = args.service[0]
        if action == "install":
            run_service_install()
        elif action in ("start", "stop", "remove"):
            import win32serviceutil
            if action == "install":
                run_service_install()
            else:
                svc_name = "EmployeeMonitor"
                if action == "start":
                    win32serviceutil.StartService(svc_name)
                elif action == "stop":
                    win32serviceutil.StopService(svc_name)
                elif action == "remove":
                    win32serviceutil.RemoveService(svc_name)
        else:
            print(f"Unknown service action: {action}")
            print("Valid actions: install, start, stop, remove")
    elif args.status:
        show_status()
    elif args.config:
        show_config()
    elif args.server:
        from config import get_config
        config = get_config()
        config.set("server_url", args.server)
        print(f"Server URL set to: {args.server}")
    elif args.set:
        from config import get_config
        config = get_config()
        key, value = args.set
        try:
            value = int(value)
        except ValueError:
            try:
                value = float(value)
            except ValueError:
                if value.lower() in ("true", "yes"):
                    value = True
                elif value.lower() in ("false", "no"):
                    value = False
        config.set(key, value)
        print(f"Config set: {key} = {value}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
