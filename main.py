import gc
import machine as m
from machine import reset
import ujson as json
import webrepl

from lib.kernel import os_kernel, Kernel, Service, load
from modules.net_manager import NetworkManager
from modules.GPIO_board import GPIO_board
from modules.cron import CronScheduler
from modules.hw_reset import HardResetButton

# --- ВЕБ-МОДУЛИ ---
from web.webserver import WebServer
from web.files import Files
from web.switches import SwitchesApi
from web.standard import StandardApi
from web.network import NetworkApi
from web.cron import CronApi
from web.system import SystemApi

webrepl.start()

net = None
cron = None
pins = None
sw = None

def init():
    global net, sw, cron, pins

    # 1. Загрузка имени системы
    try:
        with open('system.json', 'r') as f:
            system_config = json.load(f)
            system_name = system_config.get('name', 'MyDevice')
            tz_offset = system_config.get('timezone', 7)
    except (OSError, ValueError):
        system_name = 'MyDevice'
        tz_offset = 7

    # 2. Системные службы
    net = NetworkManager(name='NET_MANAGER', timezone_offset=tz_offset)
    os_kernel.add_task(net)

    # Пустая доска GPIO (позже прикрутим чтение из конфига)
    pins = GPIO_board([], name="GPIO_board", group=2)
    os_kernel.add_task(pins)

    cron = CronScheduler()
    os_kernel.add_task(cron)

    # Кнопка сброса (без указания пина — определит сама)
    hw_reset = HardResetButton(name="HW_Reset")
    os_kernel.add_task(hw_reset)

    # 3. Веб-сервер
    web = WebServer(name=system_name, kernel=os_kernel)
    os_kernel.add_task(web)

    # --- Инициализация Веб-API ---
    _ = CronApi(name="Web cron", web=web)
    _ = Files(name="Web file manager", web=web)
    _ = SwitchesApi(name="Web switches", web=web)
    _ = StandardApi(name="Web standard", web=web)
    _ = NetworkApi(name="Network API", web=web)
    _ = SystemApi(name="System API", web=web)

    # Запуск ядра
    os_kernel.start()


if __name__ == "__main__":
    init()
    print('System started.')
    print('Free RAM: ', gc.mem_free())