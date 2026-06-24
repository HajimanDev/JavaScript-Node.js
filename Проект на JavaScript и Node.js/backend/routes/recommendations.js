const express = require('express');
const router = express.Router();
const pool = require('../db');

async function getProductTags(productId) {
    const result = await pool.query(
        `SELECT t.id, t.name FROM tags t
         JOIN product_tags pt ON pt.tag_id = t.id
         WHERE pt.product_id = $1`,
        [productId]
    );
    return result.rows;
}

async function updateUserInterests(userId, productId, actionWeight) {
    const tags = await getProductTags(productId);
    
    for (const tag of tags) {
        await pool.query(
            `INSERT INTO user_interests (user_id, tag_id, weight, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id, tag_id) 
             DO UPDATE SET weight = user_interests.weight + $3, updated_at = NOW()`,
            [userId, tag.id, actionWeight]
        );
    }
    
    await pool.query(
        `INSERT INTO user_bubble_state (user_id, total_actions, radical_level, updated_at)
         VALUES ($1, 1, 0, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET total_actions = user_bubble_state.total_actions + 1, updated_at = NOW()`,
        [userId]
    );
    
    const state = await pool.query(
        `SELECT total_actions, radical_level FROM user_bubble_state WHERE user_id = $1`,
        [userId]
    );
    
    if (state.rows[0]?.total_actions >= 10 && state.rows[0]?.radical_level < 50) {
        await pool.query(
            `UPDATE user_bubble_state 
             SET radical_level = LEAST(100, radical_level + 20)
             WHERE user_id = $1`,
            [userId]
        );
    }
}

