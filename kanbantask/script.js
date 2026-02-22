/*
  Kanban Task Manager
  - Single-file vanilla JS
  - Data model saved in localStorage as 'kanban_board_v1'
*/

const STORAGE_KEY = 'kanban_board_v1';

// Basic utilities
const uid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);

// Default sample board if none exists
const sampleBoard = {
    columns: [
        {
            id: 'col-' + uid(6), title: 'To Do', tasks: [
                { id: 't-' + uid(6), title: 'Design homepage', desc: 'Create wireframe for landing', due: '', tags: ['design'] },
                { id: 't-' + uid(6), title: 'Setup repo', desc: 'Initialize git and README', due: '', tags: ['dev'] }
            ]
        },
        {
            id: 'col-' + uid(6), title: 'In Progress', tasks: [
                { id: 't-' + uid(6), title: 'Build auth UI', desc: 'Login & register forms', due: '', tags: ['frontend'] }
            ]
        },
        {
            id: 'col-' + uid(6), title: 'Done', tasks: [
                { id: 't-' + uid(6), title: 'Project proposal', desc: 'Submit project proposal doc', due: '', tags: ['paper'] }
            ]
        },
    ]
};

// State
let boardData = { columns: [] };
let dragState = { draggingTaskId: null, fromColumnId: null, draggingColId: null };
const boardEl = document.getElementById('board');
const searchInput = document.getElementById('searchInput');
const filterTag = document.getElementById('filterTag');

// Modals & forms
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDesc = document.getElementById('taskDesc');
const taskDue = document.getElementById('taskDue');
const taskTags = document.getElementById('taskTags');
const taskColumn = document.getElementById('taskColumn');
const taskCancel = document.getElementById('taskCancel');
let editingTask = null; // {colId,taskId} or null

const colModal = document.getElementById('colModal');
const colForm = document.getElementById('colForm');
const colName = document.getElementById('colName');
const colCancel = document.getElementById('colCancel');
let editingColId = null;

// Buttons
document.getElementById('addColumnBtn').addEventListener('click', () => openColModal());
document.getElementById('exportBtn').addEventListener('click', exportBoard);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('clearBtn').addEventListener('click', clearBoard);
document.getElementById('importFile').addEventListener('change', handleImportFile);

// search / tag filter
searchInput.addEventListener('input', renderBoard);
filterTag.addEventListener('change', renderBoard);

// localStorage load / save
function loadBoard() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { boardData = sampleBoard; saveBoard(); return; }
        boardData = JSON.parse(raw);
        // ensure structure
        if (!boardData.columns) boardData = sampleBoard;
    } catch (e) {
        console.error('Failed to load board, using sample', e);
        boardData = sampleBoard;
    }
}
function saveBoard() { localStorage.setItem(STORAGE_KEY, JSON.stringify(boardData)); updateFilterTags(); }

