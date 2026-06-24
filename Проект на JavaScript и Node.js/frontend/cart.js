const API = 'http://localhost:3000';

checkUser();
loadCart();

async function checkUser() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        document.getElementById('userInfo').innerHTML = '<a href="/login.html">Войти</a>';
        return;
    }
    
    const res = await fetch(`${API}/auth/me`, {
        headers: { 'Authorization': token }
    });
    
    if (res.ok) {
        const user = await res.json();
        document.getElementById('userInfo').innerHTML = `${user.username} (${user.role}) <button onclick="logout()">Выйти</button>`;
    } else {
        localStorage.removeItem('token');
        location.href = '/login.html';
    }
}

function logout() {
    localStorage.removeItem('token');
    location.href = '/';
}

async function loadCart() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const res = await fetch(`${API}/cart`, {
        headers: { 'Authorization': token }
    });
    
    const cart = await res.json();
    const container = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Корзина пуста</div>';
        document.getElementById('checkoutSection').style.display = 'none';
        return;
    }
    
    document.getElementById('checkoutSection').style.display = 'block';
    container.innerHTML = '';
    let total = 0;
    
    for (let item of cart) {
        total += item.price * item.quantity;
        container.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <strong>${item.name}</strong>
                    <div>${item.price} ₽ x ${item.quantity} = ${item.price * item.quantity} ₽</div>
                </div>
                <div class="cart-item-actions">
                    <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    <button onclick="removeFromCart(${item.id})" class="delete-btn">Удалить</button>
                </div>
            </div>
        `;
    }
    
    document.getElementById('totalAmount').innerText = total;
}

async function updateQuantity(cartId, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(cartId);
        return;
    }
    
    const token = localStorage.getItem('token');
    await fetch(`${API}/cart/${cartId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({ quantity: newQuantity })
    });
    
    loadCart();
}

async function removeFromCart(cartId) {
    const token = localStorage.getItem('token');
    await fetch(`${API}/cart/${cartId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
    });
    
    loadCart();
}

document.getElementById('checkoutBtn')?.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const address = document.getElementById('address').value;
    const phone = document.getElementById('phone').value;
    
    if (!address || !phone) {
        alert('Заполните адрес и телефон');
        return;
    }
    
    const res = await fetch(`${API}/cart/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({ address, phone })
    });
    
    if (res.ok) {
        alert('Заказ оформлен!');
        location.href = '/orders.html';
    } else {
        alert('Ошибка при оформлении');
    }
});