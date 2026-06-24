const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/register', async (req, res) => {
    const { username, email, password, special_code } = req.body;
    
    try {
        let role = 'user';
        if (special_code === 'admin1') {
            role = 'admin';
        }
        
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, special_code, role_id) 
             VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name=$5)) 
             RETURNING id`,
            [username, email, password, special_code || '000000', role]
        );
        
        res.json({ message: 'OK', role, userId: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, r.name as role 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.username = $1 AND u.password_hash = $2`,
            [username, password]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Неверные данные' });
        }
        
        const user = result.rows[0];
        res.json({ token: user.id, username: user.username, role: user.role });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/me', async (req, res) => {
    const token = req.headers.authorization;
    
    try {
        const result = await pool.query(
            `SELECT u.username, r.name as role 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.id = $1`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Не авторизован' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;