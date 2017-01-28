const chalk = require('chalk');

let slice = Array.prototype.slice;

exports.critical = function() {
  let err = arguments[0] || 'unknown';

  if (err.stack) console.error(chalk.dim(err.stack));

  if (err.cmd) console.error(chalk.dim('Command failed:\n   ', err.cmd));

  log('red', arguments);

  process.exit(1);
};

exports.error = function() {
  log('red', arguments);
};

exports.warning = function() {
  log('yellow', arguments);
};

function log(color, args) {
  let format = slice.call(args, 1);

  format.unshift(chalk[color](args[0]));

  console.error.apply(console, format);
}
