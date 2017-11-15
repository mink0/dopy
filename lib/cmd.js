const chalk = require('chalk');
const exec = require('execa');
const extend = require('extend');
const pad = require('pad-stream');
const log = require('debug')(require('path').basename(__filename));

class Cmd {
  constructor(options) {
    this.options = extend(true, {
      prefix: {
        cmd: '> ',  // set options.verbose to print cmd
        stdout: '  ',
        stderr: '@err '
      }
    }, options);

    let p = this.options.prefix;
    if (p.target) {
      p.stdout = `${p.stdout.trim()}${p.target} `;
      p.stderr = `${p.stderr.trim()}${p.target} `;
      p.cmd = `${p.cmd.trim()}${p.target} `;
    }

    p.stderr = chalk.red(p.stderr);
  }

  log(msg) {
    console.log(chalk.bold(`${this.options.prefix.cmd}${msg}`));
  }

  _execWarp(func, command, args, options, cb) {
    if (!command) throw new Error('no command specified');

    if (typeof options !== 'object') var cb = options, options = {};

    options = extend(true, {}, this.options, options);

    let argArr = [command, options];
    if (args) argArr = [command, args, options];

    log('exec:', command, options);
    let ps = func.apply(func, argArr);

    if (!options.mute) {
      if (options.verbose) this.log(command);

      ps.stdout.pipe(pad(this.options.prefix.stdout)).pipe(process.stdout);
      ps.stderr.pipe(pad(this.options.prefix.stderr)).pipe(process.stderr);
      process.stdin.pipe(ps.stdin);
    }

    if (!cb) return ps;

    ps.then(res => { cb(null, res); }, err => { cb(err); });
  }

  exec(command, options, cb) {
    return this._execWarp(exec.shell, command, null, options, cb);
  }

  execFile(file, args, options, cb) {
    return this._execWarp(exec, file, args, options, cb);
  }
}

module.exports = Cmd;
