// Cognito Configuration
const COGNITO_CONFIG = {
  UserPoolId: "ap-southeast-2_rXnAUdmtr",
  ClientId: "bf6ecr7bml75im5q13pf26g1n",
  Region: "ap-southeast-2",
};

// Initialize Cognito User Pool
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.UserPoolId,
  ClientId: COGNITO_CONFIG.ClientId,
});

// Sign up functionality
function signUp(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const address = document.getElementById("address").value;
  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const password = document.getElementById("password").value;

  // Validate inputs
  if (!email || !address || !firstName || !lastName || !password) {
    alert("Please fill in all fields");
    return;
  }

  // Prepare user attributes for Cognito
  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "email",
      Value: email,
    }),
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "given_name",
      Value: firstName,
    }),
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "family_name",
      Value: lastName,
    }),
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "address",
      Value: address,
    }),
  ];

  // Sign up user with Cognito
  userPool.signUp(email, password, attributeList, null, (err, result) => {
    if (err) {
      console.error("Sign up error:", err);
      alert("Sign up failed: " + err.message);
      return;
    }

    console.log("Sign up successful:", result);
    alert("Sign up successful! Please check your email for verification code.");

    // Store email for confirmation step
    sessionStorage.setItem("pendingEmail", email);

    // Redirect to confirmation page or show confirmation form
    showEmailVerification();
  });
}

// Show email verification form
function showEmailVerification() {
  const authForm = document.querySelector(".auth-form");
  authForm.innerHTML = `
        <h2 class="auth-title">Verify Your Email</h2>
        <div class="form-group">
            <label for="verificationCode" class="form-label">Verification Code</label>
            <input type="text" id="verificationCode" class="form-input" required 
                   placeholder="Enter code from your email">
        </div>
        <button type="button" class="btn-submit" onclick="confirmSignUp()">Verify</button>
        <p class="auth-link">
            <a href="#" onclick="resendVerificationCode()">Resend code</a>
        </p>
    `;
}

// Confirm sign up with verification code
function confirmSignUp() {
  const email = sessionStorage.getItem("pendingEmail");
  const verificationCode = document.getElementById("verificationCode").value;

  if (!verificationCode) {
    alert("Please enter verification code");
    return;
  }

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool: userPool,
  });

  cognitoUser.confirmRegistration(verificationCode, true, (err, result) => {
    if (err) {
      console.error("Verification error:", err);
      alert("Verification failed: " + err.message);
      return;
    }

    console.log("Verification successful:", result);
    alert("Email verified successfully! You can now sign in.");

    // Clean up and redirect to sign in
    sessionStorage.removeItem("pendingEmail");
    window.location.href = "signin.html";
  });
}

// Resend verification code
function resendVerificationCode() {
  const email = sessionStorage.getItem("pendingEmail");

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool: userPool,
  });

  cognitoUser.resendConfirmationCode((err, result) => {
    if (err) {
      console.error("Resend error:", err);
      alert("Failed to resend code: " + err.message);
      return;
    }

    console.log("Code resent:", result);
    alert("Verification code sent to your email!");
  });
}

// Sign in functionality
function signIn(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(
    {
      Username: email,
      Password: password,
    }
  );

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: email,
    Pool: userPool,
  });

  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) => {
      console.log("Sign in successful:", result);

      // Get JWT token
      const accessToken = result.getAccessToken().getJwtToken();
      const idToken = result.getIdToken().getJwtToken();

      // Store tokens in session storage
      sessionStorage.setItem("accessToken", accessToken);
      sessionStorage.setItem("idToken", idToken);
      sessionStorage.setItem("isAuthenticated", "true");

      // Get user attributes
      cognitoUser.getUserAttributes((err, attributes) => {
        if (!err && attributes) {
          const userInfo = {};
          attributes.forEach((attr) => {
            userInfo[attr.Name] = attr.Value;
          });
          sessionStorage.setItem("currentUser", JSON.stringify(userInfo));
        }

        // Redirect to upload page
        window.location.href = "../corefunc/upload.html";
      });
    },

    onFailure: (err) => {
      console.error("Sign in error:", err);
      alert("Sign in failed: " + err.message);
    },

    newPasswordRequired: (userAttributes, requiredAttributes) => {
      // Handle new password required (first time login)
      console.log("New password required");
      alert("Please set a new password");
      // You can implement new password flow here if needed
    },
  });
}

// Get current authentication token
function getAuthToken() {
  return sessionStorage.getItem("idToken") || "";
}

// Check if user is authenticated
function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;

  try {
    // Basic token validation (check if not expired)
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp > currentTime;
  } catch (e) {
    return false;
  }
}

// Sign out functionality
function signOut() {
  const cognitoUser = userPool.getCurrentUser();

  if (cognitoUser) {
    cognitoUser.signOut();
  }

  // Clear session storage
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("idToken");
  sessionStorage.removeItem("isAuthenticated");
  sessionStorage.removeItem("currentUser");

  // Redirect to home page
  window.location.href = "../index.html";
}

// Get current user info
function getCurrentUser() {
  const userInfo = sessionStorage.getItem("currentUser");
  return userInfo ? JSON.parse(userInfo) : null;
}

// Update navbar for auth pages
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelector(".nav-links");
  const currentPage = window.location.pathname.split("/").pop();

  // Don't show protected links on auth pages
  if (
    navLinks &&
    (currentPage === "signin.html" || currentPage === "signup.html")
  ) {
    navLinks.innerHTML = `
            <a href="signin.html" class="btn-signin">Sign in</a>
        `;
  }

  // Handle pending email verification if user refreshes page
  if (currentPage === "signup.html" && sessionStorage.getItem("pendingEmail")) {
    showEmailVerification();
  }
});
