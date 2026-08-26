var tasks = [];
var editId = null;
var currentFilter = 'all';

function getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

async function loadTasks() {
    const res = await fetch('/api/tasks');
    if (!res.ok) {
        alert('Failed to load tasks.');
        return;
    }
    tasks = await res.json();
    filterTasks();
}

// Set default due date to 3 days from now
document.getElementById('dueDate').value = getFutureDate(3);

// Render on load
document.addEventListener('DOMContentLoaded', loadTasks);

async function addTask() {
    const title = document.getElementById('title').value.trim();
    const subject = document.getElementById('subject').value;
    const description = document.getElementById('description').value.trim();
    const dueDate = document.getElementById('dueDate').value;
    const priority = document.getElementById('priority').value;
    const status = document.getElementById('status').value;

    if (!title || !subject || !dueDate) {
        alert('Please fill in title, subject, and due date!');
        return;
    }

    let res;
    if (editId !== null) {
        res = await fetch(`/api/tasks/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, subject, description, dueDate, priority, status })
        });
        editId = null;
        document.getElementById('submit').innerText = 'Add Task';
    } else {
        res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, subject, description, dueDate, priority, status })
        });
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Something went wrong.');
        return;
    }

    clearForm();
    await loadTasks();
}

function clearForm() {
    document.getElementById('title').value = '';
    document.getElementById('subject').value = '';
    document.getElementById('description').value = '';
    document.getElementById('dueDate').value = '';
    document.getElementById('priority').value = 'medium';
    document.getElementById('status').value = 'pending';
}

async function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.status = task.status === 'completed' ? 'pending' : 'completed';

    const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });

    if (!res.ok) {
        alert('Failed to update task.');
        return;
    }
    await loadTasks();
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('title').value = task.title;
    document.getElementById('subject').value = task.subject;
    document.getElementById('description').value = task.description;
    document.getElementById('dueDate').value = task.dueDate;
    document.getElementById('priority').value = task.priority;
    document.getElementById('status').value = task.status;

    editId = id;
    document.getElementById('submit').innerText = 'Update Task';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteTask(id) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        alert('Failed to delete task.');
        return;
    }
    await loadTasks();
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterTasks();
}

function isOverdue(dueDate, status) {
    if (status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    return due < today;
}

function isDueSoon(dueDate, status) {
    if (status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const diff = (due - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 2;
}

function formatDate(dueDate) {
    const date = new Date(dueDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

function updateStats() {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status !== 'completed').length;
    const soon = tasks.filter(t => isDueSoon(t.dueDate, t.status)).length;
    const overdue = tasks.filter(t => isOverdue(t.dueDate, t.status)).length;

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-pending').innerText = pending;
    document.getElementById('stat-soon').innerText = soon;
    document.getElementById('stat-overdue').innerText = overdue;
}

function filterTasks() {
    const query = (document.getElementById('search').value || '').toLowerCase();
    let filtered = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(query) ||
                             t.subject.toLowerCase().includes(query);
        if (!matchesSearch) return false;

        switch (currentFilter) {
            case 'pending': return t.status === 'pending';
            case 'in-progress': return t.status === 'in-progress';
            case 'completed': return t.status === 'completed';
            case 'overdue': return isOverdue(t.dueDate, t.status);
            default: return true;
        }
    });

    // Sort by due date (overdue first, then ascending)
    filtered.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    renderTasks(filtered);
    updateStats();
}

function renderTasks(taskList) {
    const container = document.getElementById('taskList');

    if (taskList.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No assignments found.</p></div>';
        return;
    }

    container.innerHTML = taskList.map(task => {
        const overdue = isOverdue(task.dueDate, task.status);
        const dueSoon = isDueSoon(task.dueDate, task.status);
        const completed = task.status === 'completed';

        let cardClass = 'task-card';
        if (completed) cardClass += ' completed';
        if (overdue) cardClass += ' overdue';

        let dateClass = 'due-date';
        if (dueSoon) dateClass += ' soon';

        const checkboxClass = completed ? 'task-checkbox checked' : 'task-checkbox';
        const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

        return `
            <div class="${cardClass}">
                <div class="${checkboxClass}" onclick="toggleComplete(${task.id})"></div>
                <div class="task-content">
                    <p class="task-title">${escapeHtml(task.title)}</p>
                    ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
                    <div class="task-meta">
                        <span class="task-tag tag-subject">${escapeHtml(task.subject)}</span>
                        <span class="task-tag tag-priority-${task.priority}">${priorityLabel}</span>
                        <span class="${dateClass}">&#128197; ${formatDate(task.dueDate)}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="icon-btn edit" onclick="editTask(${task.id})">Edit</button>
                    <button class="icon-btn delete" onclick="deleteTask(${task.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
