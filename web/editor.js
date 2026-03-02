document.addEventListener('DOMContentLoaded', async () => {
    // Получаем имя файла из адресной строки
    const urlParams = new URLSearchParams(window.location.search);
    const filename = urlParams.get('file');

    const titleEl = document.getElementById('editor-title');
    const textareaEl = document.getElementById('editor-textarea');
    const saveBtn = document.getElementById('editor-save-btn');

    if (!filename) {
        titleEl.textContent = 'Ошибка: Файл не выбран';
        return;
    }

    titleEl.textContent = `Редактирование: ${filename}`;

    try {
        // ИСПРАВЛЕНИЕ: просим сервер отдать чистый текст (raw=true)
        const res = await fetch(`/show_content?file_name=${encodeURIComponent(filename)}&raw=true`);
        if (res.ok) {
            textareaEl.value = await res.text();
            textareaEl.disabled = false;
        } else {
            textareaEl.value = 'Ошибка: Не удалось загрузить содержимое файла.';
        }
    } catch (e) {
        textareaEl.value = 'Ошибка: Нет связи с устройством.';
    }

    // Сохранение
    saveBtn.addEventListener('click', async () => {
        saveBtn.textContent = 'Сохранение...';
        saveBtn.disabled = true;
        textareaEl.disabled = true;

        try {
            const content = textareaEl.value;
            const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });

            const res = await fetch(`/api/upload/${encodeURIComponent(filename)}`, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Length': blob.size }
            });

            if (res.ok) {
                alert('Файл успешно сохранен!');
            } else {
                alert('Ошибка при сохранении файла.');
            }
        } catch (e) {
            alert('Ошибка сети. Проверьте подключение.');
        } finally {
            saveBtn.textContent = '💾 Сохранить';
            saveBtn.disabled = false;
            textareaEl.disabled = false;
        }
    });
});