// Simple authentication state management
let isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// Check authentication on page load
function checkAuth() {
    const protectedPages = ['upload.html', 'search.html', 'settings.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage) && !isAuthenticated) {
        window.location.href = '../auth/signup.html';
    }
    
    updateNavbar();
}

// Update navbar based on authentication status
function updateNavbar() {
    const navLinks = document.querySelector('.nav-links');
    
    if (isAuthenticated && navLinks) {
        navLinks.innerHTML = `
            <a href="../corefunc/upload.html">File Upload</a>
            <a href="../corefunc/search.html">Search & Management</a>
            <a href="../corefunc/settings.html">Settings</a>
            <a href="#" onclick="showSignOutModal()">Sign out</a>
        `;
    }
}

// Sign out functionality
function showSignOutModal() {
    const modal = document.getElementById('signOutModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function hideSignOutModal() {
    const modal = document.getElementById('signOutModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function signOut() {
    isAuthenticated = false;
    currentUser = null;
    localStorage.setItem('isAuthenticated', 'false');
    localStorage.removeItem('currentUser');
    window.location.href = '../index.html';
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});