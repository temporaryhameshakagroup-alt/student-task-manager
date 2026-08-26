const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

let tasks = [
    { id: 1, title: 'Chapter 5 Problem Set', subject: 'Mathematics', description: 'Complete exercises 1-20 on integration by parts', dueDate: getFutureDate(1), priority: 'high', status: 'pending' },
    { id: 2, title: 'Lab Report: Pendulum Experiment', subject: 'Physics', description: "Write up results from Thursday's lab session", dueDate: getFutureDate(3), priority: 'medium', status: 'in-progress' },
    { id: 3, title: 'Essay: Industrial Revolution', subject: 'History', description: '1500 word essay on social impacts', dueDate: getFutureDate(-2), priority: 'high', status: 'pending' },
    { id: 4, title: 'Read Act 3 of Hamlet', subject: 'English', description: 'Answer comprehension questions at the end', dueDate: getFutureDate(0), priority: 'low', status: 'pending' },
    { id: 5, title: 'Build To-Do App', subject: 'Computer Science', description: 'Final project using vanilla JS', dueDate: getFutureDate(7), priority: 'medium', status: 'in-progress' },
    { id: 6, title: 'Organic Chemistry Worksheet', subject: 'Chemistry', description: 'Reaction mechanisms practice', dueDate: getFutureDate(-5), priority: 'medium', status: 'completed' },
    { id: 7, title: 'Biology Flashcards', subject: 'Biology', description: 'Create flashcards for cell division chapter', dueDate: getFutureDate(2), priority: 'low', status: 'pending' }
];

let nextId = 8;

app.get('/api/tasks', (req, res) => {
    res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
    const { title, subject, description, dueDate, priority, status } = req.body;

    if (!title || !subject || !dueDate) {
        return res.status(400).json({ error: 'Title, subject, and due date are required.' });
    }

    const task = {
        id: nextId++,
        title,
        subject,
        description: description || '',
        dueDate,
        priority: priority || 'medium',
        status: status || 'pending'
    };
    tasks.push(task);
    res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === Number(req.params.id));
    if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
    }

    const { title, subject, description, dueDate, priority, status } = req.body;

    if (!title || !subject || !dueDate) {
        return res.status(400).json({ error: 'Title, subject, and due date are required.' });
    }

    Object.assign(task, { title, subject, description: description || '', dueDate, priority, status });
    res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
    const exists = tasks.some(t => t.id === Number(req.params.id));
    if (!exists) {
        return res.status(404).json({ error: 'Task not found.' });
    }
    tasks = tasks.filter(t => t.id !== Number(req.params.id));
    res.status(204).end();
});

app.listen(PORT, () => {
    console.log(`Student Task Manager running at http://localhost:${PORT}`);
});
