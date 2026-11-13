// Starts GymDesk. Run it with: node server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const settings = require("./src/settings");
const auth = require("./src/auth");
const api = require("./src/api");

const FILE_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

// The only pages you can see without signing in.
const OPEN_PAGES = ["/index.html", "/404.html"];

function sendFile(request, response, address) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }

  // "/" means the sign-in page, and "/members" means "/members.html".
  let wanted = decodeURIComponent(address.pathname);
  if (wanted === "/") {
    wanted = "/index.html";
  }
  if (!path.extname(wanted)) {
    wanted = wanted + ".html";
  }

  // Block addresses like /../.env that try to leave the public folder.
  const filePath = path.join(settings.PUBLIC_DIR, wanted);
  if (!filePath.startsWith(settings.PUBLIC_DIR + path.sep)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  // Staff pages send anyone who isn't signed in back to sign-in.
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html" && !OPEN_PAGES.includes(wanted) && !auth.getSessionUser(request)) {
    response.writeHead(302, { "Location": "/index.html?next=" + encodeURIComponent(wanted) });
    response.end();
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": FILE_TYPES[".html"] });
    response.end(fs.readFileSync(path.join(settings.PUBLIC_DIR, "404.html")));
    return;
  }

  // Pages are never cached, so Back after signing out can't show them.
  response.writeHead(200, {
    "Content-Type": FILE_TYPES[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(request.method === "HEAD" ? undefined : fs.readFileSync(filePath));
}

const server = http.createServer(async function (request, response) {
  // Only allow scripts and styles from this site.
  response.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; " +
    "img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "DENY");

  let address;
  try {
    address = new URL(request.url, "http://" + (request.headers.host || "localhost"));
  } catch (problem) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  try {
    if (address.pathname.startsWith("/api/")) {
      await api.handleApi(request, response, address);
    } else {
      sendFile(request, response, address);
    }
  } catch (problem) {
    console.error("[server] Unhandled error:", problem);
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server error");
    }
  }
});

// Load the staff accounts, check Supabase, then start listening.
async function startServer() {
  auth.loadUsers();
  await api.checkDatabase();
  server.listen(settings.PORT, settings.HOST, function () {
    console.log("GymDesk running at http://" + settings.HOST + ":" + settings.PORT);
  });
}

startServer().catch(function (error) {
  console.error("[startup] Could not start:", error.message);
  process.exitCode = 1;
});
