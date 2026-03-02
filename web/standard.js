document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('modules-container');
    const eventSources = []; // Храним активные подключения

    try {
        // 1. Получаем список всех активных модулей
        const res = await fetch('/api/standard/ls');
        const data = await res.json();

        if (!data.modules || data.modules.length === 0) {
            container.innerHTML = '<div class="card"><div class="card-body" style="text-align:center;">Активные модули не найдены.</div></div>';
            return;
        }

        container.innerHTML = ''; // Очищаем статус "Загрузка..."

        // 2. Для каждого модуля создаем карточку и открываем SSE-канал
        data.modules.forEach(mod => {
            const modName = mod[0];
            const modLabel = mod[1] || modName;

            // Рисуем пустую карточку
            const card = document.createElement('div');
            card.className = 'card module-card';
            card.innerHTML = `
                <div class="card-header"><strong>${modLabel}</strong></div>
                <div class="card-body" id="body-${modName}">
                    <div style="text-align:center; color:#999; padding: 10px;">Ожидание данных от датчиков...</div>
                </div>
            `;
            container.appendChild(card);

            // Подключаемся к потоку данных сервера (Server-Sent Events)
            const evtSource = new EventSource(`/api/standard/${modName}`);
            eventSources.push(evtSource);

            evtSource.onmessage = function(event) {
                const state = JSON.parse(event.data);
                renderModuleData(modName, state.data);
            };

            evtSource.onerror = function(err) {
                console.warn(`SSE Connection lost for ${modName}. Retrying...`);
            };
        });

    } catch (e) {
        container.innerHTML = '<div class="card"><div class="card-body" style="text-align:center; color:red;">Ошибка связи с сервером.</div></div>';
    }

    // Закрываем потоки при уходе со страницы, чтобы не грузить ESP32
    window.addEventListener('beforeunload', () => {
        eventSources.forEach(es => es.close());
    });

    /**
     * Отрисовывает или точечно обновляет DOM при прилете новых данных
     */
    function renderModuleData(modName, pinsData) {
        const bodyEl = document.getElementById(`body-${modName}`);
        if (!bodyEl) return;

        // Убираем надпись "Ожидание..." при первом пакете
        if (bodyEl.innerHTML.includes('Ожидание данных от датчиков...')) {
            bodyEl.innerHTML = '';
        }

        pinsData.forEach(pin => {
            let row = document.getElementById(`pin-${modName}-${pin.id}`);
            const val = pin.value;

            // Если строки для этого пина еще нет - создаем её
            if (!row) {
                row = document.createElement('div');
                row.className = 'sensor-row';
                row.id = `pin-${modName}-${pin.id}`;

                let controlHtml = '';
                const measure = pin.measure || '';

                if (pin.control === 'digital') {
                    // Рисуем тумблер
                    const isChecked = val ? 'checked' : '';
                    controlHtml = `
                        <label class="switch">
                            <input type="checkbox" id="cb-${modName}-${pin.id}" onchange="togglePin('${modName}', ${pin.id}, this.checked)" ${isChecked}>
                            <span class="slider"></span>
                        </label>
                    `;
                } else if (pin.indicator === 'analog') {
                    // Рисуем прогресс-бар и бейдж
                    let badgeClass = pin.class === 'bg-orange' ? 'badge badge-orange' : 'badge';
                    controlHtml = `
                        <div class="progress-bar-bg" style="display: ${pin.max ? 'inline-block' : 'none'};">
                            <div class="progress-bar-fill" id="fill-${modName}-${pin.id}" style="width: 0%;"></div>
                        </div>
                        <span id="text-${modName}-${pin.id}" class="${badgeClass}">${val} ${measure}</span>
                    `;
                } else {
                    // Обычный цифровой индикатор
                    controlHtml = `<span id="badge-${modName}-${pin.id}" class="badge"></span>`;
                }

                row.innerHTML = `<div class="sensor-name">${pin.name}</div><div class="sensor-value">${controlHtml}</div>`;
                bodyEl.appendChild(row);
            }

            // Точечное обновление значений (чтобы не перерисовывать весь DOM)
            if (pin.control === 'digital') {
                const cb = document.getElementById(`cb-${modName}-${pin.id}`);
                // Обновляем только если изменилось на сервере
                if (cb && cb.checked !== !!val) cb.checked = !!val;
            } else if (pin.indicator === 'analog') {
                const fill = document.getElementById(`fill-${modName}-${pin.id}`);
                const text = document.getElementById(`text-${modName}-${pin.id}`);

                let min = pin.min !== undefined ? pin.min : 0;
                let max = pin.max !== undefined ? pin.max : 100;
                let percent = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;

                if (fill) fill.style.width = `${percent}%`;
                if (text) text.textContent = `${val} ${pin.measure || ''}`;
            } else {
                const badge = document.getElementById(`badge-${modName}-${pin.id}`);
                if (badge) {
                    badge.style.backgroundColor = val ? '#28a745' : '#6c757d';
                    badge.textContent = val ? 'ВКЛ' : 'ВЫКЛ';
                }
            }
        });
    }

    // Глобальная функция для отправки команды переключения реле на сервер
    window.togglePin = async function(modName, id, isChecked) {
        const val = isChecked ? 1 : 0;
        try {
            await fetch(`/api/standard/set/${modName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{ id: id, value: val }])
            });
        } catch (e) {
            console.error('Ошибка переключения', e);
            alert('Не удалось связаться с устройством');
            // Возвращаем тумблер в исходное положение при ошибке
            document.getElementById(`cb-${modName}-${id}`).checked = !isChecked;
        }
    };
});