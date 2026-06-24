const API = 'http://localhost:3000';

let currentUser = null;
let currentProducts = [];
let bubbleState = null;
let comparisonActive = false;
let currentViewId = null;
let viewStartTime = null;

async function init() {
    await checkUser();
    await loadFeed();
    
    setInterval(() => {
        if (!comparisonActive) {
            loadFeed();
        }
    }, 30000);
}

async function checkUser() {
    const token = localStorage.getItem('token');
    
    if (token) {
        try {
            const res = await fetch(`${API}/auth/me`, {
                headers: { 'Authorization': token }
            });
            
            if (res.ok) {
                currentUser = await res.json();
                document.getElementById('userInfo').innerHTML = `
                    ${currentUser.username} (${currentUser.role}) 
                    <button onclick="logout()">Выйти</button>
                `;
            } else {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
            }
        } catch (error) {
            window.location.href = '/login.html';
        }
    } else {
        window.location.href = '/login.html';
    }
}

function logout() {
    localStorage.removeItem('token');
    location.href = '/';
}

async function loadFeed() {
    const token = localStorage.getItem('token');
    const forceRandom = document.getElementById('forceRandomCheckbox')?.checked || false;
    
    try {
        const url = forceRandom ? 
            `${API}/recommendations/feed?force_random=true` : 
            `${API}/recommendations/feed`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': token }
        });
        
        const data = await res.json();
        currentProducts = data.products;
        bubbleState = data.bubble_state;
        
        displayProducts(currentProducts);
        updateBubbleUI();
        
    } catch (error) {
        console.error('Ошибка загрузки ленты:', error);
        showNotification('Ошибка загрузки ленты', 'error');
    }
}

function displayProducts(products) {
    const container = document.getElementById('products');
    container.innerHTML = '';
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="loading">Нет товаров для отображения</div>';
        return;
    }
    
    for (const product of products) {
        const tags = product.tags || [];
        const isRadical = bubbleState?.radical_level > 50;
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-id', product.id);
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <h3>${escapeHtml(product.name)}</h3>
                ${isRadical && tags.length > 0 ? '<span class="recommended-badge">РАДИКАЛЬНО</span>' : ''}
            </div>
            <div class="product-tags">
                ${tags.map(tag => `<span class="product-tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
            <p class="price">${Number(product.price).toLocaleString()} ₽</p>
            <p class="stock">В наличии: ${product.stock_quantity} шт.</p>
            ${product.description ? `<p style="font-size: 13px; color: #aaa;">${escapeHtml(product.description)}</p>` : ''}
            <div class="btn-group">
                <button class="btn-small btn-like" onclick="likeProduct(${product.id})">Лайк</button>
                <button class="btn-small" onclick="addToCart(${product.id})">В корзину</button>
            </div>
        `;
        
        card.addEventListener('mouseenter', () => startViewTimer(product.id));
        card.addEventListener('mouseleave', () => endViewTimer());
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                viewProductDetails(product);
            }
        });
        
        container.appendChild(card);
    }
}

async function likeProduct(productId) {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API}/recommendations/like/${productId}`, {
            method: 'POST',
            headers: { 'Authorization': token }
        });
        
        if (res.ok) {
            showNotification('Лайк добавлен. Алгоритм учёл это.', 'success');
            await loadFeed();
        } else {
            showNotification('Ошибка при добавлении лайка', 'error');
        }
    } catch (error) {
        console.error(error);
    }
}

async function addToCart(productId) {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });
        
        if (res.ok) {
            showNotification('Товар добавлен в корзину', 'success');
        } else {
            showNotification('Ошибка при добавлении', 'error');
        }
    } catch (error) {
        console.error(error);
    }
}

async function startViewTimer(productId) {
    const token = localStorage.getItem('token');
    viewStartTime = Date.now();
    
    try {
        const res = await fetch(`${API}/recommendations/view/start/${productId}`, {
            method: 'POST',
            headers: { 'Authorization': token }
        });
        
        const data = await res.json();
        if (data.viewId) {
            currentViewId = data.viewId;
        }
    } catch (error) {
        console.error(error);
    }
}

async function endViewTimer() {
    if (viewStartTime && currentViewId) {
        const duration = Math.floor((Date.now() - viewStartTime) / 1000);
        if (duration >= 2) {
            const token = localStorage.getItem('token');
            try {
                await fetch(`${API}/recommendations/view/end/${currentViewId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify({ duration })
                });
            } catch (error) {
                console.error(error);
            }
        }
        viewStartTime = null;
        currentViewId = null;
    }
}

function viewProductDetails(product) {
    alert(`Товар: ${product.name}\n\nЦена: ${product.price} ₽\nТеги: ${(product.tags || []).join(', ')}\n\n${product.description || 'Нет описания'}\n\nПросмотр влияет на ваш информационный пузырь`);
}

