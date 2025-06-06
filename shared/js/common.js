// Authentication state management with Cognito
let isAuthenticatedState = false;
let currentUser = null;

// Check authentication on page load
function checkAuth() {
  const protectedPages = ["upload.html", "search.html", "settings.html"];
  const currentPage = window.location.pathname.split("/").pop();

  // Check if user has valid token
  isAuthenticatedState = isUserAuthenticated();
  currentUser = getCurrentUserInfo();

  if (protectedPages.includes(currentPage) && !isAuthenticatedState) {
    window.location.href = "../auth/signin.html";
    return;
  }

  updateNavbar();
}

// Check if user is authenticated (using Cognito tokens)
function isUserAuthenticated() {
  const token = sessionStorage.getItem("idToken");
  if (!token) return false;

  try {
    // Check if token is not expired
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp > currentTime;
  } catch (e) {
    console.error("Token validation error:", e);
    return false;
  }
}

// Get current user info from session storage
function getCurrentUserInfo() {
  const userInfo = sessionStorage.getItem("currentUser");
  return userInfo ? JSON.parse(userInfo) : null;
}

// Get authentication token for API calls
function getAuthenticationToken() {
  return sessionStorage.getItem("idToken") || "";
}

// Update navbar based on authentication status
function updateNavbar() {
  const navLinks = document.querySelector(".nav-links");

  if (isAuthenticatedState && navLinks) {
    // Show authenticated navigation
    navLinks.innerHTML = `
            <a href="../corefunc/upload.html">File Upload</a>
            <a href="../corefunc/search.html">Search & Management</a>
            <a href="../corefunc/settings.html">Settings</a>
            <a href="#" onclick="showSignOutModal()">Sign out</a>
        `;

    // Update any user info displays
    updateUserDisplay();
  } else if (navLinks) {
    // Show unauthenticated navigation
    const currentPage = window.location.pathname.split("/").pop();
    if (currentPage !== "signin.html" && currentPage !== "signup.html") {
      navLinks.innerHTML = `
                <a href="auth/signin.html" class="btn-signin">Sign in</a>
            `;
    }
  }
}

// Update user display elements
function updateUserDisplay() {
  if (currentUser) {
    // Update any elements that show user name
    const userNameElements = document.querySelectorAll(".user-name");
    userNameElements.forEach((element) => {
      element.textContent = `${currentUser.given_name} ${currentUser.family_name}`;
    });

    // Update email displays
    const userEmailElements = document.querySelectorAll(".user-email");
    userEmailElements.forEach((element) => {
      element.textContent = currentUser.email;
    });
  }
}

// Sign out functionality
function showSignOutModal() {
  const modal = document.getElementById("signOutModal");
  if (modal) {
    modal.classList.add("active");
  }
}

function hideSignOutModal() {
  const modal = document.getElementById("signOutModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function signOut() {
  // Use the signOut function from auth.js if available
  if (typeof window.signOut === "function") {
    window.signOut();
  } else {
    // Fallback signout
    sessionStorage.clear();
    window.location.href = "../index.html";
  }
}

// Utility functions
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Handle token refresh (optional - for long sessions)
function refreshTokenIfNeeded() {
  const token = sessionStorage.getItem("idToken");
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    const timeUntilExpiry = payload.exp - currentTime;

    // If token expires in less than 5 minutes, we might want to refresh
    if (timeUntilExpiry < 300) {
      console.log("Token expires soon, consider implementing refresh logic");
      // You could implement token refresh here if needed
    }
  } catch (e) {
    console.error("Token check error:", e);
  }
}

// Initialize common functionality
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();

  // Check token status periodically (every 5 minutes)
  setInterval(refreshTokenIfNeeded, 5 * 60 * 1000);
});