// Render functions
function renderBoard() {
    boardEl.innerHTML = '';
    const query = searchInput.value.trim().toLowerCase();
    const tagFilter = filterTag.value;

    // for accessible column dragging, use container
    boardData.columns.forEach((col, colIndex) => {
        const colEl = document.createElement('section');
        colEl.className = 'column';
        colEl.draggable = true;
        colEl.dataset.colId = col.id;

        // Column header
        const header = document.createElement('div');
        header.className = 'col-header';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'col-title';
        title.textContent = col.title;
        title.contentEditable = true;
        title.spellcheck = false;
        title.addEventListener('blur', (e) => {
            const val = e.target.textContent.trim() || 'Untitled';
            updateColumnTitle(col.id, val);
        });

        const count = document.createElement('div');
        count.className = 'col-count';
        count.textContent = col.tasks.length + ' tasks';
        left.appendChild(title);
        left.appendChild(count);

        const actions = document.createElement('div');
        actions.className = 'col-actions';
        const addBtn = document.createElement('button');
        addBtn.className = 'btn ghost';
        addBtn.textContent = '+ Task';
        addBtn.addEventListener('click', () => openTaskModal(col.id));
        const delBtn = document.createElement('button');
        delBtn.className = 'btn ghost danger';
        delBtn.textContent = 'Delete';
        delBtn.title = 'Delete column';
        delBtn.addEventListener('click', () => { if (confirm('Delete column and its tasks?')) { deleteColumn(col.id); } });

        actions.appendChild(addBtn); actions.appendChild(delBtn);
        header.appendChild(left); header.appendChild(actions);

        // Task list
        const taskList = document.createElement('div');
        taskList.className = 'task-list';
        taskList.dataset.columnId = col.id;

        // allow dropping
        taskList.addEventListener('dragover', e => e.preventDefault());
        taskList.addEventListener('drop', (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/task');
            const fromCol = e.dataTransfer.getData('text/fromCol');
            if (!taskId) return;
            moveTask(fromCol, col.id, taskId);
        });

        // render tasks filtered by search/tag
        col.tasks.forEach(task => {
            const textMatch = [task.title, (task.desc || ''), (task.tags || []).join(' ')].join(' ').toLowerCase();
            if (query && !textMatch.includes(query)) return;
            if (tagFilter && !(task.tags || []).includes(tagFilter)) return;

            const t = document.createElement('article');
            t.className = 'task';
            t.draggable = true;
            t.dataset.taskId = task.id;
            t.dataset.colId = col.id;

            t.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/task', task.id);
                e.dataTransfer.setData('text/fromCol', col.id);
                setTimeout(() => t.classList.add('dragging'), 10);
            });
            t.addEventListener('dragend', () => t.classList.remove('dragging'));

            // open edit on click
            t.addEventListener('dblclick', () => openTaskModal(col.id, task.id));

            const tTitle = document.createElement('div');
            tTitle.className = 't-title';
            tTitle.textContent = task.title;

            const tMeta = document.createElement('div');
            tMeta.className = 't-meta';
            if (task.due) {
                const due = document.createElement('span');
                due.className = 'pill';
                const d = new Date(task.due);
                due.textContent = 'Due: ' + d.toLocaleDateString();
                if (new Date(task.due) < new Date()) due.style.borderColor = 'rgba(239,68,68,0.6)';
                tMeta.appendChild(due);
            }
            (task.tags || []).forEach(tag => {
                const tg = document.createElement('span');
                tg.className = 'tag';
                tg.textContent = tag;
                tMeta.appendChild(tg);
            });

            // actions
            const tActions = document.createElement('div');
            tActions.style.marginTop = '8px'; tActions.style.display = 'flex'; tActions.style.gap = '8px';
            const editBtn = document.createElement('button');
            editBtn.className = 'btn ghost'; editBtn.textContent = 'Edit';
            editBtn.onclick = (ev) => { ev.stopPropagation(); openTaskModal(col.id, task.id) };
            const delBtnT = document.createElement('button');
            delBtnT.className = 'btn ghost danger'; delBtnT.textContent = 'Del';
            delBtnT.onclick = (ev) => { ev.stopPropagation(); if (confirm('Delete this task?')) deleteTask(col.id, task.id); };

            tActions.appendChild(editBtn); tActions.appendChild(delBtnT);

            t.appendChild(tTitle); t.appendChild(tMeta); t.appendChild(tActions);
            taskList.appendChild(t);
        });

        // allow column reorder by dragging header
        colEl.addEventListener('dragstart', (e) => {
            if (e.target !== colEl) return;
            e.dataTransfer.setData('text/col', col.id);
            e.dataTransfer.effectAllowed = 'move';
            colEl.classList.add('dragging');
        });
        colEl.addEventListener('dragend', () => colEl.classList.remove('dragging'));

        // drop between columns to reorder
        colEl.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        colEl.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedColId = e.dataTransfer.getData('text/col');
            if (draggedColId) reorderColumn(draggedColId, col.id);
        });

        colEl.appendChild(header);
        colEl.appendChild(taskList);
        boardEl.appendChild(colEl);
    });

    // add button column at end
    const addCol = document.createElement('div'); addCol.className = 'add-col';
    const addInner = document.createElement('div'); addInner.style.width = '280px';
    addInner.innerHTML = '<div class="column" style="display:flex;align-items:center;justify-content:center;min-height:120px;"><button id="inlineAddCol" class="btn">+ Add new column</button></div>';
    addInner.querySelector('#inlineAddCol').addEventListener('click', () => openColModal());
    addCol.appendChild(addInner);
    boardEl.appendChild(addCol);

    updateFilterTags();
}

function updateColumnTitle(colId, title) {
    const col = boardData.columns.find(c => c.id === colId);
    if (!col) return;
    col.title = title;
    saveBoard(); renderBoard();
}

function moveTask(fromColId, toColId, taskId) {
    if (fromColId === toColId) return;
    const from = boardData.columns.find(c => c.id === fromColId);
    const to = boardData.columns.find(c => c.id === toColId);
    if (!from || !to) return;
    const idx = from.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const [task] = from.tasks.splice(idx, 1);
    to.tasks.unshift(task); // put at top
    saveBoard(); renderBoard();
}

function deleteTask(colId, taskId) {
    const col = boardData.columns.find(c => c.id === colId);
    if (!col) return;
    col.tasks = col.tasks.filter(t => t.id !== taskId);
    saveBoard(); renderBoard();
}

function deleteColumn(colId) {
    boardData.columns = boardData.columns.filter(c => c.id !== colId);
    saveBoard(); renderBoard();
}