router.get('/feed', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const { limit = 20, force_random = false } = req.query;
    
    try {
        const bubbleState = await pool.query(
            `SELECT bubble_broken, broken_until, radical_level 
             FROM user_bubble_state WHERE user_id = $1`,
            [userId]
        );
        
        const isBroken = bubbleState.rows[0]?.bubble_broken === true && 
                        new Date() < new Date(bubbleState.rows[0]?.broken_until);
        const radicalLevel = bubbleState.rows[0]?.radical_level || 0;
        
        let products = [];
        
        if (force_random === 'true' || isBroken) {
            const result = await pool.query(
                `SELECT p.*, array_agg(DISTINCT t.name) as tags
                 FROM products p
                 LEFT JOIN product_tags pt ON pt.product_id = p.id
                 LEFT JOIN tags t ON t.id = pt.tag_id
                 GROUP BY p.id
                 ORDER BY RANDOM()
                 LIMIT $1`,
                [limit]
            );
            products = result.rows;
        } else {
            const interests = await pool.query(
                `SELECT tag_id, weight FROM user_interests 
                 WHERE user_id = $1 ORDER BY weight DESC`,
                [userId]
            );
            
            if (interests.rows.length === 0) {
                const result = await pool.query(
                    `SELECT p.*, array_agg(DISTINCT t.name) as tags
                     FROM products p
                     LEFT JOIN product_tags pt ON pt.product_id = p.id
                     LEFT JOIN tags t ON t.id = pt.tag_id
                     GROUP BY p.id
                     ORDER BY p.id
                     LIMIT $1`,
                    [limit]
                );
                products = result.rows;
            } else {
                const tagIds = interests.rows.map(i => i.tag_id);
                const query = `
                    SELECT p.*, array_agg(DISTINCT t.name) as tags,
                           SUM(ui.weight) as relevance_score
                    FROM products p
                    JOIN product_tags pt ON pt.product_id = p.id
                    JOIN tags t ON t.id = pt.tag_id
                    JOIN user_interests ui ON ui.tag_id = pt.tag_id
                    WHERE ui.user_id = $1 AND pt.tag_id = ANY($2::int[])
                    GROUP BY p.id
                    ORDER BY relevance_score DESC
                    LIMIT $3
                `;
                
                const result = await pool.query(query, [userId, tagIds, limit]);
                products = result.rows;
            }
            
            if (radicalLevel > 50) {
                const topTagId = interests.rows[0]?.tag_id;
                if (topTagId) {
                    const topTag = await pool.query('SELECT name FROM tags WHERE id = $1', [topTagId]);
                    const topTagName = topTag.rows[0]?.name;
                    products = products.filter(p => 
                        p.tags && p.tags.includes(topTagName)
                    );
                }
            }
        }
        
        res.json({
            products: products,
            bubble_state: {
                radical_level: radicalLevel,
                is_broken: isBroken,
                broken_until: bubbleState.rows[0]?.broken_until
            }
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/like/:productId', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const { productId } = req.params;
    
    try {
        await pool.query(
            `INSERT INTO product_likes (user_id, product_id, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id, product_id) DO NOTHING`,
            [userId, productId]
        );
        
        await updateUserInterests(userId, productId, 2.0);
        
        res.json({ message: 'Лайк добавлен' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/view/start/:productId', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const { productId } = req.params;
    
    try {
        const result = await pool.query(
            `INSERT INTO product_views (user_id, product_id, view_start, created_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING id`,
            [userId, productId]
        );
        res.json({ viewId: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/view/end/:viewId', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const { viewId } = req.params;
    const { duration } = req.body;
    
    try {
        await pool.query(
            `UPDATE product_views 
             SET view_duration = $1, view_end = NOW()
             WHERE id = $2 AND user_id = $3`,
            [duration, viewId, userId]
        );
        
        const view = await pool.query(
            `SELECT product_id FROM product_views WHERE id = $1 AND user_id = $2`,
            [viewId, userId]
        );
        
        if (view.rows[0] && duration > 3) {
            await updateUserInterests(userId, view.rows[0].product_id, duration / 10);
        }
        
        res.json({ message: 'Просмотр завершён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/break-bubble', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const { duration_seconds = 15 } = req.body;
    
    try {
        await pool.query(
            `INSERT INTO user_bubble_state (user_id, bubble_broken, broken_until, updated_at)
             VALUES ($1, true, NOW() + ($2 || ' seconds')::INTERVAL, NOW())
             ON CONFLICT (user_id) 
             DO UPDATE SET bubble_broken = true, broken_until = NOW() + ($2 || ' seconds')::INTERVAL`,
            [userId, duration_seconds]
        );
        
        res.json({ message: 'Пузырь сломан на ' + duration_seconds + ' секунд' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/reset-bubble', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
        await pool.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM product_likes WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_bubble_state WHERE user_id = $1', [userId]);
        
        res.json({ message: 'Пузырь сброшен' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/bubble-stats', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
        const interests = await pool.query(
            `SELECT t.name, ui.weight 
             FROM user_interests ui
             JOIN tags t ON t.id = ui.tag_id
             WHERE ui.user_id = $1
             ORDER BY ui.weight DESC`,
            [userId]
        );
        
        const likes = await pool.query(
            `SELECT COUNT(*) FROM product_likes WHERE user_id = $1`,
            [userId]
        );
        
        const views = await pool.query(
            `SELECT COALESCE(SUM(view_duration), 0) as total_time 
             FROM product_views WHERE user_id = $1`,
            [userId]
        );
        
        const state = await pool.query(
            `SELECT * FROM user_bubble_state WHERE user_id = $1`,
            [userId]
        );
        
        res.json({
            interests: interests.rows,
            total_likes: parseInt(likes.rows[0].count) || 0,
            total_view_time: parseInt(views.rows[0].total_time) || 0,
            bubble_state: state.rows[0] || { radical_level: 0, bubble_broken: false }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/compare/:userId1/:userId2', async (req, res) => {
    const adminId = req.headers.authorization;
    if (!adminId) return res.status(401).json({ error: 'Не авторизован' });
    
    const adminCheck = await pool.query(
        `SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [adminId]
    );
    
    if (adminCheck.rows[0]?.name !== 'admin') {
        return res.status(403).json({ error: 'Нет прав' });
    }
    
    const { userId1, userId2 } = req.params;
    
    try {
        const getUserStats = async (userId) => {
            const interests = await pool.query(
                `SELECT t.name, ui.weight 
                 FROM user_interests ui
                 JOIN tags t ON t.id = ui.tag_id
                 WHERE ui.user_id = $1`,
                [userId]
            );
            
            const likes = await pool.query(
                `SELECT COUNT(*) FROM product_likes WHERE user_id = $1`,
                [userId]
            );
            
            const state = await pool.query(
                `SELECT * FROM user_bubble_state WHERE user_id = $1`,
                [userId]
            );
            
            return {
                interests: interests.rows,
                total_likes: parseInt(likes.rows[0].count) || 0,
                bubble_state: state.rows[0] || { radical_level: 0 }
            };
        };
        
        const [user1, user2] = await Promise.all([
            getUserStats(userId1),
            getUserStats(userId2)
        ]);
        
        res.json({ user1, user2 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/random-event', async (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });
    
    const events = [
        { type: 'price_drop', message: 'ВНЕЗАПНО: Скидка 30 на все игровые ноутбуки', tag_boost: 'игровые' },
        { type: 'new_product', message: 'Apple выпустила новый MacBook по невероятной цене', tag_boost: 'apple' },
        { type: 'shortage', message: 'Дефицит: процессоры Intel заканчиваются', tag_boost: 'windows' },
        { type: 'trend', message: 'Тренд: офисные ПК снова в моде', tag_boost: 'офисные' },
        { type: 'scandal', message: 'Скандал: производители завышают цены', tag_boost: null }
    ];
    
    const event = events[Math.floor(Math.random() * events.length)];
    
    if (event.tag_boost) {
        const tagResult = await pool.query('SELECT id FROM tags WHERE name = $1', [event.tag_boost]);
        if (tagResult.rows[0]) {
            await pool.query(
                `INSERT INTO user_interests (user_id, tag_id, weight, updated_at)
                 VALUES ($1, $2, 5, NOW())
                 ON CONFLICT (user_id, tag_id) 
                 DO UPDATE SET weight = user_interests.weight + 5`,
                [userId, tagResult.rows[0].id]
            );
        }
    }
    
    res.json({
        event: event.message,
        tag_boosted: event.tag_boost || 'нет'
    });
});

module.exports = router;