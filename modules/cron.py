import uasyncio as asyncio
from lib.kernel import Service
import random
import time
import json

from machine import Pin


class SchedTask():
    id = 0
    label = ''
    task = None
    schedule = "* * * * *"
    params = None
    enabled = False
    error = ''

    def __init__(self, enabled, schedule, id, params=None, label='', *args, **kwargs):
        self.id = id
        self.schedule = schedule
        self.label = label
        self.params = params
        self.enabled = enabled
        # self.__dict__.update(kwargs)


class CronScheduler(Service):
    state = {'time': None, "name": "cron_scheduler", "data": []}
    AW_LEN = 17
    task_list = []
    cmd_list = []

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.old_mm = None
        self.task_list = []
        self.reload()

    def reload(self):
        self.task_list = []
        try:
            with open('/crontab.json', 'r') as f:
                dd = json.loads(f.read())
                for t in dd:
                    self.task_list.append(SchedTask(*t))
            self.relink_task()
        except OSError as e:
            OSError('Error open file /crontab.json')
        self.relink_task()

    def check_data(self):
        dd = self.state['data']
        if len(dd) in range(1, 10):
            print('******')

    def check_tt(self, tt1, tt2):  # tt1- cron chank time,  tt2 - local time chank
        class T():
            str = 'str'
            range = 'range'
            list = 'list'

        if tt1 == '*':
            tt1 = None
            return True
        elif tt1.find('-') > 0:
            tt1 = tt1.split('-')
            if len(tt1) > 1:
                step = tt1[1].split('/')
                rng = range(int(tt1[0]), int(step[0]) + 1)
                if len(step) > 1 and step[1].isdigit():
                    return tt2 in rng and (tt2 - int(tt1[0])) % int(step[1]) == 0
                else:
                    return tt2 in rng  # <--- ИСПРАВЛЕНО: теперь диапазон работает корректно
        elif tt1.find(',') > 0:
            tt1 = tt1.split(',')
            tt1 = [int(i) for i in tt1]
            return tt2 in tt1
        elif tt1.find('/') >= 0:
            tt1 = tt1.split('/')
            if not tt1[0].isdigit(): tt1[0] = 0
            tt1 = (tt2 - int(tt1[0])) % int(tt1[1])
            return tt1 == 0
        elif tt1 == str(tt2):
            return True

    async def tic(self):
        yy, my, dd, hh, mm, _, dw, _, = time.localtime()

        if self.old_mm == mm or yy < 2022: return
        self.old_mm = mm

        for t in self.task_list:
            i2 = t.schedule.split()
            print(i2)
            try:
                if (t.enabled and t.task and self.check_tt(i2[0], mm) and
                        self.check_tt(i2[1], hh) and self.check_tt(i2[2], dw + 1) and
                        self.check_tt(i2[3], dd) and self.check_tt(i2[4], my)):
                    print(f"run_task: {hh}:{mm}", t.id, t.label, t.params)
                    if type(t.params) in (list, tuple, int,): t.task(*t.params)
                    if type(t.params) == dict: t.task(**t.params)
                    await asyncio.sleep(3)
            except Exception as e:
                print(f"run_task_error: {hh}:{mm}", t.id, t.label, t.params)
                t.error = "error"
                print(e)

    def append_command(self, id, task, label, params=None):
        self.cmd_list.append((task, id, label, params))
        self.relink_task()

    def relink_task(self):
        for task, id, label, params in self.cmd_list:
            tt = [i for i in self.task_list if i.id == id]
            for t in tt:
                t.task = task
                t.label = t.label or label
                t.params = t.params if type(t.params) in (int, list, dict,) else params

    async def set_value(self, json_array):
        dd = json.dumps(json_array)
        dd = dd.replace("], [", "],\r\n[")
        dd = dd.replace("[[", "[\r\n[")
        dd = dd.replace("]]", "]\r\n]")
        with open('/crontab.json', 'w') as f:
            f.write(dd)
        await asyncio.sleep(1)
        self.reload()

    def get_status(self):
        tasks = [(i.enabled, i.schedule, i.id, i.params, i.label,) for i in self.task_list]
        return tasks