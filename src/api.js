// Answers every address that starts with /api/. Members are stored in Supabase.

const supabase = require("./supabase");
const auth = require("./auth");
const rules = require("../public/js/validation");

function sendJson(response, status, body, cookie) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (cookie) {
    headers["Set-Cookie"] = cookie;
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

// Reads the JSON the browser sent. Anything broken becomes an empty object.
function readBody(request) {
  return new Promise(function (resolve) {
    let text = "";
    request.on("data", function (piece) {
      text = text + piece;
    });
    request.on("end", function () {
      try {
        resolve(JSON.parse(text) || {});
      } catch (error) {
        resolve({});
      }
    });
  });
}

// Gets every member, in reference order.
async function getAllMembers() {
  const result = await supabase.from("members").select("*").order("id");
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

// Gets one member, or null if there is none.
async function findMember(id) {
  const result = await supabase.from("members").select("*").eq("id", id).maybeSingle();
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

// Adds the words the pages show, like "Off-peak monthly".
function withLabels(member) {
  const copy = Object.assign({}, member);
  copy.freezeUntil = member.freezeUntil || "";
  copy.name = member.firstName + " " + member.lastName;
  copy.planLabel = rules.PLANS[member.plan];
  copy.statusLabel = rules.STATUSES[member.status];
  return copy;
}

// Checks the database is there before the server starts.
async function checkDatabase() {
  const result = await supabase.from("members").select("id").limit(1);
  if (result.error) {
    throw result.error;
  }
}

async function signIn(request, response) {
  const body = await readBody(request);
  const user = auth.checkCredentials(body.username || "", body.password || "");

  if (!user) {
    sendJson(response, 200, { ok: false, error: "That username and password do not match a staff account." });
    return;
  }

  const id = auth.createSession(user);
  sendJson(response, 200, { ok: true, user: user }, auth.makeSessionCookie(id));
}

// Adds a new member, or edits one when memberId is given.
async function saveMember(request, response, memberId) {
  const body = await readBody(request);
  const result = rules.validateMember(body, !memberId);
  const errors = result.errors;
  const values = result.values;

  if (Object.keys(errors).length > 0) {
    sendJson(response, 200, { ok: false, errors: errors });
    return;
  }

  // The database wants null, not an empty string, for a missing date.
  values.freezeUntil = values.freezeUntil || null;
  values.updatedAt = new Date().toISOString();

  // Supabase makes the reference (M0065 and so on) for a new member.
  let query;
  if (memberId) {
    query = supabase.from("members").update(values).eq("id", memberId);
  } else {
    query = supabase.from("members").insert(values);
  }

  const saved = await query.select("*").maybeSingle();

  if (saved.error) {
    // The database refuses a second member with the same email.
    if (saved.error.code === "23505") {
      sendJson(response, 200, { ok: false, errors: { email: "A member already uses that email address." } });
      return;
    }
    throw saved.error;
  }

  if (!saved.data) {
    sendJson(response, 200, { ok: false, error: "No member found with that reference." });
    return;
  }

  const member = withLabels(saved.data);
  sendJson(response, 200, { ok: true, member: member, message: member.name + " saved as member " + member.id + "." });
}

// Counts members by status for the dashboard.
async function statistics(response) {
  const members = await getAllMembers();
  const stats = { ok: true, totalMembers: members.length, activeMembers: 0, frozenMembers: 0, cancelledMembers: 0 };

  for (const member of members) {
    if (member.status === "active") stats.activeMembers++;
    if (member.status === "frozen") stats.frozenMembers++;
    if (member.status === "cancelled") stats.cancelledMembers++;
  }

  sendJson(response, 200, stats);
}

async function handleApi(request, response, address) {
  const path = address.pathname;
  const method = request.method;

  try {
    if (path === "/api/session" && method === "POST") {
      await signIn(request, response);
      return;
    }

    if (path === "/api/session" && method === "DELETE") {
      auth.destroySession(auth.getSessionId(request));
      sendJson(response, 200, { ok: true }, auth.makeClearCookie());
      return;
    }

    // Everything below needs a signed-in member of staff.
    const user = auth.getSessionUser(request);

    if (!user) {
      sendJson(response, 401, { ok: false, error: "Your session has ended. Sign in again to continue." });
      return;
    }

    if (path === "/api/session" && method === "GET") {
      sendJson(response, 200, { ok: true, user: user });
      return;
    }

    if (path === "/api/members" && method === "GET") {
      const members = await getAllMembers();
      sendJson(response, 200, { ok: true, members: members.map(withLabels) });
      return;
    }

    if (path === "/api/members" && method === "POST") {
      await saveMember(request, response, null);
      return;
    }

    // One member, for example /api/members/M0012
    const match = path.match(/^\/api\/members\/([A-Za-z0-9]+)$/);

    if (match && method === "GET") {
      const member = await findMember(match[1].toUpperCase());
      if (member) {
        sendJson(response, 200, { ok: true, member: withLabels(member) });
      } else {
        sendJson(response, 200, { ok: false, error: "No member found with that reference." });
      }
      return;
    }

    if (match && method === "PUT") {
      await saveMember(request, response, match[1].toUpperCase());
      return;
    }

    if (path === "/api/stats" && method === "GET") {
      await statistics(response);
      return;
    }

    sendJson(response, 404, { ok: false, error: "Unknown API endpoint." });
  } catch (error) {
    console.error("[api]", method, path, error.message);
    sendJson(response, 500, { ok: false, error: "The server could not process that request. Try again." });
  }
}

module.exports = { checkDatabase: checkDatabase, handleApi: handleApi };
