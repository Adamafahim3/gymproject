// Fills in the numbers on the dashboard.
async function loadStats() {
  const statusBox = document.getElementById("page-status");

  showMessage(statusBox, "loading", "Loading the figures…");

  const answer = await askServer("/api/stats");

  if (!answer.ok) {
    showMessage(statusBox, "error", answer.error);
    return;
  }

  setText("stat-total", answer.totalMembers);
  setText("stat-active", answer.activeMembers);
  setText("stat-frozen", answer.frozenMembers);
  setText("stat-cancelled", answer.cancelledMembers);

  // The server doesn't count expired memberships, so count them here.
  const list = await getAllMembers();
  if (list.ok) {
    const today = new Date().toISOString().slice(0, 10);
    let expired = 0;
    for (const member of list.members) {
      if (expiryDate(member.startDate, member.plan) < today) {
        expired = expired + 1;
      }
    }
    setText("stat-expired", expired);
  }

  clearMessage(statusBox);
}

loadStats();
