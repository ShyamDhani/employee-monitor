import time
import io
import logging
import wave
import struct
import numpy as np
from config import get_config
from api.client import get_api

logger = logging.getLogger("agent.audio")


class AudioRecorder:
    def __init__(self):
        self.config = get_config()
        self.api = get_api()
        self._recording = False

    def record(self, duration_seconds=None):
        if duration_seconds is None:
            duration_seconds = self.config.get("audio_duration", 10)

        sample_rate = self.config.get("audio_sample_rate", 16000)
        channels = self.config.get("audio_channels", 1)

        logger.info(f"Recording audio for {duration_seconds}s at {sample_rate}Hz")

        try:
            import sounddevice as sd
            import soundfile as sf

            audio_data = sd.rec(
                int(duration_seconds * sample_rate),
                samplerate=sample_rate,
                channels=channels,
                dtype="int16"
            )
            sd.wait()

            buffer = io.BytesIO()
            sf.write(buffer, audio_data, sample_rate, format="WAV")
            buffer.seek(0)
            audio_bytes = buffer.read()

            result = self.api.upload_audio(
                audio_data=audio_bytes,
                duration_ms=int(duration_seconds * 1000),
                sample_rate=sample_rate,
            )

            if result:
                logger.info("Audio recording uploaded")
            else:
                from storage.offline import get_storage
                storage = get_storage()
                storage.buffer_audio({
                    "duration_ms": int(duration_seconds * 1000),
                    "sample_rate": sample_rate,
                    "data_length": len(audio_bytes),
                })

        except ImportError:
            logger.warning("sounddevice/soundfile not installed, using fallback")
            self._record_fallback(duration_seconds, sample_rate, channels)
        except Exception as e:
            logger.error(f"Audio recording error: {e}")

    def _record_fallback(self, duration_seconds, sample_rate, channels):
        try:
            import sounddevice as sd

            audio_data = sd.rec(
                int(duration_seconds * sample_rate),
                samplerate=sample_rate,
                channels=channels,
                dtype="int16"
            )
            sd.wait()

            buffer = io.BytesIO()
            with wave.open(buffer, "wb") as wf:
                wf.setnchannels(channels)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(audio_data.tobytes())
            buffer.seek(0)
            audio_bytes = buffer.read()

            result = self.api.upload_audio(
                audio_data=audio_bytes,
                duration_ms=int(duration_seconds * 1000),
                sample_rate=sample_rate,
            )

            if result:
                logger.info("Audio recording uploaded (fallback)")

        except Exception as e:
            logger.error(f"Audio fallback error: {e}")

    def start(self):
        if not self.config.get("audio_enabled", True):
            return
        logger.info("Audio recorder ready")

    def stop(self):
        self._recording = False
