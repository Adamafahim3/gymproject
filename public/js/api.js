// Sends a request to the server and returns its answer.
async function askServer(url, method, body) {
  const options = {
    method: method || "GET",
    headers: { "Content-Type": "application/json" }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }

  // 401 means not signed in, so go to the sign-in page.
  if (response.status === 401) {
    window.location.href = "/index.html";
    return { ok: false, error: "Please sign in again." };
  }

  return await response.json();
}

// Gets every member from the server.
async function getAllMembers() {
  return await askServer("/api/members");
}
