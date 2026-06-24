CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    special_code VARCHAR(10) DEFAULT '000000',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0)
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0)
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0)
);

INSERT INTO roles (name) VALUES ('admin'), ('user');



CREATE TABLE IF NOT EXISTS order_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO order_statuses (name) VALUES 
('Новый'), 
('В обработке'), 
('Доставка'), 
('Выполнен'), 
('Отменен')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_id INTEGER REFERENCES order_statuses(id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

UPDATE orders SET status_id = (SELECT id FROM order_statuses WHERE name = 'Новый') 
WHERE status_id IS NULL;

CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

ALTER TABLE orders ALTER COLUMN status_id SET NOT NULL;

INSERT INTO users (username, email, password_hash, role_id, special_code) VALUES
('admin', 'admin@shop.ru', 'hash_admin', 1, 'admin1'),
('ivan', 'ivan@mail.ru', 'hash_ivan', 2, '000000'),
('petr', 'petr@mail.ru', 'hash_petr', 2, '000000');

INSERT INTO products (name, price, stock_quantity) VALUES
('Ноутбук ASUS', 50000.00, 10),
('Смартфон Samsung', 30000.00, 25),
('iPhone 15', 80000.00, 5);

INSERT INTO orders (user_id, total_amount) VALUES
(2, 80000.00),
(3, 30000.00);

INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 3, 1, 80000.00),
(2, 2, 1, 30000.00);

CREATE OR REPLACE FUNCTION assign_role_by_code()
RETURNS TRIGGER AS $$
DECLARE
    admin_role_id INTEGER;
    user_role_id INTEGER;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    SELECT id INTO user_role_id FROM roles WHERE name = 'user';
    
    IF NEW.special_code IS NULL OR NEW.special_code = '' THEN
        NEW.special_code := '000000';
    END IF;
    
    IF NEW.special_code = 'admin1' THEN
        NEW.role_id := admin_role_id;
    ELSE
        NEW.role_id := user_role_id;
        IF NEW.special_code != '000000' THEN
            NEW.special_code := '000000';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_role_before_insert
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_role_by_code();

