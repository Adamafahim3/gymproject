// Puts text inside the element with this id.
function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

// Shows a message that screen readers read out. kind is success, error, info or loading.
function showMessage(box, kind, text) {
  const icons = { success: "✓", error: "⚠︎", info: "ℹ︎", loading: "" };

  box.textContent = "";

  const message = makeElement("p", "msg msg-" + kind);
  const icon = makeElement("span", kind === "loading" ? "spinner" : "msg-icon", icons[kind]);
  icon.setAttribute("aria-hidden", "true");

  message.appendChild(icon);
  message.appendChild(makeElement("span", "", text));
  box.appendChild(message);
}

function clearMessage(box) {
  box.textContent = "";
}

function formatDate(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = date.split("-");
  return Number(parts[2]) + " " + months[Number(parts[1]) - 1] + " " + parts[0];
}

function getInputs(name) {
  const byId = document.getElementById(name);
  if (byId) {
    return [byId];
  }
  return document.getElementsByName(name);
}

function clearErrors() {
  for (const error of document.querySelectorAll(".error")) {
    error.textContent = "";
    error.classList.remove("show");
  }
  for (const input of document.querySelectorAll("[aria-invalid]")) {
    input.removeAttribute("aria-invalid");
  }
  document.getElementById("error-box").hidden = true;
}

function showErrors(errors, labels) {
  clearErrors();

  const list = document.getElementById("error-box-list");
  list.textContent = "";

  for (const name in errors) {
    const errorText = document.getElementById(name + "-error");
    errorText.textContent = errors[name];
    errorText.classList.add("show");

    for (const input of getInputs(name)) {
      input.setAttribute("aria-invalid", "true");
    }

    const link = makeElement("a", "", labels[name] + ": " + errors[name]);
    link.href = "#" + name;
    link.addEventListener("click", function (event) {
      event.preventDefault();
      getInputs(name)[0].focus();
    });

    const item = makeElement("li");
    item.appendChild(link);
    list.appendChild(item);
  }

  // Move focus to the list so screen readers read every problem.
  const box = document.getElementById("error-box");
  box.hidden = false;
  box.focus();
}

// One month after the start date, or one year for the annual plan.
function expiryDate(startDate, plan) {
  const date = new Date(startDate);
  if (plan === "annual") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString().slice(0, 10);
}
