#!/usr/bin/env node

const yargs = require('yargs');
const path = require('path');
const errors = require('./lib/errors');
const log = require('debug')(path.basename(__filename));
const dopy = require('./index');

// expose for all included tasks
global.dopy = dopy;

// remove max listeners warning (no need for console tool)
require('events').defaultMaxListeners = 0;

let cwd = path.resolve('.');

yargs
  .usage(`${path.basename(__filename)} <env> <task> [target]`)
  .help('help')
  .alias('h', 'help')
  .describe('cwd', 'specify path where tasks and environment files are located')
  .default('cwd', cwd)
  .demand(1)
  .completion('completions', 'setup bash completions')
  .fail((msg, err, yargs) => {
    if (err && typeof err === 'object') return errors.critical(err);

    console.error('Usage: ', yargs.help());
    errors.critical(msg);
  });

let preArgv = require('yargs-parser')(process.argv);
if (preArgv.cwd) {
  if (Array.isArray(preArgv.cwd))
    preArgv.cwd = preArgv.cwd[preArgv.cwd.length - 1];

  cwd = path.resolve(preArgv.cwd);
}

dopy.envPath = path.join(cwd, './envs');
dopy.tasksPath = path.join(cwd, './tasks');

dopy.config.read(dopy.envPath, (err, conf) => {
  if (err) return errors.critical(err);

  Object.keys(conf).forEach((env) => {
    if (conf[env].hidden) return;

    let servers = '-';
    if (conf[env].remote && conf[env].remote.servers)
      servers = conf[env].remote.servers;

    yargs.command(env, `servers: ${servers}`, envCmds);
  });

  function envCmds(yargs) {
    yargs.demand(1);
    let argv = require('yargs-parser')(process.argv);
    yargs.envName = argv._[2];

    // init env first
    dopy.config.initEnv(yargs.envName);

    yargs.commandDir(dopy.tasksPath);
  }

  // yargs getter. should be called only once for a single yargs instance
  let argv = yargs.argv;
  let env = dopy.config.env;

  if (Object.keys(env).length === 0)
    errors.critical(`unknown env: "${argv._[0]}"`);

  log('argv', argv);

  if (argv.targets && dopy.config.env.config.targets)
    dopy.config.initTargets(argv.targets);

  // finally run the task
  dopy.run(require(path.join(dopy.tasksPath, argv._[1])).task, env, argv);

});