SELECT * FROM users



ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS product_tags (
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE IF NOT EXISTS product_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    view_duration INTEGER DEFAULT 0,
    view_start TIMESTAMP,
    view_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_interests (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    weight DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE IF NOT EXISTS user_bubble_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    radical_level DECIMAL(5,2) DEFAULT 0,
    bubble_broken BOOLEAN DEFAULT FALSE,
    broken_until TIMESTAMP,
    total_actions INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendation_cache (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_ids INTEGER[],
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tags (name) VALUES 
    ('игровые'), ('офисные'), ('бюджетные'), ('премиум'), 
    ('apple'), ('windows'), ('android'), ('ноутбуки'), 
    ('пк'), ('периферия'), ('мониторы'), ('ультрабуки')
ON CONFLICT (name) DO NOTHING;

INSERT INTO product_tags (product_id, tag_id) 
SELECT p.id, t.id FROM products p, tags t 
WHERE p.name = 'Ноутбук ASUS' AND t.name IN ('игровые', 'windows', 'премиум', 'ноутбуки')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id) 
SELECT p.id, t.id FROM products p, tags t 
WHERE p.name = 'Смартфон Samsung' AND t.name IN ('офисные', 'android', 'бюджетные')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id) 
SELECT p.id, t.id FROM products p, tags t 
WHERE p.name = 'iPhone 15' AND t.name IN ('apple', 'премиум')
ON CONFLICT DO NOTHING;


INSERT INTO products (name, price, stock_quantity, description) VALUES
('Игровой ноутбук ASUS ROG Strix G18', 129990, 8, '18-дюймовый ноутбук с Intel Core i9-13980HX, RTX 4080, 32GB DDR5, 1TB SSD'),
('Игровая видеокарта RTX 4090', 189990, 3, 'NVIDIA GeForce RTX 4090 24GB GDDR6X, поддержка DLSS 3'),
('Игровая мышь Logitech G Pro X Superlight', 15990, 25, 'Беспроводная мышь весом 63 грамма, сенсор Hero 25K'),
('Механическая клавиатура Razer BlackWidow V4', 22990, 12, 'Оптические переключатели, RGB подсветка, магнитный подлокотник'),
('Игровой монитор ASUS ROG Swift 360Hz', 69990, 5, '24.5 дюймов, 360Hz, 1ms, G-Sync, HDR 400'),
('Игровой ПК HyperPC Xtreme', 249990, 4, 'Intel Core i9-14900K, RTX 4090, 64GB DDR5, 2TB NVMe'),
('Геймерское кресло Cougar Armor S', 34990, 15, 'Эргономичное кресло с поясничной поддержкой, стальной каркас'),
('Игровая гарнитура SteelSeries Arctis Nova Pro', 32990, 18, 'Беспроводная, активное шумоподавление, двойная батарея'),

('Офисный ноутбук Lenovo ThinkPad E16', 65990, 20, 'Intel Core i5-1335U, 16GB RAM, 512GB SSD, 16 дюймов IPS'),
('Моноблок HP All-in-One 24', 54990, 10, '23.8 дюймов, Intel Core i5, 8GB RAM, 256GB SSD, Windows 11 Pro'),
('Офисная клавиатура Logitech MK235', 3990, 45, 'Беспроводной комплект клавиатура+мышь, радиус 10 метров'),
('Документ-камера AVerVision F50', 45990, 6, '5MP, автофокус, 8x зум, поддержка HDMI и USB'),
('Сетевой накопитель QNAP TS-464', 41990, 7, '4 отсека, Intel Celeron N5095, 4GB RAM, 2.5GbE порты'),
('Офисный принтер Xerox B210', 15990, 12, 'Монохромный лазерный, скорость 31 стр/мин, автоподатчик'),
('Сканер Epson DS-320', 25990, 8, 'Двустороннее сканирование, скорость 25 стр/мин, автоподатчик 20 листов'),
('Конференц-система Yealink CP900', 28990, 15, 'USB-спикерфон для конференций, шумоподавление, 360 микрофон'),

('Бюджетный ноутбук Acer Aspire 3', 34990, 30, 'AMD Ryzen 3, 8GB RAM, 256GB SSD, 15.6 дюймов'),
('Экономный ПК DEPO Neo 230', 25990, 18, 'Intel Celeron, 4GB RAM, 128GB SSD, офисный ПК'),
('Доступная мышь Defender Element', 590, 100, 'Оптическая мышь, 3 кнопки, USB, 1600 DPI'),
('Бюджетная клавиатура Genius K620', 890, 85, 'Проводная мембранная клавиатура, тихие клавиши'),
('Бюджетный монитор Samsung LF22T35', 10990, 22, '21.5 дюймов, 75Hz, IPS, FHD, AMD FreeSync'),
('Доступные наушники SVEN AP-880M', 1290, 67, 'Затычные наушники с микрофоном, качественный бас'),
('Бюджетный веб-камера Canyon CND-SWC10', 1990, 42, '720p, встроенный микрофон, крепление на монитор'),
('Дешёвый роутер TP-Link TL-WR841N', 2590, 35, '300 Мбит/с, 4 порта LAN, внешние антенны'),

('Премиум ноутбук Apple MacBook Pro 16 M3 Max', 399990, 6, 'M3 Max (16 ядер CPU, 40 ядер GPU), 48GB RAM, 1TB SSD'),
('Премиум смартфон Samsung Galaxy S24 Ultra', 129990, 15, '8GB RAM, 512GB, 200MP камера, S Pen, Titanium корпус'),
('Премиум ПК Apple Mac Studio M2 Ultra', 349990, 4, '24 ядра CPU, 76 ядер GPU, 64GB RAM, 1TB SSD'),
('Премиум монитор Apple Pro Display XDR', 599990, 2, '32 дюймов, 6K Retina, HDR1600, nano-texture стекло'),
('Премиум клавиатура Logitech MX Mechanical', 17990, 20, 'Механическая, беспроводная, подсветка, металлический корпус'),
('Премиум мышь Apple Magic Mouse 3', 10990, 25, 'Многоцветный дизайн, USB-C, сенсорная поверхность'),
('Премиум гарнитура Sony WH-1000XM5', 38990, 30, 'Беспроводные, активное шумоподавление, 30 часов работы'),
('Премиум док-станция CalDigit TS4', 45990, 8, 'Thunderbolt 4, 18 портов, поддержка 8K, 98W зарядка'),

('Apple iPhone 15 Pro Max', 159990, 20, '6.7 дюймов, A17 Pro, 256GB, Titanium, USB-C'),
('Apple iPad Pro 12.9 M2', 119990, 12, '12.9 дюймов Liquid Retina XDR, M2 чип, 256GB'),
('Apple Watch Ultra 2', 79990, 18, '49mm титановый корпус, GPS+LTE, водонепроницаемые 100m'),
('Apple AirPods Pro 2', 28990, 40, 'Активное шумоподавление, персонализированный пространственный звук'),
('Apple MacBook Air 15 M3', 149990, 15, '15.3 дюймов Liquid Retina, M3, 16GB RAM, 512GB SSD'),
('Apple TV 4K 128GB', 15990, 25, 'A15 Bionic, поддержка HDR10+, Dolby Vision, Thread'),
('Apple Magic Keyboard for iPad', 29990, 10, 'Плавающая консоль, подсветка, трекпад'),

('Ноутбук Dell XPS 15', 179990, 8, 'Intel Core i7-13700H, RTX 4060, 32GB, 1TB SSD, OLED'),
('Ноутбук HP Spectre x360 14', 134990, 10, 'Intel Core i7-1355U, 16GB, 512GB SSD, OLED сенсорный'),
('Ноутбук MSI Stealth 17 Studio', 189990, 6, 'Intel Core i9-13900H, RTX 4080, 32GB, 2TB SSD'),
('Ноутбук ASUS Zenbook S 13 OLED', 119990, 12, 'AMD Ryzen 7, 16GB, 1TB SSD, OLED 3K, 1кг вес'),
('Ноутбук Lenovo Legion Pro 7', 159990, 9, 'AMD Ryzen 9, RTX 4070, 32GB, 1TB SSD, 240Hz'),

('Коврик для мыши Razer Gigantus V2', 2990, 45, 'Размер 3XL, прорезиненное основание, ткань с микротекстурой'),
('USB-хаб Orico 7 портов', 1590, 55, 'USB 3.0, 7 портов, отдельный выключатель, питание 12V'),
('Подставка для ноутбука Thunderobot', 3990, 32, 'Алюминиевая, регулировка высоты, складная'),
('Крепление для монитора Ergostar', 4990, 28, 'Газлифт, 2 монитора, до 27 дюймов'),
('Кабель USB-C 100W Belkin', 1990, 80, '2 метра, оплетка, поддержка быстрой зарядки'),
('Салфетки для экрана Defender', 390, 120, '30 штук, антистатик, микрофибра'),
('Блок бесперебойного питания APC BX500', 7990, 15, '500VA/300W, 6 розеток, защита от скачков'),

('Монитор для дизайна BenQ PD2700U', 49990, 7, '27 дюймов 4K, 100% sRGB, заводская калибровка'),
('Игровой монитор MSI G274QPF', 35990, 14, '27 дюймов 170Hz, Rapid IPS, 1ms, G-Sync'),
('Ультраширокий монитор LG 34GP63A', 59990, 6, '34 дюйма 160Hz, 3440x1440, HDR10, AMD FreeSync'),
('Портативный монитор ASUS ZenScreen', 19990, 11, '15.6 дюймов, USB-C, чехол-подставка, 1080p'),
('Монитор для офиса Dell P2422H', 17990, 20, '24 дюйма, IPS, 75Hz, регулировка по высоте'),

('Материнская плата ASUS ROG Maximus Z790', 55990, 5, 'Z790 чипсет, DDR5, PCIe 5.0, WiFi 6E'),
('Процессор Intel Core i9-14900K', 64990, 8, '24 ядра (8P+16E), до 6.0 GHz, 36MB L3'),
('Оперативная память Kingston Fury 64GB', 18990, 20, 'DDR5, 6000MHz, RGB подсветка, комплект 2x32GB'),
('SSD накопитель Samsung 990 Pro 2TB', 19990, 15, 'NVMe PCIe 4.0, скорость 7450/6900 MB/s'),
('Блок питания Corsair RM1000e', 17990, 12, '1000W, 80+ Gold, полностью модульный'),
('Кулер для процессора Noctua NH-D15', 11990, 10, 'Два вентилятора 140mm, тихий, поддержка LGA1700'),

('Смартфон Google Pixel 8 Pro', 89990, 12, 'Tensor G3, 128GB, 50MP камера, 5 лет обновлений'),
('Смартфон Xiaomi 14 Ultra', 114990, 8, 'Leica камера 4 модуля, 120x зум, Snapdragon 8 Gen 3'),
('Смартфон OnePlus 12', 79990, 15, '16GB RAM, 512GB, 100W зарядка, 120Hz LTPO экран'),
('Смартфон Nothing Phone 2', 54990, 18, 'Glyph интерфейс, Snapdragon 8+, 12GB RAM, 256GB'),
('Смартфон Realme GT 5 Pro', 49990, 22, 'Snapdragon 8 Gen 2, 150W зарядка, 108MP камера'),

('Телевизор LG OLED C3 65', 199990, 5, '65 дюймов 4K OLED, 120Hz, G-Sync, webOS'),
('Телевизор Samsung Neo QLED 8K', 299990, 3, '75 дюймов, Quantum Mini LED, 8K, Neural Processor'),
('Саундбар Sony HT-A7000', 89990, 6, '7.1.2 каналов, Dolby Atmos, 8K HDMI pass-through'),
('Умная колонка Яндекс Станция Max 2', 26990, 25, 'Звук 50W, ZVL, управление голосом, Zigbee'),
('Портативная колонка JBL Charge 5', 12990, 35, '20W, 20 часов работы, защита IP67, power bank');


INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%игровой%' AND t.name IN ('игровые', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Razer%' AND t.name IN ('игровые', 'периферия')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%ROG%' AND t.name IN ('игровые', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%офисный%' AND t.name IN ('офисные', 'бюджетные')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%ThinkPad%' AND t.name IN ('офисные', 'windows', 'ноутбуки')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%бюджетный%' AND t.name IN ('бюджетные')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Acer Aspire%' AND t.name IN ('бюджетные', 'ноутбуки')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Defender Element%' AND t.name IN ('бюджетные', 'периферия')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Apple%' AND t.name IN ('apple', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%MacBook%' AND t.name IN ('apple', 'премиум', 'ноутбуки')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%iPhone%' AND t.name IN ('apple', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Dell XPS%' AND t.name IN ('windows', 'премиум', 'ноутбуки')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%HP Spectre%' AND t.name IN ('windows', 'премиум', 'ноутбуки')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%MSI Stealth%' AND t.name IN ('windows', 'игровые', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Pixel%' AND t.name IN ('android', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%Xiaomi%' AND t.name IN ('android', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%OnePlus%' AND t.name IN ('android', 'премиум')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%мышь%' AND t.name IN ('периферия')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%клавиатура%' AND t.name IN ('периферия')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%монитор%' AND t.name IN ('мониторы')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%процессор%' AND t.name IN ('пк')
ON CONFLICT DO NOTHING;

INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id 
FROM products p, tags t 
WHERE p.name LIKE '%SSD%' AND t.name IN ('пк')
ON CONFLICT DO NOTHING;

INSERT INTO users (username, email, password_hash, role_id, special_code) VALUES
('gamer_pro', 'gamer@example.com', 'hash_gamer', 2, '000000'),
('office_worker', 'office@example.com', 'hash_office', 2, '000000'),
('apple_fan', 'apple@example.com', 'hash_apple', 2, '000000'),
('budget_user', 'budget@example.com', 'hash_budget', 2, '000000')
ON CONFLICT (username) DO NOTHING;


DO $$
DECLARE
    gamer_id INTEGER;
    product_rec RECORD;
BEGIN
    SELECT id INTO gamer_id FROM users WHERE username = 'gamer_pro';
    
    FOR product_rec IN 
        SELECT p.id FROM products p 
        JOIN product_tags pt ON pt.product_id = p.id
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.name IN ('игровые') 
        LIMIT 8
    LOOP
        INSERT INTO product_likes (user_id, product_id, created_at) 
        VALUES (gamer_id, product_rec.id, NOW() - (random() * interval '30 days'))
        ON CONFLICT DO NOTHING;
        
        INSERT INTO user_interests (user_id, tag_id, weight)
        SELECT gamer_id, t.id, 15 
        FROM tags t WHERE t.name = 'игровые'
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    UPDATE user_bubble_state 
    SET radical_level = 65, total_actions = 14
    WHERE user_id = gamer_id;
END $$;

DO $$
DECLARE
    office_id INTEGER;
BEGIN
    SELECT id INTO office_id FROM users WHERE username = 'office_worker';
    
    INSERT INTO user_interests (user_id, tag_id, weight)
    SELECT office_id, t.id, 12 
    FROM tags t WHERE t.name IN ('офисные', 'бюджетные')
    ON CONFLICT DO NOTHING;
    
    UPDATE user_bubble_state 
    SET radical_level = 20, total_actions = 5
    WHERE user_id = office_id;
END $$;

DO $$
DECLARE
    apple_id INTEGER;
BEGIN
    SELECT id INTO apple_id FROM users WHERE username = 'apple_fan';
    
    INSERT INTO user_interests (user_id, tag_id, weight)
    SELECT apple_id, t.id, 20 
    FROM tags t WHERE t.name IN ('apple', 'премиум')
    ON CONFLICT DO NOTHING;
    
    UPDATE user_bubble_state 
    SET radical_level = 80, total_actions = 22
    WHERE user_id = apple_id;
END $$;

DO $$
DECLARE
    budget_id INTEGER;
BEGIN
    SELECT id INTO budget_id FROM users WHERE username = 'budget_user';
    
    INSERT INTO user_interests (user_id, tag_id, weight)
    SELECT budget_id, t.id, 18 
    FROM tags t WHERE t.name = 'бюджетные'
    ON CONFLICT DO NOTHING;
    
    UPDATE user_bubble_state 
    SET radical_level = 45, total_actions = 9
    WHERE user_id = budget_id;
END $$;
