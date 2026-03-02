document.addEventListener('DOMContentLoaded', () => {
    const stConn = document.getElementById('st-conn');
    const stIp = document.getElementById('st-ip');
    const stRssi = document.getElementById('st-rssi');
    const stTime = document.getElementById('st-time');
    const espClock = document.getElementById('esp-clock');
    
    const staSsid = document.getElementById('sta-ssid');
    const staPass = document.getElementById('sta-pass');

    const staStaticCb = document.getElementById('sta-static-cb');
    const staticFields = document.getElementById('static-fields');
    const staIp = document.getElementById('sta-ip');
    const staMask = document.getElementById('sta-mask');
    const staGw = document.getElementById('sta-gw');
    const staDns = document.getElementById('sta-dns');

    const apSsid = document.getElementById('ap-ssid');
    const apPass = document.getElementById('ap-pass');
    const apDisableCb = document.getElementById('ap-disable-cb');

    const scanBtn = document.getElementById('scan-btn');
    const scanRes = document.getElementById('scan-results');
    const saveBtn = document.getElementById('save-wifi-btn');
    const saveStatus = document.getElementById('save-status');

    staStaticCb.addEventListener('change', () => {
        staticFields.style.display = staStaticCb.checked ? 'block' : 'none';
    });

    async function updateStatus() {
        try {
            const res = await fetch('/api/network/status');
            const data = await res.json();

            if (data.sta_connected) {
                stConn.className = 'status-box ok'; stConn.querySelector('.status-val').textContent = "Подключено";
                stIp.className = 'status-box ok'; stIp.querySelector('.status-val').textContent = data.sta_ip;
                stRssi.querySelector('.status-val').textContent = data.sta_rssi + " dBm";
            } else {
                stConn.className = 'status-box err'; stConn.querySelector('.status-val').textContent = "Отключено";
                stIp.className = 'status-box'; stIp.querySelector('.status-val').textContent = "---";
                stRssi.querySelector('.status-val').textContent = "---";
            }

            stTime.className = data.time_synced ? 'status-box ok' : 'status-box err';
            stTime.querySelector('.status-val').textContent = data.time_synced ? "ОК" : "Нет";
            espClock.textContent = data.current_time;

            if (!staSsid.value && data.config && !document.activeElement.isSameNode(staSsid)) {
                staSsid.value = data.config.sta_ssid || '';
                apSsid.value = data.config.ap_ssid || '';
                apPass.value = data.config.ap_pass || '';

                staStaticCb.checked = data.config.sta_static === true;
                staStaticCb.dispatchEvent(new Event('change'));
                staIp.value = data.config.sta_ip || '';
                staMask.value = data.config.sta_mask || '255.255.255.0';
                staGw.value = data.config.sta_gw || '';
                staDns.value = data.config.sta_dns || '8.8.8.8';
                apDisableCb.checked = data.config.ap_disable === true;
            }
        } catch (e) { console.error(e); }
    }

    updateStatus();
    setInterval(updateStatus, 3000);

    scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true; scanBtn.textContent = "Поиск...";
        scanRes.style.display = 'block'; scanRes.innerHTML = '<div style="padding:10px;">Сканирование...</div>';
        try {
            const res = await fetch('/api/network/scan');
            const nets = await res.json();
            scanRes.innerHTML = '';
            if (nets.length === 0) scanRes.innerHTML = '<div style="padding:10px;">Пусто</div>';
            nets.forEach(n => {
                const div = document.createElement('div');
                div.className = 'wifi-item';
                div.innerHTML = `<span>${n.ssid}</span> <span class="wifi-rssi">${n.rssi} dBm</span>`;
                div.onclick = () => { staSsid.value = n.ssid; scanRes.style.display = 'none'; staPass.focus(); };
                scanRes.appendChild(div);
            });
        } catch (e) { scanRes.innerHTML = '<div style="padding:10px; color:red;">Ошибка</div>'; }
        finally { scanBtn.disabled = false; scanBtn.textContent = "🔍 Скан"; }
    });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveStatus.style.color = "blue";
        saveStatus.textContent = "Применяем настройки...";

        const payload = {
            sta_ssid: staSsid.value.trim(),
            sta_pass: staPass.value.trim(),
            sta_static: staStaticCb.checked,
            sta_ip: staIp.value.trim(),
            sta_mask: staMask.value.trim(),
            sta_gw: staGw.value.trim(),
            sta_dns: staDns.value.trim(),
            ap_ssid: apSsid.value.trim(),
            ap_pass: apPass.value.trim(),
            ap_disable: apDisableCb.checked
        };

        try {
            await fetch('/api/network/save', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            saveStatus.textContent = "⏳ Ждем подключения...";

            let attempts = 0;
            const checkConnect = setInterval(() => {
                attempts++;
                if (stConn.querySelector('.status-val').textContent === "Подключено") {
                    clearInterval(checkConnect);
                    saveStatus.style.color = "green";
                    saveStatus.textContent = "✅ УСПЕХ!";
                    saveBtn.disabled = false;
                }
                if (attempts > 15) {
                    clearInterval(checkConnect);
                    saveStatus.style.color = "red";
                    saveStatus.textContent = "❌ Не удалось получить IP.";
                    saveBtn.disabled = false;
                }
            }, 3000);
        } catch (e) {
            saveStatus.textContent = "Ошибка связи";
            saveBtn.disabled = false;
        }
    });
});