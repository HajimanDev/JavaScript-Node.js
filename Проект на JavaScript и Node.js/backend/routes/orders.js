const express = require('express');
const router = express.Router();
const pool = require('../db');

async function isAdmin(token) {
    if (!token) return false;
    const result = await pool.query(
        `SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [token]
    );
    return result.rows[0]?.name === 'admin';
}

router.get('/', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!await isAdmin(token)) {
        return res.status(403).json({ error: 'Нет прав' });
    }
    
    try {
        const result = await pool.query(
            `SELECT o.*, u.username, os.name as status_name 
             FROM orders o 
             JOIN users u ON o.user_id = u.id 
             JOIN order_statuses os ON o.status_id = os.id 
             ORDER BY o.order_date DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/my', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
        const result = await pool.query(
            `SELECT o.*, os.name as status_name 
             FROM orders o 
             JOIN order_statuses os ON o.status_id = os.id 
             WHERE o.user_id = $1 
             ORDER BY o.order_date DESC`,
            [token]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/items', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT oi.*, p.name 
             FROM order_items oi 
             JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = $1`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/status', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!await isAdmin(token)) {
        return res.status(403).json({ error: 'Нет прав' });
    }
    
    const { status_name } = req.body;
    
    try {
        const statusResult = await pool.query(
            'SELECT id FROM order_statuses WHERE name = $1',
            [status_name]
        );
        
        if (statusResult.rows.length === 0) {
            return res.status(400).json({ error: 'Неверный статус' });
        }
        
        await pool.query(
            'UPDATE orders SET status_id = $1 WHERE id = $2',
            [statusResult.rows[0].id, req.params.id]
        );
        
        res.json({ message: 'Статус обновлен' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;