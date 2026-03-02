function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
    const headerTime = document.getElementById('header-time');
    const headerName = document.getElementById('header-name');

    const statusUptime = document.getElementById('status-uptime');
    const statusMem = document.getElementById('status-mem');
    const statusLoad = document.getElementById('status-load');
    const statusStorage = document.getElementById('status-storage');

    let espTime = null;

    // Таймер хода часов (каждую секунду)
    setInterval(() => {
        if (espTime && headerTime) {
            espTime.setSeconds(espTime.getSeconds() + 1);
            // Используем UTC, чтобы браузер не добавлял свой часовой пояс
            const h = String(espTime.getUTCHours()).padStart(2, '0');
            const m = String(espTime.getUTCMinutes()).padStart(2, '0');
            const s = String(espTime.getUTCSeconds()).padStart(2, '0');
            headerTime.textContent = `${h}:${m}:${s}`;
        }
    }, 1000);

    async function updateStatus() {
        try {
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(['uptime', 'mem_free', 'load', 'storage_free', 'storage_total', 'datetime', 'name'])
            });

            if (!response.ok) return;
            const data = await response.json();

            // 1. Обновляем часы
            if (data.datetime) {
                espTime = new Date(data.datetime);
                if (headerTime && headerTime.textContent === '--:--:--') {
                    const h = String(espTime.getUTCHours()).padStart(2, '0');
                    const m = String(espTime.getUTCMinutes()).padStart(2, '0');
                    const s = String(espTime.getUTCSeconds()).padStart(2, '0');
                    headerTime.textContent = `${h}:${m}:${s}`;
                }
            }

            // 2. Обновляем имя в шапке (если оно пришло и отличается)
            if (data.name && headerName && headerName.textContent !== `HLOS: ${data.name}`) {
                headerName.textContent = `HLOS: ${data.name}`;
                document.title = `HLOS: ${data.name}`;
            }

            // 3. Обновляем подвал
            if (statusUptime) statusUptime.textContent = `${data.uptime} s`;
            if (statusMem) statusMem.textContent = formatBytes(data.mem_free);
            if (statusLoad) statusLoad.textContent = `${(data.load * 100).toFixed(0)}%`;
            if (statusStorage) {
                statusStorage.textContent = `${formatBytes(data.storage_free)} / ${formatBytes(data.storage_total)}`;
            }
        } catch (error) {
            console.error("Failed to update status:", error);
        }
    }

    updateStatus();
    setInterval(updateStatus, 5000);
});