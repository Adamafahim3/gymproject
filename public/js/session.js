// Shows who is signed in at the top of every staff page.
async function showWhoIsSignedIn() {
  const answer = await askServer("/api/session");

  if (answer.ok) {
    const role = answer.user.role;
    setText("session-name", answer.user.displayName);
    setText("session-role", role.charAt(0).toUpperCase() + role.slice(1));
  }
}

document.getElementById("signout-button").addEventListener("click", async function () {
  await askServer("/api/session", "DELETE");
  window.location.href = "/index.html";
});

showWhoIsSignedIn();
