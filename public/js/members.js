// Members table: search, filter and sort.

let allMembers = [];
let sortColumn = "name";
let sortUp = true;

const statusBox = document.getElementById("page-status");
const countText = document.getElementById("count");
const tableBox = document.getElementById("table-box");
const tableBody = document.getElementById("members-body");
const emptyBox = document.getElementById("empty");
const searchBox = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const planFilter = document.getElementById("plan-filter");

// A shape for each status, so it isn't shown by colour alone.
const SHAPES = { active: "●", frozen: "◆", cancelled: "■" };

const today = new Date().toISOString().slice(0, 10);

async function loadMembers() {
  showMessage(statusBox, "loading", "Loading members…");

  const answer = await getAllMembers();

  if (!answer.ok) {
    showMessage(statusBox, "error", answer.error);
    countText.textContent = "The members could not be loaded.";
    return;
  }

  allMembers = answer.members;
  for (const member of allMembers) {
    member.expiryDate = expiryDate(member.startDate, member.plan);
  }
  clearMessage(statusBox);
  showTable();
}

function showTable() {
  const search = searchBox.value.trim().toLowerCase();
  const status = statusFilter.value;
  const plan = planFilter.value;

  const shown = allMembers.filter(function (member) {
    const name = (member.firstName + " " + member.lastName).toLowerCase();
    const matchesSearch = name.includes(search) || member.email.includes(search) ||
                          member.id.toLowerCase().includes(search) || member.phone.includes(search);
    const matchesStatus = status === "all" || member.status === status;
    const matchesPlan = plan === "all" || member.plan === plan;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  shown.sort(function (a, b) {
    const result = sortValue(a).localeCompare(sortValue(b));
    if (sortUp) {
      return result;
    }
    return -result;
  });

  tableBody.textContent = "";
  for (const member of shown) {
    tableBody.appendChild(makeRow(member));
  }

  tableBox.hidden = shown.length === 0;
  emptyBox.hidden = shown.length > 0;

  if (shown.length === 0) {
    countText.textContent = "No members match your search.";
  } else {
    countText.textContent = "Showing " + shown.length + " of " + allMembers.length + " members.";
  }

  updateSortArrows();
}

function sortValue(member) {
  if (sortColumn === "name") {
    return member.firstName + " " + member.lastName;
  }
  if (sortColumn === "plan") {
    return member.planLabel;
  }
  if (sortColumn === "status") {
    return member.statusLabel;
  }
  return member[sortColumn];
}

function makeRow(member) {
  const row = document.createElement("tr");

  const reference = makeElement("th", "mono", member.id);
  reference.setAttribute("scope", "row");
  reference.setAttribute("data-label", "Reference");
  row.appendChild(reference);

  row.appendChild(makeCell("Name", member.firstName + " " + member.lastName));
  row.appendChild(makeCell("Plan", member.planLabel));

  const statusCell = makeCell("Status", "");
  const badge = makeElement("span", "badge badge-" + member.status);
  const shape = makeElement("span", "badge-icon", SHAPES[member.status]);
  shape.setAttribute("aria-hidden", "true");
  badge.appendChild(shape);
  badge.appendChild(makeElement("span", "", member.statusLabel));
  statusCell.appendChild(badge);
  row.appendChild(statusCell);

  row.appendChild(makeCell("Started", formatDate(member.startDate)));

  let expires = formatDate(member.expiryDate);
  if (member.expiryDate < today) {
    expires = expires + " (expired)";
  }
  row.appendChild(makeCell("Expires", expires));

  const changeCell = makeCell("Actions", "");

  // The link names the member, so screen reader users can tell the Edit links apart.
  const editLink = makeElement("a", "btn btn-plain btn-small", "Edit");
  editLink.href = "/member-form.html?id=" + member.id;
  editLink.setAttribute("aria-label", "Edit " + member.firstName + " " + member.lastName);
  changeCell.appendChild(editLink);

  changeCell.appendChild(makeStatusForm(member));
  row.appendChild(changeCell);

  return row;
}

// A drop-down, a date box (only for Frozen) and an Update button.
// Nothing is saved until Update is pressed. Each label names the member,
// so screen reader users can tell the rows apart.
function makeStatusForm(member) {
  const form = makeElement("form", "status-form");
  const name = member.firstName + " " + member.lastName;

  const selectLabel = makeElement("label", "visually-hidden", "Status for " + name);
  selectLabel.htmlFor = "status-" + member.id;
  const select = makeElement("select");
  select.id = "status-" + member.id;
  for (const value of ["active", "frozen", "cancelled"]) {
    const option = makeElement("option", "", value.charAt(0).toUpperCase() + value.slice(1));
    option.value = value;
    option.selected = value === member.status;
    select.appendChild(option);
  }

  const dateLabel = makeElement("label", "visually-hidden", "Freeze ends for " + name);
  dateLabel.htmlFor = "freeze-" + member.id;
  const dateBox = makeElement("input");
  dateBox.type = "date";
  dateBox.id = "freeze-" + member.id;
  dateBox.value = member.freezeUntil || "";
  dateBox.hidden = member.status !== "frozen";

  select.addEventListener("change", function () {
    dateBox.hidden = select.value !== "frozen";
  });

  const button = makeElement("button", "btn btn-plain btn-small", "Update");
  button.type = "submit";
  button.setAttribute("aria-label", "Update status for " + name);

  form.appendChild(selectLabel);
  form.appendChild(select);
  form.appendChild(dateLabel);
  form.appendChild(dateBox);
  form.appendChild(button);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    button.disabled = true;
    showMessage(statusBox, "loading", "Updating " + name + "…");

    // Get the member's full record, change the status, and save it back.
    let answer = await askServer("/api/members/" + member.id);
    if (answer.ok) {
      const record = answer.member;
      record.status = select.value;
      record.freezeUntil = dateBox.value;
      answer = await askServer("/api/members/" + member.id, "PUT", record);
    }

    if (answer.ok) {
      answer.member.expiryDate = expiryDate(answer.member.startDate, answer.member.plan);
      let text = name + " is now " + answer.member.statusLabel;
      if (answer.member.status === "frozen") {
        text = text + " until " + formatDate(answer.member.freezeUntil);
      }
      allMembers[allMembers.indexOf(member)] = answer.member;
      showTable();
      showMessage(statusBox, "success", text + ".");
      statusBox.focus();
      return;
    }

    button.disabled = false;
    if (answer.errors) {
      showMessage(statusBox, "error", name + ": " + (answer.errors.freezeUntil || answer.errors.status));
      if (answer.errors.freezeUntil) {
        dateBox.setAttribute("aria-invalid", "true");
        dateBox.focus();
      } else {
        select.focus();
      }
    } else {
      showMessage(statusBox, "error", answer.error);
    }
  });

  return form;
}

