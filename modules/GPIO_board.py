import uasyncio as asyncio
from lib.kernel import Service
import time
from machine import Pin


class GPIO_board(Service):
    AW_LEN = 1

    def __init__(self, pins: list, **kwargs):  ## pin(n, mode, pull, name)
        super().__init__(**kwargs)
        self.pins = {}
        self.state = {'time': None, "name": kwargs.get('name') or self.name,
                      "label": kwargs.get('label') or "Управление оборудованием", "type": "web_standard", "data": []}
        if kwargs.get('group'):
            self.state['group'] = kwargs.get('group')

        for p in pins:
            # Инициализируем пин, используя первые два параметра из списка
            p_ = Pin(p[0], p[1])
            self.pins[p[0]] = p_

            # ОПРЕДЕЛЯЕМ ИМЯ: берем 3-й элемент из списка p[2], если он есть
            friendly_name = p[2] if len(p) > 2 else "GPIO-" + str(p[0])

            el_ = {
                "id": p[0],
                "value": p_.value(),
                "name": friendly_name  # Используем осмысленное имя
            }
            el_["indicator"] = "digital"

            if Pin.OUT == p[1]:
                el_["control"] = "digital"

            self.state['data'].append(el_)

    def set_value(self, id, value):
        for i in self.state['data']:
            if i['id'] == id and i.get("control"):
                self.pins[id].value(1 if value else 0)
                if i['value'] != self.pins[id].value():
                    i['value'] = self.pins[id].value()
                    self.state['time'] = time.time()
                    asyncio.create_task(self.subscribe_handler())
                    break

    async def tic(self):
        tt = time.time()
        changed = False
        for i in self.state['data']:
            if i["id"] in self.pins.keys() and i['value'] != self.pins[i["id"]].value():
                i['value'] = self.pins[i["id"]].value()
                self.state['time'] = tt
                changed = True
        return changed