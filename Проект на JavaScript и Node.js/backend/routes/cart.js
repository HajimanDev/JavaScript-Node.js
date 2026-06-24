const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
        const result = await pool.query(
            `SELECT c.id, c.product_id, c.quantity, p.name, p.price 
             FROM cart c 
             JOIN products p ON c.product_id = p.id 
             WHERE c.user_id = $1`,
            [token]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    
    const { product_id, quantity } = req.body;
    
    try {
        const existing = await pool.query(
            'SELECT * FROM cart WHERE user_id = $1 AND product_id = $2',
            [token, product_id]
        );
        
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE cart SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3',
                [quantity, token, product_id]
            );
        } else {
            await pool.query(
                'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)',
                [token, product_id, quantity]
            );
        }
        
        res.json({ message: 'Товар добавлен в корзину' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    
    const { quantity } = req.body;
    
    try {
        await pool.query(
            'UPDATE cart SET quantity = $1 WHERE id = $2 AND user_id = $3',
            [quantity, req.params.id, token]
        );
        res.json({ message: 'Обновлено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
        await pool.query('DELETE FROM cart WHERE id = $1 AND user_id = $2', [req.params.id, token]);
        res.json({ message: 'Удалено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/checkout', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    
    const { address, phone } = req.body;
    
    try {
        const cartItems = await pool.query(
            `SELECT c.product_id, c.quantity, p.price 
             FROM cart c 
             JOIN products p ON c.product_id = p.id 
             WHERE c.user_id = $1`,
            [token]
        );
        
        if (cartItems.rows.length === 0) {
            return res.status(400).json({ error: 'Корзина пуста' });
        }
        
        let total = 0;
        for (let item of cartItems.rows) {
            total += Number(item.price) * item.quantity;
        }
        
        const statusResult = await pool.query(
            "SELECT id FROM order_statuses WHERE name = 'Новый'"
        );
        const statusId = statusResult.rows[0].id;
        
        const orderResult = await pool.query(
            'INSERT INTO orders (user_id, total_amount, address, phone, status_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [token, total, address, phone, statusId]
        );
        
        const orderId = orderResult.rows[0].id;
        
        for (let item of cartItems.rows) {
            await pool.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.product_id, item.quantity, item.price]
            );
        }
        
        await pool.query('DELETE FROM cart WHERE user_id = $1', [token]);
        
        res.json({ message: 'Заказ оформлен', orderId: orderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;