function makeCell(label, text) {
  const cell = makeElement("td", "", text);
  cell.setAttribute("data-label", label);
  return cell;
}

// Marks the sorted column with an arrow and aria-sort.
function updateSortArrows() {
  for (const button of document.querySelectorAll(".sort-btn")) {
    const heading = button.parentElement;
    const arrow = button.querySelector(".arrow");

    if (button.getAttribute("data-sort") === sortColumn) {
      heading.setAttribute("aria-sort", sortUp ? "ascending" : "descending");
      arrow.textContent = sortUp ? "▲" : "▼";
    } else {
      heading.removeAttribute("aria-sort");
      arrow.textContent = "";
    }
  }
}

for (const button of document.querySelectorAll(".sort-btn")) {
  button.addEventListener("click", function () {
    if (sortColumn === button.getAttribute("data-sort")) {
      sortUp = !sortUp;
    } else {
      sortColumn = button.getAttribute("data-sort");
      sortUp = true;
    }
    showTable();
  });
}

document.getElementById("filter-form").addEventListener("submit", function (event) {
  event.preventDefault();
  showTable();
});

statusFilter.addEventListener("change", showTable);
planFilter.addEventListener("change", showTable);

function clearFilters() {
  searchBox.value = "";
  statusFilter.value = "all";
  planFilter.value = "all";
  showTable();
  searchBox.focus();
}

document.getElementById("clear-button").addEventListener("click", clearFilters);
document.getElementById("empty-clear").addEventListener("click", clearFilters);

loadMembers();
