from .nanowebapi import HttpError
from .webserver import read_json, CREDENTIALS, authenticate
from lib.kernel import Service
import uasyncio as asyncio
import network
import json
import time


class NetworkApi(Service):
    def __init__(self, name, web):
        super().__init__(name)
        self.web = web
        web.web_services.append(self.__class__.__name__)

        self.web.app.route('/api/network/status')(self.api_status)
        self.web.app.route('/api/network/scan')(self.api_scan)
        self.web.app.route('/api/network/save')(self.api_save)

    @authenticate(CREDENTIALS)
    async def api_status(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)

        sta = network.WLAN(network.STA_IF)
        ap = network.WLAN(network.AP_IF)

        curr_time = time.localtime()
        time_synced = curr_time[0] > 2022

        status = {
            "sta_connected": sta.isconnected(),
            "sta_ip": sta.ifconfig()[0] if sta.isconnected() else "0.0.0.0",
            "sta_rssi": 0,
            "ap_active": ap.active(),
            "ap_ip": ap.ifconfig()[0] if ap.active() else "0.0.0.0",
            "time_synced": time_synced,
            "current_time": "{:02}:{:02}:{:02}".format(curr_time[3], curr_time[4], curr_time[5])
        }

        if sta.isconnected():
            try:
                status["sta_rssi"] = sta.status('rssi')
            except:
                pass

        try:
            with open('wifi.json', 'r') as f:
                config = json.load(f)
            status['config'] = config
        except:
            status['config'] = {}

        await self.web.api_send_response(request, data=status)

    @authenticate(CREDENTIALS)
    async def api_scan(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)

        sta = network.WLAN(network.STA_IF)
        if not sta.active(): sta.active(True)

        try:
            nets = sta.scan()
            nets.sort(key=lambda x: x[3], reverse=True)
            results = []
            for n in nets:
                try:
                    ssid = n[0].decode('utf-8')
                    if ssid: results.append({"ssid": ssid, "rssi": n[3]})
                except:
                    pass
            await self.web.api_send_response(request, data=results)
        except Exception:
            raise HttpError(request, 500, "Scan failed")

    @authenticate(CREDENTIALS)
    async def api_save(self, request):
        if request.method == "OPTIONS": return await self.web.api_send_response(request)

        data = await read_json(request)

        # 1. Сначала сохраняем настройки в файл
        with open('wifi.json', 'w') as f:
            json.dump(data, f)

        # 2. СРАЗУ отправляем ответ браузеру, чтобы не было ошибки ECONNABORTED
        await self.web.api_send_response(request, data={"status": "trying_to_connect"})

        # 3. Создаем фоновую задачу для переподключения
        async def apply_settings():
            # Ждем 1 секунду, чтобы пакет с HTTP-ответом гарантированно улетел
            await asyncio.sleep(1)

            # Применяем настройки клиента (STA)
            if 'sta_ssid' in data and data['sta_ssid']:
                sta = network.WLAN(network.STA_IF)
                sta.active(True)
                sta.disconnect()
                await asyncio.sleep(0.5)

                # --- ЛОГИКА СТАТИЧЕСКОГО IP С ЗАЩИТОЙ ---
                if data.get('sta_static') and data.get('sta_ip'):
                    ip = data.get('sta_ip')
                    # Если поля пустые, подставляем дефолтные значения, иначе будет invalid static ip
                    mask = data.get('sta_mask') if data.get('sta_mask') else '255.255.255.0'
                    gw = data.get('sta_gw') if data.get('sta_gw') else ip
                    dns = data.get('sta_dns') if data.get('sta_dns') else '8.8.8.8'

                    try:
                        sta.ifconfig((ip, mask, gw, dns))
                    except Exception as e:
                        print("Ошибка установки Static IP:", e)
                        sta.ifconfig('dhcp')
                else:
                    # Сброс на DHCP
                    sta.ifconfig('dhcp')

                sta.connect(data['sta_ssid'], data.get('sta_pass', ''))

            # Применяем настройки Точки Доступа (AP)
            if 'ap_ssid' in data and data['ap_ssid']:
                ap = network.WLAN(network.AP_IF)
                ap.active(True)
                try:
                    if data.get('ap_pass') and len(data['ap_pass']) >= 8:
                        ap.config(essid=data['ap_ssid'], password=data['ap_pass'], authmode=3)
                    else:
                        ap.config(essid=data['ap_ssid'], authmode=0)
                except Exception:
                    pass

        # Запускаем нашу фоновую задачу
        asyncio.create_task(apply_settings())