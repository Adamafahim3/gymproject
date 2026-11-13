// Changes a staff password. Run: npm run set-password -- reception

const readline = require("readline");
const auth = require("../src/auth");

auth.loadUsers();

const username = process.argv[2];
if (!username) {
  console.error("Usage: npm run set-password -- <username>   (e.g. reception, manager)");
  process.exit(1);
}

const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });

// Hide the password while it is typed.
prompt.output.write('New password for "' + username + '": ');
prompt._writeToOutput = function () {};

prompt.question("", function (password) {
  prompt.output.write("\n");
  prompt.close();

  if (password.length < 8) {
    console.error("Password must be at least 8 characters. Nothing was changed.");
    process.exit(1);
  }
  if (!auth.setPassword(username, password)) {
    console.error('No account called "' + username + '". Nothing was changed.');
    process.exit(1);
  }
  console.log('Password for "' + username + '" updated.');
});