async function updateBubbleUI() {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API}/recommendations/bubble-stats`, {
            headers: { 'Authorization': token }
        });
        
        const data = await res.json();
        
        const radicalLevel = data.bubble_state?.radical_level || 0;
        const isBroken = data.bubble_state?.bubble_broken || false;
        
        const statusDiv = document.getElementById('bubbleStatus');
        statusDiv.innerHTML = `
            <div>
                <strong>Радикализация:</strong> ${radicalLevel}% 
                ${radicalLevel > 50 ? 'АКТИВНА' : radicalLevel > 25 ? 'УМЕРЕННАЯ' : 'НИЗКАЯ'}
                <br>
                <strong>Всего действий:</strong> лайков: ${data.total_likes}, просмотров: ${Math.floor(data.total_view_time / 60)} мин
                <br>
                <strong>Режим пузыря:</strong> ${isBroken ? 'СЛОМАН' : 'активен'}
            </div>
            <div class="radical-bar">
                <div class="radical-fill" style="width: ${radicalLevel}%"></div>
            </div>
        `;
        
        const topicsDiv = document.getElementById('topicPreferences');
        if (data.interests && data.interests.length > 0) {
            topicsDiv.innerHTML = data.interests.map(i => 
                `<span class="topic-tag ${i.weight > 5 ? 'high' : ''}">${escapeHtml(i.name)}: ${Math.floor(i.weight * 10)}%</span>`
            ).join('');
        } else {
            topicsDiv.innerHTML = '<span class="topic-tag">Нет данных - лайкайте товары</span>';
        }
        
        const algoInfo = document.getElementById('algorithmInfo');
        if (isBroken) {
            algoInfo.innerHTML = 'РЕЖИМ СВОБОДЫ: алгоритмы отключены, весь ассортимент доступен';
            algoInfo.style.color = '#4ecdc4';
        } else if (radicalLevel > 50) {
            algoInfo.innerHTML = 'РАДИКАЛЬНЫЙ РЕЖИМ: показываются только товары из ваших категорий';
            algoInfo.style.color = '#ff6b6b';
        } else {
            algoInfo.innerHTML = 'Скрытые алгоритмы: персонализация на основе лайков, просмотров и покупок';
            algoInfo.style.color = '#888';
        }
        
    } catch (error) {
        console.error(error);
    }
}

async function breakBubble() {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API}/recommendations/break-bubble`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ duration_seconds: 15 })
        });
        
        if (res.ok) {
            showNotification('ПУЗЫРЬ СЛОМАН на 15 секунд', 'warning');
            await loadFeed();
        }
    } catch (error) {
        console.error(error);
    }
}

async function resetBubble() {
    if (!confirm('Сбросить весь информационный пузырь? Все лайки и история будут удалены.')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API}/recommendations/reset-bubble`, {
            method: 'POST',
            headers: { 'Authorization': token }
        });
        
        if (res.ok) {
            showNotification('Пузырь сброшен. Начните заново.', 'success');
            await loadFeed();
            await updateBubbleUI();
        }
    } catch (error) {
        console.error(error);
    }
}

async function triggerRandomEvent() {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${API}/recommendations/random-event`, {
            method: 'POST',
            headers: { 'Authorization': token }
        });
        
        const data = await res.json();
        showNotification(`СОБЫТИЕ: ${data.event}`, 'event');
        await loadFeed();
        await updateBubbleUI();
    } catch (error) {
        console.error(error);
    }
}

async function toggleComparison() {
    comparisonActive = !comparisonActive;
    const comparisonDiv = document.getElementById('comparisonView');
    const productsDiv = document.getElementById('products');
    const filterSection = document.querySelector('.filter-section');
    
    if (comparisonActive) {
        comparisonDiv.style.display = 'block';
        productsDiv.style.display = 'none';
        if (filterSection) filterSection.style.display = 'none';
        document.getElementById('compareBtn').style.background = '#4ecdc4';
        await loadComparison();
    } else {
        comparisonDiv.style.display = 'none';
        productsDiv.style.display = 'flex';
        if (filterSection) filterSection.style.display = 'block';
        document.getElementById('compareBtn').style.background = '';
        await loadFeed();
    }
}

async function loadComparison() {
    const token = localStorage.getItem('token');
    
    try {
        const currentUserId = localStorage.getItem('token');
        const demoUserId = 2;
        
        const res = await fetch(`${API}/recommendations/compare/${currentUserId}/${demoUserId}`, {
            headers: { 'Authorization': token }
        });
        
        const data = await res.json();
        
        document.getElementById('userAPrefs').innerHTML = `
            <h4>Интересы:</h4>
            ${data.user1.interests.map(i => `<div>${escapeHtml(i.name)}: ${Math.floor(i.weight * 10)}%</div>`).join('') || '<div>Нет данных</div>'}
        `;
        document.getElementById('userAStats').innerHTML = `
            <div>Лайков: ${data.user1.total_likes}</div>
            <div>Радикализация: ${data.user1.bubble_state?.radical_level || 0}%</div>
        `;
        
        document.getElementById('userBPrefs').innerHTML = `
            <h4>Интересы:</h4>
            ${data.user2.interests.map(i => `<div>${escapeHtml(i.name)}: ${Math.floor(i.weight * 10)}%</div>`).join('') || '<div>Нет данных</div>'}
        `;
        document.getElementById('userBStats').innerHTML = `
            <div>Лайков: ${data.user2.total_likes}</div>
            <div>Радикализация: ${data.user2.bubble_state?.radical_level || 0}%</div>
        `;
        
    } catch (error) {
        console.error(error);
        showNotification('Ошибка загрузки сравнения', 'error');
    }
}

function filterFeed() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        displayProducts(currentProducts);
        return;
    }
    
    const filtered = currentProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
    
    displayProducts(filtered);
}

function toggleRandomMode() {
    loadFeed();
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = 'event-notification';
    
    const colors = {
        success: '#4ecdc4',
        error: '#e74c3c',
        warning: '#ff9800',
        event: '#9b59b6'
    };
    
    notification.style.background = colors[type] || '#4ecdc4';
    notification.style.color = '#fff';
    notification.innerHTML = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

init();

