const yaml = require('js-yaml');
const fs = require('fs');
const glob = require('glob');
const log = require('debug')('config');
const extend = require('extend');
const critical = require('../lib/errors').critical;
const Cmd = require('./cmd');
const SshCmd = require('./ssh-cmd');
const chalk = require('chalk');
const colors = require('./colors');
const mustache = require('mustache');

let config = {};
let env = {};

module.exports = {
  config,
  env,
  read,
  initEnv,
  initTargets,
  yargsTargets
};

function error(err, cb) {
  console.error('config parse error!');

  if (cb) return cb(err);

  critical(err);
}

// should be called first for quick args parsing
function read(conf_path, cb) {
  glob('**/*.yml', { cwd: conf_path, absolute: true }, (err, files) => {
    if (err) return done(err);

    if (files.length === 0) return cb(null, config);

    for (var i = 0; i < files.length; i++) {
      fs.readFile(files[i], 'utf8', parse);
    }

    function parse(err, data) {
      if (err) return done(err);

      let obj = yaml.load(data);

      Object.keys(obj).forEach((key) => {
        if (config.hasOwnProperty(key))
          return done(new Error(`Duplicate environment found: '${key}'`));

          // explicit declare optional properties
          obj[key].hidden = !!obj[key].hidden;
      });

      config = Object.assign(config, obj);
      done();
    }

    function done(err) {
      if (err) return error(err, cb);

      if (--i === 0) {
        log('config:', config);
        cb(null, config);
      }
    }
  });
}

/**
 * initEnv should be called after .read()
 * Resolve all parents and init local and remote functions
 * @param  {string} envName name of the env from config
 * @return {object}         env
 */
function initEnv(envName, config=module.exports.config) {
  log('initEnv...');
  if (!config[envName]) return error(`unknown env: ${envName}`);

  if (Object.keys(env).length > 0) return env;

  let parents = getParents(config, envName);

  // all envs should inherit config.default
  if (config.default) parents.push(config.default);

  // deep copy all parents
  parents.push({});
  parents.push(true);
  env.config = extend.apply(extend, parents.reverse());

  env.name = env.config.name || envName;

  // merge root general local and remote
  env.config.local = extend({}, env.config.general, env.config.local);
  env.config.remote = extend({}, env.config.general, env.config.remote);
  delete env.config.general;

  // render template vars
  if (env.config.template) {
    let tpl = JSON.stringify(env.config);
    env.config = JSON.parse(mustache.render(tpl, env.config.template));

    // let template = handlebars.compile(tpl);
    // env.config = JSON.parse(template(env.config.template));
    // console.log(env.config.targets)
  }

  // exec links
  makeExecLinks(env, {
    ssh: {
      user: env.config.remote.user
    }
  });

  // log
  env.log = (msg, color='green', target='') => {
    return console.log(chalk[color](`${target}${msg}`));
  };

  log('env:', env);

  return env;

  function getParents(obj, start) {
    let q = [];
    doRecursion(start);

    function doRecursion(step) {
      if (q.indexOf(step) !== -1)
        return error(`cyclic parent detected: ${q} ${step}`);

      if (obj[step] === undefined)
        return error(`unknown parent: ${step}`);

      q.push(obj[step]);

      if (obj[step].hasOwnProperty('parent'))
        doRecursion(obj[step].parent);
    }

    return q;
  }
}

// should be called after .initEnv()
function initTargets(selectedTargets) {
  log('initTargets');
  if (!env.config) return error('you should init env first');

  if (!env.config.targets) return;

  // merge root local and remote with target ones
  let target;
  Object.keys(env.config.targets).forEach(t => {
    target = env.config.targets[t];

    // merge target general to local and remote
    target.local = extend({}, target.general, target.local);
    target.remote = extend({}, target.general, target.remote);
    delete target.general;

    target.local = extend({}, env.config.local, target.local);
    target.remote = extend({}, env.config.remote, target.remote);
  });

  let selected;
  if (selectedTargets === 'ALL')
    selected = Object.keys(env.config.targets);
  else
    selected = selectedTargets.split(',');

  env.targets = [];

  let targetEnv;
  selected.forEach((target, index) => {
    if (!env.config.targets[target])
      return error(`unknown target: ${target}`);

    let color = colors.autoColor(target, index).dim;

    targetEnv = {
      name: target,
      config: env.config.targets[target],
      log: (msg, colr) => {
        return env.log(msg, colr, color(':' + target + ' '));
      }
    };

    makeExecLinks(targetEnv, {
      prefix: {
        target: color(':' + target)
      },
      ssh: {
        user: targetEnv.config.remote.user
      }
    });

    env.targets.push(targetEnv);
  });

  log('env.targets', env.targets);
  return env;
}

function yargsTargets(yargs) {
  let targets = config[yargs.envName].targets;

  for (let target in targets) {
    yargs.command(target);
  }

  yargs.command('ALL', 'run task for all targets');
}

function makeExecLinks(obj, options) {
  if (obj.config.remote) {
    if (!obj.config.remote.servers)
      return error(`${env.name}: no servers in remote section, ` +
        'config.remote: ' + JSON.stringify(env.config.remote, null, 2));

    if (obj.config.remote.path) options.ssh.cwd = obj.config.remote.path;
    obj.ssh = new SshCmd(obj.config.remote.servers, options);
    obj.remote = (...args) => obj.ssh.exec.apply(obj.ssh, args);
  }

  if (obj.config.local.path) options.cwd = obj.config.local.path;
  obj.shell = new Cmd(options);
  obj.local = (...args) => obj.shell.exec.apply(obj.shell, args);

  return obj;
}
