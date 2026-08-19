const express = require('express');
const pool    = require('../../config/db');
const router  = express.Router();

// GET /employee/todos
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `SELECT todoid, title, done, duedate, createdat FROM personal_todo
       WHERE userid = $1 ORDER BY done ASC, duedate ASC NULLS LAST, createdat DESC`,
      [userId]
    );
    res.json({ todos: rows });
  } catch (err) {
    console.error('GET /employee/todos:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /employee/todos
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const { title, duedate } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO personal_todo (userid, title, duedate) VALUES ($1, $2, $3) RETURNING *`,
      [userId, title.trim(), duedate || null]
    );
    res.status(201).json({ todo: rows[0] });
  } catch (err) {
    console.error('POST /employee/todos:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /employee/todos/:id  — update title and/or duedate
router.put('/:id', async (req, res) => {
  const userId = req.user.userId;
  const todoId = parseInt(req.params.id);
  const { title, duedate } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await pool.query(
      `UPDATE personal_todo SET title = $1, duedate = $2
       WHERE todoid = $3 AND userid = $4 RETURNING *`,
      [title.trim(), duedate || null, todoId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ todo: rows[0] });
  } catch (err) {
    console.error('PUT /employee/todos/:id:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /employee/todos/:id/toggle
router.patch('/:id/toggle', async (req, res) => {
  const userId = req.user.userId;
  const todoId = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE personal_todo SET done = NOT done
       WHERE todoid = $1 AND userid = $2 RETURNING *`,
      [todoId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ todo: rows[0] });
  } catch (err) {
    console.error('PATCH toggle todo:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /employee/todos/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user.userId;
  const todoId = parseInt(req.params.id);
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM personal_todo WHERE todoid = $1 AND userid = $2`,
      [todoId, userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE todo:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
