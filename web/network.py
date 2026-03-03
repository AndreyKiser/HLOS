from .nanowebapi import HttpError
from .webserver import read_json, CREDENTIALS, authenticate
from lib.kernel import Service
import uasyncio as asyncio
import network
import ubinascii
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

        sta_ip, sta_mask, sta_gw, sta_dns = sta.ifconfig() if sta.isconnected() else ("0.0.0.0", "0.0.0.0", "0.0.0.0",
                                                                                      "0.0.0.0")

        try:
            ap_ssid_current = ap.config('essid') if ap.active() else ""
        except:
            ap_ssid_current = ""

        status = {
            "sta_connected": sta.isconnected(),
            "sta_ip": sta_ip,
            "sta_mask": sta_mask,
            "sta_gw": sta_gw,
            "sta_dns": sta_dns,
            "sta_rssi": 0,
            "ap_active": ap.active(),
            "ap_ip": ap.ifconfig()[0] if ap.active() else "0.0.0.0",
            "ap_ssid_current": ap_ssid_current,
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
            if config.get('sta_pass'): config['sta_pass'] = '********'
            if config.get('ap_pass'): config['ap_pass'] = '********'
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
        save_type = data.get('save_type', 'all')  # 'sta' или 'ap'

        try:
            with open('wifi.json', 'r') as f:
                config = json.load(f)
        except:
            config = {}

        # 1. Если сохраняем РОУТЕР
        if save_type == 'sta':
            new_pass = data.get('sta_pass', '')
            if new_pass == "" or new_pass == "********":
                new_pass = config.get('sta_pass', '')

            config['sta_ssid'] = data.get('sta_ssid', '')
            config['sta_pass'] = new_pass
            config['sta_static'] = data.get('sta_static', False)
            config['sta_ip'] = data.get('sta_ip', '')
            config['sta_mask'] = data.get('sta_mask', '')
            config['sta_gw'] = data.get('sta_gw', '')
            config['sta_dns'] = data.get('sta_dns', '')

        # 2. Если сохраняем ТОЧКУ ДОСТУПА
        elif save_type == 'ap':
            ap = network.WLAN(network.AP_IF)
            mac_suffix = ubinascii.hexlify(ap.config('mac'))[-4:].decode('utf-8').upper()
            default_ap_name = f"HLOS_{mac_suffix}"

            new_ap_ssid = data.get('ap_ssid', '').strip()
            if not new_ap_ssid:
                new_ap_ssid = config.get('ap_ssid', default_ap_name)

            new_ap_pass = data.get('ap_pass', '')
            if new_ap_pass == "" or new_ap_pass == "********":
                new_ap_pass = config.get('ap_pass', '')
            elif 0 < len(new_ap_pass) < 8:
                new_ap_pass = config.get('ap_pass', '')

            config['ap_ssid'] = new_ap_ssid
            config['ap_pass'] = new_ap_pass
            config['ap_disable'] = data.get('ap_disable', False)

        with open('wifi.json', 'w') as f:
            json.dump(config, f)

        await self.web.api_send_response(request, data={"status": "trying_to_connect"})

        async def apply_settings():
            await asyncio.sleep(1)

            if save_type == 'sta':
                sta = network.WLAN(network.STA_IF)
                sta.active(True)
                sta.disconnect()
                await asyncio.sleep(0.5)
                if config.get('sta_static') and config.get('sta_ip'):
                    ip = config.get('sta_ip')
                    mask = config.get('sta_mask') if config.get('sta_mask') else '255.255.255.0'
                    gw = config.get('sta_gw') if config.get('sta_gw') else ip
                    dns = config.get('sta_dns') if config.get('sta_dns') else '8.8.8.8'
                    try:
                        sta.ifconfig((ip, mask, gw, dns))
                    except Exception as e:
                        sta.ifconfig('dhcp')
                else:
                    sta.ifconfig('dhcp')
                sta.connect(config['sta_ssid'], config.get('sta_pass', ''))

            elif save_type == 'ap':
                ap = network.WLAN(network.AP_IF)
                # ЖЕСТКИЙ ПЕРЕЗАПУСК AP, чтобы пароль точно применился
                ap.active(False)
                await asyncio.sleep(0.5)
                ap.active(True)
                try:
                    if config.get('ap_pass') and len(config['ap_pass']) >= 8:
                        ap.config(essid=config['ap_ssid'], password=config['ap_pass'], authmode=3)
                    else:
                        ap.config(essid=config['ap_ssid'], authmode=0)
                except Exception:
                    pass

        asyncio.create_task(apply_settings())