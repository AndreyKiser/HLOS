from lib.kernel import os_kernel
from .nanowebapi import HttpError, EventData
from .webserver import read_json
import json


class CronApi():
    def __init__(self, name, web):
        web.web_services.append(self.__class__.__name__)
        self.web = web
        self.web.app.route('/api/cron/ls*')(self.api_cron_ls)
        self.web.app.route('/api/cron/set*')(self.api_cron_set_val)

    async def api_cron_set_val(self, request):
        if request.method == "OPTIONS":
            await self.web.api_send_response(request)
            return

        if request.method in ("PUT", "POST",):
            pass
        else:
            print("Method not allowed", request.method)
            raise HttpError(request, 501, "Not Implemented")

        grp_name = request.url.split('/')
        if len(grp_name) > 4:
            grp_name = grp_name[5]
        else:
            grp_name = None

        aa_ = os_kernel.find_task('CronScheduler')

        data = await read_json(request)
        print("Request data: ", data)
        await aa_.set_value(data)
        return ' '

    def evt_changes(self, request):
        pass

    async def api_cron_ls(self, request):
        reload = request.url.split('/')[-1] == 'reload'

        aa_ = os_kernel.find_task('CronScheduler')
        if reload:
            aa_.reload()
        if aa_:
            tasks = [(i.enabled, i.schedule, i.id, i.params, i.label,) for i in aa_.task_list]
            cmd_list = [(id, label, params,) for _, id, label, params in aa_.cmd_list]
            return {"tasks": tasks, "cmd_list": cmd_list}
