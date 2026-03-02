import machine
import uasyncio as asyncio
import os
import time
from lib.kernel import Service
import network


class HardResetButton(Service):
    def __init__(self, name="HardReset", pin_num=None):
        super().__init__(name)

        # Автоопределение платы, если пин не задан жестко
        if pin_num is None:
            board_info = os.uname().machine.lower()
            if "c3" in board_info:
                pin_num = 9  # Кнопка BOOT на ESP32-C3
            else:
                pin_num = 0  # Кнопка BOOT на ESP32 WROOM / S3

        print(f"[{name}] Оборудование: {os.uname().machine}. Пин сброса: {pin_num}")
        self.btn = machine.Pin(pin_num, machine.Pin.IN, machine.Pin.PULL_UP)

    async def run(self):
        hold_count = 0
        check_interval = 0.5
        ap_triggered = False

        while True:
            if self.btn.value() == 0:
                hold_count += 1

                # 2 секунды (4 тика) -> Включаем AP
                if hold_count >= 4 and not ap_triggered:
                    print("\n[!] Кнопка зажата 2с: Принудительное включение Точки Доступа [!]")
                    network.WLAN(network.AP_IF).active(True)
                    ap_triggered = True

                # 10 секунд (20 тиков) -> Factory Reset
                if hold_count >= 20:
                    print("\n[!] АППАРАТНЫЙ СБРОС НАСТРОЕК (10с) ЗАПУЩЕН [!]")
                    self.do_factory_reset()
                    await asyncio.sleep(60)
            else:
                hold_count = 0
                ap_triggered = False

            await asyncio.sleep(check_interval)

    def do_factory_reset(self):
        for file in ['wifi.json', 'system.json']:
            try:
                os.remove(file)
                print(f"Удален файл: {file}")
            except OSError:
                pass
        print("Перезагрузка через 2 секунды...")
        time.sleep(2)
        machine.reset()