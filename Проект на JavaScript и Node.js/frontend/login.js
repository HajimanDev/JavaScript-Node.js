const API_URL = 'http://localhost:3000';

document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    
    
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        alert('Успешно!');
        window.location.href = 'index.html';
    } else {
        alert('Ошибка!');
    }
};

