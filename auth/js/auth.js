// Sign in functionality
function signIn(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Simple validation (in real app, this would be server-side with Cognito)
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUser', JSON.stringify(user));
        window.location.href = '../corefunc/upload.html';
    } else {
        alert('Invalid email or password');
    }
}

// Sign up functionality
function signUp(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const address = document.getElementById('address').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const password = document.getElementById('password').value;
    
    const users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Check if user already exists
    if (users.find(u => u.email === email)) {
        alert('User with this email already exists');
        return;
    }
    
    // Create new user
    const newUser = {
        email,
        address,
        firstName,
        lastName,
        password
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    // Auto sign in
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    
    window.location.href = '../corefunc/upload.html';
}

// Update navbar for auth pages
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelector('.nav-links');
    const currentPage = window.location.pathname.split('/').pop();
    
    // Don't show protected links on auth pages
    if (navLinks && (currentPage === 'signin.html' || currentPage === 'signup.html')) {
        navLinks.innerHTML = `
            <a href="signin.html" class="btn-signin">Sign in</a>
        `;
    }
});