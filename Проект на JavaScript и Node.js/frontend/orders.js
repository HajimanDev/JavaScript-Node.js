const API = 'http://localhost:3000';

const STATUSES = ['Новый', 'В обработке', 'Доставка', 'Выполнен', 'Отменен'];
let currentUser = null;
let draggedOrder = null;

checkUser();

async function checkUser() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    const res = await fetch(`${API}/auth/me`, {
        headers: { 'Authorization': token }
    });
    
    if (res.ok) {
        currentUser = await res.json();
        document.getElementById('userInfo').innerHTML = `${currentUser.username} (${currentUser.role}) <button onclick="logout()">Выйти</button>`;
        
        if (currentUser.role === 'admin') {
            loadAllOrders();
        } else {
            loadMyOrders();
        }
    } else {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }
}

function logout() {
    localStorage.removeItem('token');
    location.href = '/';
}

async function loadAllOrders() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/orders`, {
        headers: { 'Authorization': token }
    });
    const orders = await res.json();
    renderKanban(orders);
}

async function loadMyOrders() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/orders/my`, {
        headers: { 'Authorization': token }
    });
    const orders = await res.json();
    renderOrdersList(orders);
}

function renderKanban(orders) {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '';
    
    for (let status of STATUSES) {
        const columnOrders = orders.filter(o => o.status_name === status);
        
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.setAttribute('data-status', status);
        column.innerHTML = `
            <div class="kanban-header">
                <h3>${getStatusIcon(status)} ${status}</h3>
                <span class="order-count">${columnOrders.length}</span>
            </div>
            <div class="kanban-cards" ondragover="dragOver(event)" ondrop="drop(event, '${status}')">
                ${columnOrders.map(order => renderOrderCard(order)).join('')}
            </div>
        `;
        
        board.appendChild(column);
    }
}

function renderOrderCard(order) {
    const isAdmin = currentUser?.role === 'admin';
    const draggable = isAdmin ? 'draggable="true"' : '';
    
    return `
        <div class="order-card" data-order-id="${order.id}" ${draggable} ondragstart="dragStart(event)" ondragend="dragEnd(event)">
            <div class="order-header">
                <strong>Заказ #${order.id}</strong>
                <small>${new Date(order.order_date).toLocaleDateString()}</small>
            </div>
            <div class="order-body">
                <div>Сумма: ${order.total_amount} ₽</div>
                <div>Клиент: ${order.username || 'Вы'}</div>
                <div>Адрес: ${order.address || 'Не указан'}</div>
                <div>Телефон: ${order.phone || 'Не указан'}</div>
            </div>
            <button class="view-items-btn" onclick="viewOrderItems(${order.id})">Товары</button>
        </div>
    `;
}

function renderOrdersList(orders) {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '<div class="orders-list">' + orders.map(order => `
        <div class="order-list-item">
            <div>Заказ #${order.id}</div>
            <div>${order.total_amount} ₽</div>
            <div>${order.status_name}</div>
            <div>${new Date(order.order_date).toLocaleDateString()}</div>
            <button onclick="viewOrderItems(${order.id})">Детали</button>
        </div>
    `).join('') + '</div>';
}

function getStatusIcon(status) {
    const icons = {
        'Новый': 'Новый',
        'В обработке': 'Обработка',
        'Доставка': 'Доставка',
        'Выполнен': 'Доставлен',
        'Отменен': 'Отменен'
    };
    return icons[status] || '';
}

function dragStart(event) {
    const card = event.target.closest('.order-card');
    if (!card) return;
    
    draggedOrder = {
        id: card.getAttribute('data-order-id'),
        element: card
    };
    
    event.dataTransfer.setData('text/plain', draggedOrder.id);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
}

function dragEnd(event) {
    const card = event.target.closest('.order-card');
    if (card){
        card.classList.remove('dragging');
    }
    
    draggedOrder = null;
}

function dragOver(event) {
    event.preventDefault();
    const column = event.target.closest('.kanban-column');
    if (column) {
        column.classList.add('drag-over');
    }
}

function drop(event, newStatus) {
    event.preventDefault();
    
    const column = event.target.closest('.kanban-column');
    if (column) column.classList.remove('drag-over');
    
    if (!draggedOrder) return;
    
    const orderId = draggedOrder.id;
    const token = localStorage.getItem('token');
    
    showNotification('Изменение статуса...', 'info');
    
    fetch(`${API}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({ status_name: newStatus })
    })
    .then(res => {
        if (res.ok) {
            showNotification(`Заказ #${orderId} перемещен в "${newStatus}"`, 'success');
            loadAllOrders();
        } else {
            showNotification('Ошибка при изменении статуса', 'error');
        }
    })
    .catch(() => {
        showNotification('Ошибка сервера', 'error');
    });
}

async function viewOrderItems(orderId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/orders/${orderId}/items`, {
        headers: { 'Authorization': token }
    });
    const items = await res.json();
    
    let message = 'Товары в заказе:\n';
    let total = 0;
    for (let item of items) {
        message += `\n${item.name} x ${item.quantity} = ${item.price * item.quantity} ₽`;
        total += item.price * item.quantity;
    }
    message += `\n\nИтого: ${total} ₽`;
    alert(message);
}

function showNotification(message, type) {
    const area = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    area.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}