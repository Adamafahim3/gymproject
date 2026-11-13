// The rules a member record must pass before the server saves it.

const PLANS = { standard: "Standard monthly", offpeak: "Off-peak monthly", student: "Student monthly", annual: "Annual" };
const STATUSES = { active: "Active", frozen: "Frozen", cancelled: "Cancelled" };
const PAYMENTS = { card: "Card", cash: "Cash", debit: "Direct debit" };
const INTERESTS = { gym: "Gym floor", classes: "Group classes", swim: "Swimming pool", pt: "Personal training" };
const DEBIT_DAYS = ["1", "15", "28"];
const MIN_AGE = 14;
const ADULT_AGE = 18;

const NAME_PATTERN = /^[\p{L}][\p{L} '\-]{0,49}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9 ]+$/;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9]{5,12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Turns a date into "2026-11-13".
function toISO(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function todayISO() {
  return toISO(new Date());
}

// True for a real calendar date like 2026-02-28, false for 2026-02-30.
function isValidDate(text) {
  if (!DATE_PATTERN.test(text)) {
    return false;
  }
  const parts = text.split("-").map(Number);
  return toISO(new Date(parts[0], parts[1] - 1, parts[2])) === text;
}

// Age in whole years, or null for a bad date.
function ageFromDob(dob) {
  if (!isValidDate(dob)) {
    return null;
  }
  const parts = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - parts[0];
  const month = now.getMonth() + 1;
  if (month < parts[1] || (month === parts[1] && now.getDate() < parts[2])) {
    age = age - 1;
  }
  return age;
}

// Adds a number of days to "2026-11-13".
function addDays(isoDate, days) {
  const parts = isoDate.split("-").map(Number);
  return toISO(new Date(parts[0], parts[1] - 1, parts[2] + days));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "").length;
  return PHONE_PATTERN.test(value) && digits >= 7 && digits <= 15;
}

// Only real options count, not built-in names like "toString".
function isOption(list, value) {
  return Object.hasOwn(list, value);
}

// Returns { errors, values }. No errors means the record can be saved.
function validateMember(input, isNew) {
  const errors = {};
  const today = todayISO();

  const values = {
    firstName: cleanText(input.firstName),
    lastName: cleanText(input.lastName),
    email: cleanText(input.email).toLowerCase(),
    phone: cleanText(input.phone),
    dob: cleanText(input.dob),
    plan: cleanText(input.plan),
    startDate: cleanText(input.startDate),
    status: cleanText(input.status) || "active",
    payment: cleanText(input.payment),
    interests: [],
    medical: Boolean(input.medical),
    studentId: "",
    debitDay: "",
    freezeUntil: "",
    medicalNotes: "",
    guardianName: "",
    guardianPhone: ""
  };

  if (Array.isArray(input.interests)) {
    values.interests = input.interests.filter(function (item) { return isOption(INTERESTS, item); });
  }

  if (!values.firstName) {
    errors.firstName = "Enter the member’s first name.";
  } else if (!NAME_PATTERN.test(values.firstName)) {
    errors.firstName = "First name can only contain letters, spaces, hyphens and apostrophes (up to 50 characters).";
  }

  if (!values.lastName) {
    errors.lastName = "Enter the member’s last name.";
  } else if (!NAME_PATTERN.test(values.lastName)) {
    errors.lastName = "Last name can only contain letters, spaces, hyphens and apostrophes (up to 50 characters).";
  }

  if (!values.email) {
    errors.email = "Enter the member’s email address.";
  } else if (!EMAIL_PATTERN.test(values.email) || values.email.length > 100) {
    errors.email = "Enter an email address in the format name@example.com.";
  }

  if (!values.phone) {
    errors.phone = "Enter the member’s phone number.";
  } else if (!isValidPhone(values.phone)) {
    errors.phone = "Enter a phone number using 7 to 15 digits, for example 01012345678.";
  }

  const age = ageFromDob(values.dob);

  if (!values.dob) {
    errors.dob = "Enter the member’s date of birth.";
  } else if (age === null) {
    errors.dob = "Enter a real date of birth, for example 24 03 1998.";
  } else if (values.dob > today) {
    errors.dob = "Date of birth must be in the past.";
  } else if (age < MIN_AGE) {
    errors.dob = "Members must be at least " + MIN_AGE + " years old. This date of birth gives an age of " + age + ".";
  } else if (age > 110) {
    errors.dob = "Check the year of birth. This date gives an age over 110.";
  }

  // Under-18s need a parent or guardian.
  if (age !== null && age >= MIN_AGE && age < ADULT_AGE) {
    values.guardianName = cleanText(input.guardianName);
    values.guardianPhone = cleanText(input.guardianPhone);

    if (!values.guardianName) {
      errors.guardianName = "Enter the parent or guardian’s full name. This is needed because the member is under 18.";
    } else if (values.guardianName.length > 100) {
      errors.guardianName = "Parent or guardian name must be 100 characters or fewer.";
    }

    if (!values.guardianPhone) {
      errors.guardianPhone = "Enter the parent or guardian’s phone number.";
    } else if (!isValidPhone(values.guardianPhone)) {
      errors.guardianPhone = "Enter a guardian phone number using 7 to 15 digits, for example 01012345678.";
    }
  }

  if (!isOption(PLANS, values.plan)) {
    errors.plan = "Select a membership plan.";
  }

  if (values.plan === "student") {
    values.studentId = cleanText(input.studentId).toUpperCase();
    if (!values.studentId) {
      errors.studentId = "Enter the student ID shown on the member’s student card.";
    } else if (!STUDENT_ID_PATTERN.test(values.studentId)) {
      errors.studentId = "Student ID must be 5 to 12 letters or numbers, with no spaces.";
    }
  }

  if (!values.startDate) {
    errors.startDate = "Enter the membership start date.";
  } else if (!isValidDate(values.startDate)) {
    errors.startDate = "Enter a real start date, for example 01 11 2026.";
  } else if (values.startDate > addDays(today, 90)) {
    errors.startDate = "Start date cannot be more than 90 days from today.";
  }

  if (!isOption(STATUSES, values.status)) {
    errors.status = "Select a membership status.";
  }

  // A frozen membership needs the date it starts again.
  if (values.status === "frozen") {
    values.freezeUntil = cleanText(input.freezeUntil);
    if (!values.freezeUntil) {
      errors.freezeUntil = "Enter the date the freeze ends.";
    } else if (!isValidDate(values.freezeUntil)) {
      errors.freezeUntil = "Enter a real freeze end date, for example 01 12 2026.";
    } else if (values.freezeUntil <= today) {
      errors.freezeUntil = "Freeze end date must be after today.";
    }
  }

  if (!isOption(PAYMENTS, values.payment)) {
    errors.payment = "Select how the member will pay.";
  }

  if (values.payment === "debit") {
    values.debitDay = cleanText(String(input.debitDay || ""));
    if (!DEBIT_DAYS.includes(values.debitDay)) {
      errors.debitDay = "Select the day of the month the direct debit is collected.";
    }
  }

  if (values.medical) {
    values.medicalNotes = cleanText(input.medicalNotes);
    if (!values.medicalNotes) {
      errors.medicalNotes = "Describe the condition or injury so trainers know what to avoid.";
    } else if (values.medicalNotes.length > 500) {
      errors.medicalNotes = "Health notes must be 500 characters or fewer. You have " + values.medicalNotes.length + ".";
    }
  }

  // The health declaration is only asked for when adding someone new.
  if (isNew && !input.declaration) {
    errors.declaration = "Confirm that the member has signed the health declaration form.";
  }

  return { errors: errors, values: values };
}

module.exports = {
  PLANS: PLANS,
  STATUSES: STATUSES,
  PAYMENTS: PAYMENTS,
  INTERESTS: INTERESTS,
  todayISO: todayISO,
  isValidDate: isValidDate,
  ageFromDob: ageFromDob,
  addDays: addDays,
  validateMember: validateMember
};
