// Staff sign-in page.

const signInForm = document.getElementById("signin-form");
const signInButton = document.getElementById("signin-button");
const usernameBox = document.getElementById("username");
const passwordBox = document.getElementById("password");
const signInStatus = document.getElementById("page-status");

usernameBox.focus();

signInForm.addEventListener("submit", function (event) {
  event.preventDefault();
  clearMessage(signInStatus);

  const errors = {};
  if (usernameBox.value.trim() === "") {
    errors.username = "Enter your staff username.";
  }
  if (passwordBox.value === "") {
    errors.password = "Enter your password.";
  }

  if (Object.keys(errors).length > 0) {
    showErrors(errors, { username: "Staff username", password: "Password" });
    return;
  }

  clearErrors();
  signInButton.disabled = true;
  signInButton.textContent = "Signing in…";
  showMessage(signInStatus, "loading", "Checking your details…");

  setTimeout(signIn, 600);
});

async function signIn() {
  const answer = await askServer("/api/session", "POST", {
    username: usernameBox.value.trim(),
    password: passwordBox.value
  });

  if (answer.ok) {
    window.location.href = "/dashboard.html";
    return;
  }

  signInButton.disabled = false;
  signInButton.textContent = "Sign in";
  showMessage(signInStatus, "error", answer.error || "Check your username and password.");
  passwordBox.value = "";
  passwordBox.focus();
}
