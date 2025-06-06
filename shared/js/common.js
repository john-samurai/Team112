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
  const currentPage = window.location.pathname.split("/").pop();

  if (isAuthenticatedState && navLinks) {
    // Determine correct paths based on current page location
    let uploadPath, searchPath, settingsPath;

    if (
      currentPage === "index.html" ||
      window.location.pathname === "/" ||
      window.location.pathname.endsWith("/")
    ) {
      // On main page
      uploadPath = "corefunc/upload.html";
      searchPath = "corefunc/search.html";
      settingsPath = "corefunc/settings.html";
    } else {
      // On other pages
      uploadPath = "../corefunc/upload.html";
      searchPath = "../corefunc/search.html";
      settingsPath = "../corefunc/settings.html";
    }

    // Show authenticated navigation
    navLinks.innerHTML = `
      <a href="${uploadPath}">File Upload</a>
      <a href="${searchPath}">Search & Management</a>
      <a href="${settingsPath}">Settings</a>
      <a href="#" onclick="showSignOutModal()">Sign out</a>
    `;

    // Update any user info displays
    updateUserDisplay();
  } else if (navLinks) {
    // Show unauthenticated navigation
    if (currentPage !== "signin.html" && currentPage !== "signup.html") {
      let signinPath;

      if (
        currentPage === "index.html" ||
        window.location.pathname === "/" ||
        window.location.pathname.endsWith("/")
      ) {
        signinPath = "auth/signin.html";
      } else {
        signinPath = "../auth/signin.html";
      }

      navLinks.innerHTML = `
        <a href="${signinPath}" class="btn-signin">Sign in</a>
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
  } else {
    console.error("Sign out modal not found");
    // Fallback - direct sign out
    if (confirm("Are you sure you want to sign out?")) {
      performSignOut();
    }
  }
}

function hideSignOutModal() {
  const modal = document.getElementById("signOutModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function confirmSignOut() {
  hideSignOutModal();
  performSignOut();
}

function performSignOut() {
  try {
    // Initialize Cognito User Pool if available
    if (typeof AmazonCognitoIdentity !== "undefined") {
      const userPool = new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: "ap-southeast-2_rXnAUdmtr",
        ClientId: "77so3j6u54v3qk4qttle2k8tsk",
      });

      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
    }
  } catch (error) {
    console.log(
      "Cognito signout error (this is normal if user pool not initialized):",
      error
    );
  }

  // Clear all session storage
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("idToken");
  sessionStorage.removeItem("isAuthenticated");
  sessionStorage.removeItem("currentUser");
  sessionStorage.clear();

  // Update state
  isAuthenticatedState = false;
  currentUser = null;

  // Redirect to home page
  window.location.href = "../index.html";
}

// Legacy signOut function for compatibility
function signOut() {
  showSignOutModal();
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
