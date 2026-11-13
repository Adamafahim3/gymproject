// Staff accounts and sign-in sessions.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const settings = require("./settings");

const SESSION_MS = settings.SESSION_HOURS * 60 * 60 * 1000;
const COOKIE_NAME = "gd_sid";
const USERS_FILE = path.join(settings.DATA_DIR, "users.json");

let users = [];
const sessions = new Map();

// Uses the password from .env, or makes one up and prints it once.
function pickPassword(fromEnvFile, username) {
  if (fromEnvFile) {
    return fromEnvFile;
  }
  const generated = crypto.randomBytes(6).toString("base64url");
  console.log('[auth] Generated password for "' + username + '": ' + generated + "  (also saved in data/users.json)");
  return generated;
}

// An extra manager account, added if it isn't in users.json yet.
const EXTRA_MANAGER = { username: "Adam", role: "manager", displayName: "Adam", password: "20241010" };

// Reads data/users.json, creating it with the staff accounts on the first run.
function loadUsers() {
  fs.mkdirSync(settings.DATA_DIR, { recursive: true });

  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } else {
    users = [
      { username: "reception", role: "receptionist", displayName: "Reception",
        password: pickPassword(settings.DEMO_RECEPTION_PASSWORD, "reception") },
      { username: "manager", role: "manager", displayName: "Duty manager",
        password: pickPassword(settings.DEMO_MANAGER_PASSWORD, "manager") }
    ];
  }

  if (!findUser(EXTRA_MANAGER.username)) {
    users.push(EXTRA_MANAGER);
  }
  saveUsers();
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Finds an account, ignoring capital letters.
function findUser(username) {
  const wanted = String(username).trim().toLowerCase();
  return users.find(function (user) { return user.username.toLowerCase() === wanted; }) || null;
}

// Returns the user without their password, or null if the details are wrong.
function checkCredentials(username, password) {
  const user = findUser(username);
  if (!user || user.password !== String(password)) {
    return null;
  }
  return { username: user.username, role: user.role, displayName: user.displayName };
}

// Used by scripts/set-password.js.
function setPassword(username, newPassword) {
  const user = findUser(username);
  if (!user) {
    return false;
  }
  user.password = newPassword;
  saveUsers();
  return true;
}

// A random id that nobody can guess, kept in memory.
function createSession(user) {
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, { user: user, expires: Date.now() + SESSION_MS });
  return id;
}

function destroySession(id) {
  sessions.delete(id);
}

// Reads the session id from the cookie sent by the browser.
function getSessionId(request) {
  const header = request.headers.cookie || "";
  for (const cookie of header.split(";")) {
    const parts = cookie.trim().split("=");
    if (parts[0] === COOKIE_NAME) {
      return parts[1];
    }
  }
  return null;
}

// Returns who is signed in, or null. Each request keeps the session alive.
function getSessionUser(request) {
  const id = getSessionId(request);
  const session = sessions.get(id);

  if (!session) {
    return null;
  }
  if (session.expires < Date.now()) {
    sessions.delete(id);
    return null;
  }

  session.expires = Date.now() + SESSION_MS;
  return session.user;
}

// HttpOnly stops page scripts reading it; SameSite stops other sites using it.
function makeSessionCookie(id) {
  let cookie = COOKIE_NAME + "=" + id + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + Math.floor(SESSION_MS / 1000);
  if (settings.COOKIE_SECURE) {
    cookie = cookie + "; Secure";
  }
  return cookie;
}

function makeClearCookie() {
  return COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}

module.exports = {
  loadUsers: loadUsers,
  checkCredentials: checkCredentials,
  setPassword: setPassword,
  createSession: createSession,
  destroySession: destroySession,
  getSessionUser: getSessionUser,
  getSessionId: getSessionId,
  makeSessionCookie: makeSessionCookie,
  makeClearCookie: makeClearCookie
};
