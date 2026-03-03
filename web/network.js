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

    // ДВЕ КНОПКИ
    const saveStaBtn = document.getElementById('save-sta-btn');
    const saveStaStatus = document.getElementById('save-sta-status');
    const saveApBtn = document.getElementById('save-ap-btn');
    const saveApStatus = document.getElementById('save-ap-status');

    let configLoaded = false;

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

            if (!configLoaded && data.config) {
                staSsid.value = data.config.sta_ssid || '';

                staPass.value = data.config.sta_pass || '';
                if (data.config.sta_pass) staPass.placeholder = "Пароль сохранен";

                apSsid.value = data.config.ap_ssid || data.ap_ssid_current || '';

                apPass.value = data.config.ap_pass || '';
                if (data.config.ap_pass) apPass.placeholder = "Пароль сохранен";

                staStaticCb.checked = data.config.sta_static === true;
                staStaticCb.dispatchEvent(new Event('change'));

                staIp.value = data.config.sta_ip || (data.sta_ip !== "0.0.0.0" ? data.sta_ip : '');
                staMask.value = data.config.sta_mask || (data.sta_mask !== "0.0.0.0" ? data.sta_mask : '255.255.255.0');
                staGw.value = data.config.sta_gw || (data.sta_gw !== "0.0.0.0" ? data.sta_gw : '');
                staDns.value = data.config.sta_dns || (data.sta_dns !== "0.0.0.0" ? data.sta_dns : '8.8.8.8');

                apDisableCb.checked = data.config.ap_disable === true;
                configLoaded = true;
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

    // ОБРАБОТЧИК ДЛЯ РОУТЕРА (STA)
    saveStaBtn.addEventListener('click', async () => {
        saveStaBtn.disabled = true;
        saveStaStatus.style.color = "blue";
        saveStaStatus.textContent = "Подключение...";

        const payload = {
            save_type: 'sta', // Флаг для сервера
            sta_ssid: staSsid.value.trim(),
            sta_pass: staPass.value.trim(),
            sta_static: staStaticCb.checked,
            sta_ip: staIp.value.trim(),
            sta_mask: staMask.value.trim(),
            sta_gw: staGw.value.trim(),
            sta_dns: staDns.value.trim()
        };

        try {
            await fetch('/api/network/save', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            let attempts = 0;
            const checkConnect = setInterval(() => {
                attempts++;
                if (stConn.querySelector('.status-val').textContent === "Подключено") {
                    clearInterval(checkConnect);
                    saveStaStatus.style.color = "green";
                    saveStaStatus.textContent = "✅ Подключено!";
                    saveStaBtn.disabled = false;
                }
                if (attempts > 15) {
                    clearInterval(checkConnect);
                    saveStaStatus.style.color = "red";
                    saveStaStatus.textContent = "❌ Ошибка.";
                    saveStaBtn.disabled = false;
                }
            }, 3000);
        } catch (e) {
            saveStaStatus.textContent = "Ошибка связи";
            saveStaBtn.disabled = false;
        }
    });

    // ОБРАБОТЧИК ДЛЯ ТОЧКИ ДОСТУПА (AP)
    saveApBtn.addEventListener('click', async () => {
        saveApBtn.disabled = true;
        saveApStatus.style.color = "blue";
        saveApStatus.textContent = "Применяем настройки...";

        const payload = {
            save_type: 'ap', // Флаг для сервера
            ap_ssid: apSsid.value.trim(),
            ap_pass: apPass.value.trim(),
            ap_disable: apDisableCb.checked
        };

        try {
            await fetch('/api/network/save', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            setTimeout(() => {
                saveApStatus.style.color = "green";
                saveApStatus.textContent = "✅ Сохранено!";
                saveApBtn.disabled = false;
            }, 2000);
        } catch (e) {
            saveApStatus.textContent = "Ошибка связи";
            saveApBtn.disabled = false;
        }
    });
});