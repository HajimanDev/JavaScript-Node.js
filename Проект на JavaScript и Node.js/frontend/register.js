const API_URL = 'http://localhost:3000';

document.getElementById('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    let code = document.getElementById('specialCode').value;
    
    if (!code) code = '000000';
    
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, special_code: code })
    });
    
    if (res.ok) {
        const data = await res.json();
        alert(`Вы зарегистрированы как ${data.role}`);
        window.location.href = 'login.html';
    } else {
        alert('Ошибка!');
    }
};