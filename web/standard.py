from lib.kernel import os_kernel
from .nanowebapi import HttpError, EventData
import uasyncio as asyncio
#import os, json,gc,time
from .webserver import read_json
       #, authenticate, get_custom_data, get_memory, get_custom_data, get_memory, CREDENTIALS
import json


class StandardApi():
    def __init__(self, name, web):
        #super().__init__(name)
        #if web is None:
            #raise ValueError('not correct web')

        web.web_services.append( self.__class__.__name__)
        self.web=web
        self.web.app.route('/api/standard/*')(self.api_board)
        self.web.app.route('/api/standard/ls')(self.api_ls)
        self.web.app.route('/api/standard/set*')(self.api_set_val)
        self.web.app.route('/api/standard/grp/*')(self.api_grp_board)


    #@authenticate(CREDENTIALS)
    async def api_set_val(self, request):
        #print('request_set: start', request.method, request.url)
        if request.method == "OPTIONS":
            await self.web.api_send_response(request)
            return

        if not request.method in ["PUT","POST"]:
            print("Method not allowed", request.method)
            raise HttpError(request, 501, "Not Implemented")


      
        nm_module = request.url.split('/')[-1]
        aa_ = os_kernel.find_task(nm_module)
        print('request_set_3: ', aa_, nm_module)

        if not aa_:
          #raise HttpError(request, 404, "File Not Found")
          return ('module not found', 404)
          #return ' 123456 '


        data = await read_json(request)
        #print("Request data: ",  grp_name, data[0])
        #await 
        aa_.set_value( data[0]['id'], data[0]['value'])
        #print(f"api_switch_ls: {aa_}")
        #return json.dumps(aa_.state)
        return ' '



    #@authenticate(CREDENTIALS)
    async def api_ls(self, request):

        tt = []
        for t in os_kernel.tasks:
          if t.state.get("type") == "web_standard":
            tt.append([t.name, t.state.get("label"), t.state.get("group")]) 


        #print(f"api_standard_ls: {tt}")
        return {"modules":tt}



    async def api_board(self, request):
        #vnt_data = EventData()

        await request.write("HTTP/1.1 200 OK\r\n")
        await request.write("access-control-allow-origin: *\r\n") #,immutable
        #await request.write("Content-Type: text/event-stream\r\n")
        await request.write("Content-Type: text/event-stream\r\n")
        await request.write("Cache-Control: no-cache\r\n")
        await request.write("Connection: keep-alive\r\n\r\n")
        err = [False]
        send_ = [False]
        #aa_ = next(x for x in os_kernel.tasks  if x.name == 'Switches Board')
        nm_module = request.url.split('/')[-1]
        aa_ = os_kernel.find_task(nm_module)
        print(f"api_switch_board: ", nm_module, aa_, )

        if not aa_:
          return ('module not found', 404)

        async def scrib(inst):
          try:
            while send_[0]:
              #await self.web.sleep(1)
              await asyncio.sleep(1)
            send_[0] = True

            await request.write("event: " + "message\r\n")
            await request.write("data: " + json.dumps(aa_.state) + "\r\n")
            await request.write(f"id: {aa_.state["time"]}\r\n")
            await request.write("\r\n")
          except Exception as e:
            err[0] = True
            #raise e
          finally:
            send_[0] = False

        aa_.subscribe( scrib )
        #print(f"api_switch_ls: start")

        try:
          await scrib(None)
          for i in range(511):
            if err[0]:
              break
            #print(f"api_switch_ls: {i} \n:: {aa_.state}")
            #await self.web.sleep(92)
            await asyncio.sleep(2)
        finally:
          #print(f"api_switch_ls: close")
          aa_.unsubscribe(scrib)



    async def api_grp_board(self, request):
        #vnt_data = EventData()

        await request.write("HTTP/1.1 200 OK\r\n")
        await request.write("access-control-allow-origin: *\r\n") #,immutable
        #await request.write("Content-Type: text/event-stream\r\n")
        await request.write("Content-Type: text/event-stream\r\n")
        await request.write("Cache-Control: no-cache\r\n")
        await request.write("Connection: keep-alive\r\n\r\n")
        err = [False]
        send_ = [False]
        #aa_ = next(x for x in os_kernel.tasks  if x.name == 'Switches Board')
        grp_module = request.url.split('/')[-1]
        aa_s = os_kernel.find_by_group(grp_module)
        print(f"api_switch_board: ",  aa_s, len(aa_s), grp_module )

        if not aa_s:
          return ('module not found', 404)

        async def scrib(inst):
          try:
            while send_[0]:
              #await self.web.sleep(1)
              await asyncio.sleep(1)
            send_[0] = True

            await request.write("event: " + "message\r\n")
            await request.write("data: " + json.dumps(inst.state) + "\r\n")
            await request.write(f"id: {inst.state["time"]}\r\n")
            await request.write("\r\n")
          except Exception as e:
            err[0] = True
            #raise e
          finally:
            send_[0] = False
        for i in aa_s:
          i.subscribe( scrib )

        try:
          for i in aa_s:
            await scrib(i)
          for i in range(511):
            if err[0]:
              break
            await asyncio.sleep(2)
        finally:
          for i in aa_s:
            i.unsubscribe( scrib )

