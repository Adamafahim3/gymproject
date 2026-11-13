// Staff "Add a member" form.

const form = document.getElementById("member-form");
const saveButton = document.getElementById("save-button");
const statusBox = document.getElementById("page-status");

// The member being edited (from ?id=M0012 in the address), or null when adding.
const editId = new URLSearchParams(window.location.search).get("id");
const buttonText = editId ? "Save changes" : "Save member";

const LABELS = {
  firstName: "First name", lastName: "Last name", email: "Email address",
  phone: "Phone number", dob: "Date of birth", guardianName: "Guardian name",
  guardianPhone: "Guardian phone", plan: "Plan", studentId: "Student ID",
  startDate: "Start date", status: "Status", freezeUntil: "Freeze end date",
  payment: "Payment", debitDay: "Collection day", medicalNotes: "Health notes",
  declaration: "Health declaration"
};

function readForm() {
  const data = new FormData(form);

  return {
    firstName: data.get("firstName"),
    lastName: data.get("lastName"),
    email: data.get("email"),
    phone: data.get("phone"),
    dob: data.get("dob"),
    guardianName: data.get("guardianName"),
    guardianPhone: data.get("guardianPhone"),
    plan: data.get("plan"),
    studentId: data.get("studentId"),
    startDate: data.get("startDate"),
    status: data.get("status"),
    freezeUntil: data.get("freezeUntil"),
    payment: data.get("payment"),
    debitDay: data.get("debitDay"),
    medical: data.get("medical") === "on",
    medicalNotes: data.get("medicalNotes"),
    declaration: data.get("declaration") === "on"
  };
}

function getAge(dob) {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age = age - 1;
  }
  return age;
}

function updateSections() {
  const answers = readForm();
  const age = getAge(answers.dob);

  document.getElementById("guardian-section").hidden = !(age >= 14 && age < 18);
  document.getElementById("student-section").hidden = answers.plan !== "student";
  document.getElementById("freeze-section").hidden = answers.status !== "frozen";
  document.getElementById("debit-section").hidden = answers.payment !== "debit";
  document.getElementById("medical-section").hidden = !answers.medical;
}

form.addEventListener("change", updateSections);

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearErrors();

  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  showMessage(statusBox, "loading", "Saving the member…");

  let answer;
  if (editId) {
    answer = await askServer("/api/members/" + editId, "PUT", readForm());
  } else {
    answer = await askServer("/api/members", "POST", readForm());
  }

  saveButton.disabled = false;
  saveButton.textContent = buttonText;

  if (answer.ok && editId) {
    const member = answer.member;
    showMessage(statusBox, "success", "Changes saved for " + member.firstName + " " + member.lastName +
      ". Membership expires " + formatDate(expiryDate(member.startDate, member.plan)) + ".");
    statusBox.focus();
  } else if (answer.ok) {
    const member = answer.member;
    showMessage(statusBox, "success", member.firstName + " " + member.lastName +
      " saved as member " + member.id + ". Membership expires " +
      formatDate(expiryDate(member.startDate, member.plan)) + ".");
    resetForm();
    statusBox.focus();
  } else if (answer.errors) {
    clearMessage(statusBox);
    showErrors(answer.errors, LABELS);
  } else {
    showMessage(statusBox, "error", answer.error);
  }
});

function resetForm() {
  form.reset();
  document.getElementById("startDate").value = new Date().toISOString().slice(0, 10);
  updateSections();
}

// Fills the form with a member's saved details.
async function loadMember() {
  showMessage(statusBox, "loading", "Loading the member…");

  const answer = await askServer("/api/members/" + editId);

  if (!answer.ok) {
    showMessage(statusBox, "error", answer.error);
    form.hidden = true;
    return;
  }

  const member = answer.member;
  const fields = ["firstName", "lastName", "email", "phone", "dob", "guardianName", "guardianPhone",
                  "plan", "studentId", "startDate", "status", "freezeUntil", "payment", "debitDay", "medicalNotes"];

  for (const name of fields) {
    form.elements[name].value = member[name] || "";
  }
  form.elements.medical.checked = member.medical;
  form.elements.declaration.checked = true;

  setText("form-heading", "Edit " + member.firstName + " " + member.lastName);
  updateSections();
  clearMessage(statusBox);
  document.getElementById("firstName").focus();
}

if (editId) {
  document.title = "Edit member - GymDesk";
  document.getElementById("add-link").removeAttribute("aria-current");
  saveButton.textContent = buttonText;
  loadMember();
} else {
  resetForm();
  document.getElementById("firstName").focus();
}
