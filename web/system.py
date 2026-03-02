import ujson as json
import machine
import os
import sys
import gc
from .nanowebapi import HttpError
from .webserver import read_json, CREDENTIALS
import uasyncio as asyncio

class SystemApi():
    def __init__(self, name, web):
        web.web_services.append(self.__class__.__name__)
        self.web = web
        self.web.app.route('/api/system/info')(self.api_sys_info)
        self.web.app.route('/api/system/config')(self.api_config) # Новый единый маршрут настроек
        self.web.app.route('/api/system/settime')(self.api_set_time)
        self.web.app.route('/api/system/setauth')(self.api_set_auth)
        self.web.app.route('/api/system/reboot')(self.api_reboot)
        self.web.app.route('/api/system/factory_reset')(self.api_factory_reset)

    async def api_sys_info(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)
        gc.collect()

        data = {
            "platform": "Unknown", "python_version": "Unknown", "release": "Unknown",
            "version": "Unknown", "machine": "Unknown", "cpu_freq_mhz": 0,
            "unique_id": "Unknown", "ram_alloc_kb": 0, "ram_free_kb": 0,
            "rom_total_kb": 0, "rom_free_kb": 0
        }

        try: data["platform"] = sys.platform
        except: pass

        try: data["python_version"] = sys.version.split(' ')[0]
        except: pass

        try:
            u = os.uname()
            data["release"] = u[2] if len(u)>2 else "unk"
            data["version"] = u[3] if len(u)>3 else "unk"
            data["machine"] = u[4] if len(u)>4 else "unk"
        except: pass

        try: data["cpu_freq_mhz"] = machine.freq() // 1000000
        except: pass

        try: data["unique_id"] = "".join(["{:02x}".format(b) for b in machine.unique_id()])
        except: pass

        try:
            ffd = os.statvfs('/')
            data["rom_total_kb"] = (ffd[0] * ffd[2]) // 1024
            data["rom_free_kb"] = (ffd[1] * ffd[3]) // 1024
        except: pass

        data["ram_alloc_kb"] = gc.mem_alloc() // 1024
        data["ram_free_kb"] = gc.mem_free() // 1024

        await self.web.api_send_response(request, data=data)

    async def api_config(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)

        if request.method == "GET":
            conf = {"name": self.web.name, "timezone": 3}
            try:
                with open('system.json', 'r') as f:
                    saved = json.load(f)
                    conf["name"] = saved.get("name", self.web.name)
                    conf["timezone"] = saved.get("timezone", 3)
            except OSError: pass
            await self.web.api_send_response(request, data=conf)

        elif request.method == "POST":
            data = await read_json(request)
            if data:
                conf = {}
                try:
                    with open('system.json', 'r') as f: conf = json.load(f)
                except OSError: pass

                if "name" in data: conf['name'] = data['name']
                if "timezone" in data: conf['timezone'] = int(data['timezone'])

                with open('system.json', 'w') as f: json.dump(conf, f)
                self.web.name = conf.get('name', self.web.name)
                await self.web.api_send_response(request, data={"status": "ok"})
            else:
                raise HttpError(request, 400, "Bad Request")

    async def api_set_auth(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)
        data = await read_json(request)
        if data and "login" in data and "password" in data:
            conf = {}
            try:
                with open('system.json', 'r') as f: conf = json.load(f)
            except OSError: pass
            conf['login'] = data['login']
            conf['password'] = data['password']
            with open('system.json', 'w') as f: json.dump(conf, f)
            CREDENTIALS[0] = data['login']
            CREDENTIALS[1] = data['password']
            await self.web.api_send_response(request, data={"status": "ok"})
        else: raise HttpError(request, 400, "Bad Request")

    async def api_set_time(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)
        data = await read_json(request)
        if data:
            rtc = machine.RTC()
            rtc.datetime((data.get('year', 2020), data.get('month', 1), data.get('day', 1), 0, data.get('hour', 0), data.get('minute', 0), data.get('second', 0), 0))
            await self.web.api_send_response(request, data={"status": "ok"})
        else: raise HttpError(request, 400, "Bad Request")

    async def api_reboot(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)
        await self.web.api_send_response(request, data={"status": "rebooting"})
        async def do_reset():
            await asyncio.sleep(1)
            machine.reset()
        asyncio.create_task(do_reset())

    async def api_factory_reset(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)
        try: os.remove('wifi.json')
        except OSError: pass
        await self.web.api_send_response(request, data={"status": "resetting"})
        async def do_reset():
            await asyncio.sleep(1)
            machine.reset()
        asyncio.create_task(do_reset())