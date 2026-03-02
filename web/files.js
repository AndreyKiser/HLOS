document.addEventListener('DOMContentLoaded', () => {

    const fileListBody = document.getElementById('file-list-body');
    if (!fileListBody) return;

    const currentDirElement = document.getElementById('current-dir');
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    const S_IFDIR = 16384;

    async function loadFileList(directory = '') {
        try {
            const url = directory ? `/api/ls?chdir=${directory}` : '/api/ls';
            const response = await fetch(url);
            if (!response.ok) throw new Error();

            const data = await response.json();
            fileListBody.innerHTML = '';
            currentDirElement.textContent = data.currdir;
            selectAllCheckbox.checked = false;

            if (data.currdir !== '/') {
                fileListBody.innerHTML += `
                    <tr>
                        <td></td>
                        <td colspan="2"><span class="icon-folder"></span> <a href="#" class="dir-link" data-dir="/">\\ (Корень)</a></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td colspan="2"><span class="icon-folder"></span> <a href="#" class="dir-link" data-dir="..">.. (Наверх)</a></td>
                        <td></td>
                    </tr>`;
            }

            data.files.forEach(file => {
                const [filename, mode, size] = file;
                if (filename === '..' || filename === '/') return;

                const isDir = (mode & S_IFDIR) === S_IFDIR;
                const tr = document.createElement('tr');

                const tdCheckbox = document.createElement('td');
                tdCheckbox.className = 'col-checkbox';
                tdCheckbox.innerHTML = `<input type="checkbox" class="file-checkbox" data-filename="${filename}">`;
                tr.appendChild(tdCheckbox);

                const tdName = document.createElement('td');
                if (isDir) {
                    tdName.innerHTML = `<span class="icon-folder"></span> <a href="#" class="dir-link" data-dir="${filename}">${filename}</a>`;
                } else {
                    tdName.innerHTML = `<span class="icon-file"></span> ${filename}`;
                }
                tr.appendChild(tdName);

                const tdSize = document.createElement('td');
                tdSize.textContent = isDir ? '—' : formatBytes(size);
                tr.appendChild(tdSize);

                const tdActions = document.createElement('td');
                tdActions.style.textAlign = 'center';
                
                if (!isDir) {
                    tdActions.innerHTML = `
                        <div class="dropdown">
                            <button class="btn-icon dropdown-toggle" title="Меню">⋮</button>
                            <div class="dropdown-menu">
                                <a href="#" class="dropdown-item action-view" data-filename="${filename}">👁 Просмотр</a>
                                <a href="#" class="dropdown-item action-edit" data-filename="${filename}">✏️ Редактировать</a>
                                <a href="/api/download/${filename}" class="dropdown-item" download>⬇️ Скачать</a>
                                <a href="#" class="dropdown-item action-delete text-danger" data-filename="${filename}">🗑 Удалить</a>
                            </div>
                        </div>
                    `;
                }
                tr.appendChild(tdActions);
                fileListBody.appendChild(tr);
            });

        } catch (error) {
            fileListBody.innerHTML = `<tr><td colspan="4">Ошибка загрузки списка файлов.</td></tr>`;
        }
    }

    // Закрытие дропдаунов при клике вне меню
    window.addEventListener('click', (e) => {
        if (!e.target.matches('.dropdown-toggle')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
        }
    });

    fileListBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Дропдаун
        if (target.classList.contains('dropdown-toggle')) {
            e.preventDefault();
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== target.nextElementSibling) menu.classList.remove('show');
            });
            target.nextElementSibling.classList.toggle('show');
            e.stopPropagation();
            return;
        }

        // Просмотр
        if (target.closest('.action-view')) {
            e.preventDefault();
            const filename = target.closest('.action-view').getAttribute('data-filename');
            window.open(`/show_content?file_name=${filename}`, '_blank');
        }

        // РЕДАКТИРОВАНИЕ (Переход на новую страницу)
        if (target.closest('.action-edit')) {
            e.preventDefault();
            const filename = target.closest('.action-edit').getAttribute('data-filename');
            window.location.href = `/editor?file=${encodeURIComponent(filename)}`;
        }

        // Удаление
        if (target.closest('.action-delete')) {
            e.preventDefault();
            const filename = target.closest('.action-delete').getAttribute('data-filename');
            if (confirm(`Удалить файл ${filename}?`)) {
                try {
                    const res = await fetch(`/api/delete/${filename}`, { method: 'DELETE' });
                    if (res.ok) loadFileList(currentDirElement.textContent);
                } catch (err) {}
            }
        }

        // Навигация
        if (target.classList.contains('dir-link')) {
            e.preventDefault();
            const dir = target.getAttribute('data-dir');
            let currentDir = currentDirElement.textContent === '/' ? '' : currentDirElement.textContent;
            let newDir = dir === '..' ? (currentDir.substring(0, currentDir.lastIndexOf('/')) || '/') : (dir === '/' ? '/' : `${currentDir}/${dir}`);
            loadFileList(newDir);
        }

        // Чекбоксы
        if (target.classList.contains('file-checkbox')) {
            const allCheckboxes = document.querySelectorAll('.file-checkbox');
            selectAllCheckbox.checked = Array.from(allCheckboxes).every(cb => cb.checked);
        }
    });

    uploadButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadStatus.textContent = `Загрузка ${file.name}...`;
        try {
            const res = await fetch(`/api/upload/${file.name}`, { method: 'PUT', body: file, headers: { 'Content-Length': file.size } });
            if (res.ok) {
                uploadStatus.textContent = `Файл загружен!`;
                fileInput.value = '';
                loadFileList(currentDirElement.textContent);
            }
        } catch (error) { uploadStatus.textContent = `Ошибка загрузки.`; }
    });

    selectAllCheckbox.addEventListener('click', () => {
        document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = selectAllCheckbox.checked);
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        const files = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.getAttribute('data-filename'));
        if (!files.length) return;
        if (confirm(`Удалить ${files.length} файл(ов)?`)) {
            for (const filename of files) {
                try { await fetch(`/api/delete/${filename}`, { method: 'DELETE' }); } catch (e) {}
            }
            loadFileList(currentDirElement.textContent);
        }
    });

    loadFileList();
});