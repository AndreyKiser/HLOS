from lib.kernel import os_kernel
from .nanowebapi import HttpError
from .webserver import read_json
import json


class NetConfig():
    def __init__(self, name, web, net_manager):
        web.web_services.append(self.__class__.__name__)
        self.web = web
        self.net_manager = net_manager
        self.web.app.route('/api/net/config*')(self.api_net_config)
        self.web.app.route('/api/net/scan')(self.api_net_scan)

    async def api_net_config(self, request):
        print("Request api_net_config: ")

        if request.method == "OPTIONS":
            await self.web.api_send_response(request, 'GET, PUT, POST, DELETE, OPTIONS')
            return

        if request.method in ["POST", "PUT"]:
            data = await read_json(request)
            print("Request data:", data)
            # Передаем ВЕСЬ словарь data, а не отдельные поля
            await self.net_manager.connect_to_network(data)
            return ' '
        elif request.method == "DELETE":
            self.net_manager.forget()
            return ' '

    async def api_net_scan(self, request):
        import ubinascii

        # 1. Получаем живой статус
        status = self.net_manager.get_status()

        # 2. Читаем сохраненную конфигурацию
        config = {}
        try:
            with open('/wifi.json', 'r') as f:
                config = json.loads(f.read())
        except Exception:
            print("No wifi.json found, sending empty config")

        # 3. Сканируем сети
        scan_results = await self.net_manager.scan_networks()
        res = [list(i) for i in scan_results]
        for i in res:
            if type(i[1]) == bytes:
                i[1] = ubinascii.hexlify(i[1]).decode()

        # 4. Отправляем все вместе
        return json.dumps({
            "available": res,
            "status": status,
            "config": config
        })