function reorderColumn(draggedId, targetId) {
    if (draggedId === targetId) return;
    const cols = boardData.columns;
    const dIdx = cols.findIndex(c => c.id === draggedId);
    const tIdx = cols.findIndex(c => c.id === targetId);
    if (dIdx === -1 || tIdx === -1) return;
    const [col] = cols.splice(dIdx, 1);
    cols.splice(tIdx, 0, col);
    saveBoard(); renderBoard();
}

// Column modal
function openColModal(editId) {
    editingColId = editId || null;
    colModal.style.display = 'flex';
    colName.value = editId ? (boardData.columns.find(c => c.id === editId).title) : '';
    colName.focus();
}
colCancel.addEventListener('click', () => { colModal.style.display = 'none'; editingColId = null; });
colForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = colName.value.trim() || 'Untitled';
    if (editingColId) {
        const c = boardData.columns.find(x => x.id === editingColId); if (c) { c.title = name; }
    } else {
        boardData.columns.push({ id: 'col-' + uid(6), title: name, tasks: [] });
    }
    saveBoard(); renderBoard();
    colModal.style.display = 'none'; editingColId = null;
});

// Task modal
function openTaskModal(colId, taskId = null) {
    editingTask = taskId ? { colId, taskId } : null;
    taskModal.style.display = 'flex';
    // populate column select
    taskColumn.innerHTML = '';
    boardData.columns.forEach(c => {
        const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.title; if (c.id === colId) opt.selected = true;
        taskColumn.appendChild(opt);
    });
    if (taskId) {
        const col = boardData.columns.find(c => c.id === colId);
        const task = col.tasks.find(t => t.id === taskId);
        if (task) {
            taskTitle.value = task.title;
            taskDesc.value = task.desc || '';
            taskDue.value = task.due || '';
            taskTags.value = (task.tags || []).join(',');
            document.getElementById('taskModalTitle').textContent = 'Edit Task';
        }
    } else {
        taskTitle.value = '';
        taskDesc.value = '';
        taskDue.value = '';
        taskTags.value = '';
        document.getElementById('taskModalTitle').textContent = 'Add Task';
    }
    taskTitle.focus();
}
taskCancel.addEventListener('click', () => { taskModal.style.display = 'none'; editingTask = null; });
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = {
        id: editingTask ? editingTask.taskId : 't-' + uid(6),
        title: taskTitle.value.trim() || 'Untitled task',
        desc: taskDesc.value.trim(),
        due: taskDue.value || '',
        tags: taskTags.value.split(',').map(s => s.trim()).filter(Boolean)
    };
    const targetColId = taskColumn.value;
    // if editing and moving to new column remove from old
    if (editingTask) {
        const fromCol = boardData.columns.find(c => c.id === editingTask.colId);
        if (fromCol) {
            const idx = fromCol.tasks.findIndex(x => x.id === editingTask.taskId);
            if (idx > -1) fromCol.tasks.splice(idx, 1);
        }
    }
    // add at top of selected column
    const col = boardData.columns.find(c => c.id === targetColId);
    if (col) col.tasks.unshift(t);
    saveBoard(); renderBoard();
    taskModal.style.display = 'none'; editingTask = null;
});

// Export / Import / Clear
function exportBoard() {
    const data = JSON.stringify(boardData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kanban-board.json'; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
}
function handleImportFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (parsed.columns) {
                if (confirm('Replace current board with imported board?')) {
                    boardData = parsed;
                    saveBoard(); renderBoard();
                }
            } else alert('Invalid file structure');
        } catch (err) { alert('Invalid JSON file') }
    };
    reader.readAsText(f);
    e.target.value = ''; // reset
}
function clearBoard() {
    if (!confirm('Clear board and reset to sample?')) return;
    boardData = JSON.parse(JSON.stringify(sampleBoard));
    saveBoard(); renderBoard();
}

// Update tag filter options dynamically
function updateFilterTags() {
    const tags = new Set();
    boardData.columns.forEach(c => c.tasks.forEach(t => (t.tags || []).forEach(tag => tags.add(tag))));
    filterTag.innerHTML = '<option value="">Filter tag (all)</option>';
    Array.from(tags).sort().forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag; opt.textContent = tag;
        filterTag.appendChild(opt);
    });
}

// initial load
loadBoard();
renderBoard();

// keyboard support: Esc to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        taskModal.style.display = 'none';
        colModal.style.display = 'none';
        editingTask = null; editingColId = null;
    }
});

// touch-friendly improvements (simple)
let touchStartX = 0, touchStartY = 0;
boardEl.addEventListener('touchstart', (e) => { if (e.touches && e.touches[0]) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY } }, { passive: true });
