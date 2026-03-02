import uasyncio as asyncio
from lib.kernel import Service
from machine import Pin

class PumpOnGPIO(Service):
    def __init__(self):
        super().__init__(self)

    def start(self, pin, duration):
        self.pin = Pin(pin, Pin.OUT)
        self.pin.value(1)
        asyncio.create_task(self.stop_in_duration(duration))

    async def stop_in_duration(self, dur):
        await asyncio.sleep(dur)
        self.pin.value(0)