const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /admin/categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT categoryid, name, slug, color, createdat FROM categories ORDER BY createdat ASC'
    );
    res.json({ categories: rows });
  } catch (err) {
    console.error('GET /admin/categories:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/categories
router.post('/', async (req, res) => {
  const { name, color = '#64748b' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  // Generate slug from name: strip non-alphanumeric, TitleCase words
  const slug = name
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  try {
    const { rows } = await pool.query(
      'INSERT INTO categories (name, slug, color) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, color]
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists' });
    console.error('POST /admin/categories:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/categories/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid category ID' });

  try {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE categoryid = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Category is in use by existing tasks' });
    console.error('DELETE /admin/categories:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
