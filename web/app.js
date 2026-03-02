// Ждем, пока вся HTML-страница (DOM) не будет загружена
document.addEventListener('DOMContentLoaded', () => {

    // 1. ПОЛУЧАЕМ ССЫЛКИ НА HTML-ЭЛЕМЕНТЫ
    const fileListBody = document.getElementById('file-list-body');
    const currentDirElement = document.getElementById('current-dir');
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');

    const statusUptime = document.getElementById('status-uptime');
    const statusMem = document.getElementById('status-mem');
    const statusLoad = document.getElementById('status-load');

    // Новые элементы
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');


    // Константа для определения типа файла (из uos.stat)
    const S_IFDIR = 16384;

    // 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

    /**
     * Форматирует байты в читаемый вид (КБ, МБ)
     */
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Основная функция: загружает и отображает список файлов
     */
    async function loadFileList(directory = '') {
        try {
            const url = directory ? `/api/ls?chdir=${directory}` : '/api/ls';
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            fileListBody.innerHTML = '';
            currentDirElement.textContent = data.currdir;

            // Сбрасываем чекбокс "Выбрать все"
            selectAllCheckbox.checked = false;

            // Блок навигации "Наверх" и "В корень"
            if (data.currdir !== '/') {
                // 1. В Корень (\)
                const trRoot = document.createElement('tr');
                trRoot.innerHTML = `
                    <td></td> <td colspan="2"> <span class="icon-folder"></span>
                        <a href="#" class="dir-link" data-dir="/">\ (Корень)</a>
                    </td>
                    <td></td> `;
                fileListBody.appendChild(trRoot);

                // 2. Наверх (..)
                const trUp = document.createElement('tr');
                trUp.innerHTML = `
                    <td></td> <td colspan="2"> <span class="icon-folder"></span>
                        <a href="#" class="dir-link" data-dir="..">.. (Наверх)</a>
                    </td>
                    <td></td> `;
                fileListBody.appendChild(trUp);
            }

            // Перебираем файлы
            data.files.forEach(file => {
                const [filename, mode, size] = file;

                if (filename === '..' || filename === '/') {
                    return;
                }

                const isDir = (mode & S_IFDIR) === S_IFDIR;
                const tr = document.createElement('tr');

                // 1. Ячейка "Checkbox"
                const tdCheckbox = document.createElement('td');
                tdCheckbox.className = 'col-checkbox';
                tdCheckbox.innerHTML = `<input type="checkbox" class="file-checkbox" data-filename="${filename}">`;
                tr.appendChild(tdCheckbox);

                // 2. Ячейка "Имя"
                const tdName = document.createElement('td');
                if (isDir) {
                    tdName.innerHTML = `<span class="icon-folder"></span>
                                        <a href="#" class="dir-link" data-dir="${filename}">${filename}</a>`;
                } else {
                    tdName.innerHTML = `<span class="icon-file"></span>${filename}`;
                }
                tr.appendChild(tdName);

                // 3. Ячейка "Размер"
                const tdSize = document.createElement('td');
                tdSize.textContent = isDir ? '—' : formatBytes(size);
                tr.appendChild(tdSize);

                // 4. Ячейка "Действия"
                const tdActions = document.createElement('td');
                tdActions.className = 'action-buttons';
                if (!isDir) {
                    tdActions.innerHTML = `
                        <a href="/api/download/${filename}" class="btn btn-download" download>Download</a>
                        <button class="btn-danger btn-delete" data-filename="${filename}">Delete</button>
                    `;
                }
                tr.appendChild(tdActions);

                fileListBody.appendChild(tr);
            });

        } catch (error) {
            console.error("Failed to load file list:", error);
            fileListBody.innerHTML = `<tr><td colspan="4">Ошибка загрузки списка файлов.</td></tr>`;
        }
    }

    /**
     * Обновляет системную информацию в подвале
     */
    async function updateStatus() {
        try {
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(['uptime', 'mem_free', 'load'])
            });
            const data = await response.json();

            statusUptime.textContent = `${data.uptime} s`;
            statusMem.textContent = formatBytes(data.mem_free);
            statusLoad.textContent = `${(data.load * 100).toFixed(0)}%`;

        } catch (error) {
            console.error("Failed to update status:", error);
            statusUptime.textContent = 'N/A';
            statusMem.textContent = 'N/A';
            statusLoad.textContent = 'N/A';
        }
    }


    // 3. ОБРАБОТЧИКИ СОБЫТИЙ (Event Listeners)

    /**
     * Обрабатывает клики по списку файлов (удаление, переход по папкам, выбор)
     */
    fileListBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Клик по ссылке-директории
        if (target.classList.contains('dir-link')) {
            e.preventDefault();
            const dir = target.getAttribute('data-dir');

            let currentDir = currentDirElement.textContent;
            if (currentDir === '/') currentDir = '';

            let newDir;
            if (dir === '..') {
                newDir = currentDir.substring(0, currentDir.lastIndexOf('/'));
                if (newDir === '') newDir = '/';
            } else if (dir === '/') {
                newDir = '/';
            }
            else {
                newDir = `${currentDir}/${dir}`;
            }

            loadFileList(newDir);
        }

        // Клик по кнопке "Delete" (одиночное удаление)
        if (target.classList.contains('btn-delete')) {
            e.preventDefault();
            const filename = target.getAttribute('data-filename');

            if (confirm(`Вы уверены, что хотите удалить ${filename}?`)) {
                try {
                    const response = await fetch(`/api/delete/${filename}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        loadFileList(currentDirElement.textContent);
                    } else {
                        alert('Не удалось удалить файл.');
                    }
                } catch (error) {
                    console.error("Delete error:", error);
                }
            }
        }

        // Клик по чекбоксу файла
        if (target.classList.contains('file-checkbox')) {
            // Если хоть один чекбокс не выбран, снимаем "Выбрать все"
            if (!target.checked) {
                selectAllCheckbox.checked = false;
            } else {
                // Проверяем, выбраны ли все. Если да, ставим "Выбрать все"
                const allCheckboxes = document.querySelectorAll('.file-checkbox');
                const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
                if (allChecked) {
                    selectAllCheckbox.checked = true;
                }
            }
        }
    });

    /**
     * Обрабатывает загрузку файла на сервер
     */
    uploadButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            uploadStatus.textContent = 'Пожалуйста, выберите файл.';
            return;
        }

        const uploadUrl = `/api/upload/${file.name}`;
        uploadStatus.textContent = `Загрузка ${file.name}...`;

        try {
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Length': file.size
                }
            });

            if (response.ok) {
                uploadStatus.textContent = `Файл ${file.name} успешно загружен!`;
                fileInput.value = '';
                loadFileList(currentDirElement.textContent);
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error("Upload error:", error);
            uploadStatus.textContent = `Ошибка загрузки: ${error.message}`;
        }
    });

    /**
     * НОВЫЙ: Обработчик для "Выбрать все"
     */
    selectAllCheckbox.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.file-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
        });
    });

    /**
     * НОВЫЙ: Обработчик для "Удалить выбранное"
     */
    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
        const filesToDelete = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-filename'));

        if (filesToDelete.length === 0) {
            alert('Файлы не выбраны.');
            return;
        }

        if (confirm(`Вы уверены, что хотите удалить ${filesToDelete.length} файл(ов)?\n\n${filesToDelete.join('\n')}`)) {
            let errors = [];

            // Удаляем файлы по одному
            for (const filename of filesToDelete) {
                try {
                    const response = await fetch(`/api/delete/${filename}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) {
                        errors.push(filename);
                    }
                } catch (error) {
                    console.error("Delete error:", error);
                    errors.push(filename);
                }
            }

            if (errors.length > 0) {
                alert(`Не удалось удалить следующие файлы:\n${errors.join('\n')}`);
            }

            // Обновляем список, оставаясь в текущей директории
            loadFileList(currentDirElement.textContent);
        }
    });


    // 4. ИНИЦИАЛИЗАЦИЯ (Запуск при загрузке страницы)

    loadFileList();
    updateStatus();
    setInterval(updateStatus, 5000);

}); // <-- Конец 'DOMContentLoaded'