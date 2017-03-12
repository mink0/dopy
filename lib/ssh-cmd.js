const extend = require('extend');
const Cmd = require('./cmd');
const colors = require('./colors');

class SshCmd {
  constructor(servers, options) {
    if (!servers || (Array.isArray(servers) && servers.length === 0))
      throw new Error('servers not specified');

    this.options = extend(true, {}, options);
    this.sshOptions = this.options.ssh || {};
    this.servers = [];

    if (!Array.isArray(servers)) servers = [servers];

    servers.forEach((srv, i) => {
      let opts = extend({}, options);

      if (this.sshOptions.user && srv.indexOf('@') === -1)
        srv = `${opts.ssh.user}@${srv}`;

      opts.prefix = {};

      let color = colors.autoColor(srv, i);

      opts.prefix.stdout = color(
        srv.indexOf('@') === -1 ? `@${srv}` : srv) + ' ';
      opts.prefix.stderr = opts.prefix.stdout.trim() + '::err ';
      opts.prefix.cmd = opts.prefix.stdout.trim() + ' > ';

      let p = this.options.prefix;
      if (p && p.target) opts.prefix.target = p.target;

      let cmd = new Cmd(opts);

      this.servers.push({
        name: srv,
        cmd: cmd
      });
    });
   }

  warpInSsh(command, sshOptions) {
    let options = extend(true, this.sshOptions, sshOptions);
    let args = [];

    if (/sudo/.test(command) || options.interactive)
      args.push('-tt');

    if (options.port)
      args = args.concat(['-p', options.port]);

    if (options.key)
      args = args.concat(['-i', options.key]);

    if (options.cwd)
      command = `cd ${options.cwd} && ${command}`;

    // escape single quotes for shell
    let escaped = command.replace(/'/g, "'\\''");

    args.push(`'${escaped}'`);

    return args;
  }

  sort(results) {
    let sorted = [];
    this.servers.forEach(srv => {
      for (var i = 0; i < results.length; i++) {
        if (results[i].cmd.indexOf(` ${srv.name} `) !== -1) {
          sorted.push(results[i]);
          break;
        }
      }
    });

    return Promise.resolve(sorted);
  }

  exec(command, options, cb) {
    if (typeof options !== 'object') var cb = options, options = {};
    options = extend(true, {}, this.options, options);

    let cmdArr = this.warpInSsh(command, options);
    cmdArr.unshift('ssh', null);

    let promises = [];
    this.servers.forEach(srv => {
      cmdArr[1] = srv.name;

      if (options.user) {
        if (srv.name.indexOf('@') === -1)
          cmdArr[1] =`${options.user}@${srv.name}`;
        else
          cmdArr[1] =`${options.user}@${srv.name.split('@')[1]}`;
      }

      promises.push(srv.cmd.exec(cmdArr.join(' '), options));
    });

    let all = Promise.all(promises);

    if (!cb) return all;

    all.then(res => { cb(null, res); }, err => { cb(err); });
  }

  /**
   * executes command on  each of the servers in series
   * @param  {[string]}   command [description]
   * @param  {[object]}   options [description]
   * @param  {[function]}   pFn
   *         Function that returns promise and executes with
   *         (srvName, execPromise, index, servers)
   * @param  {Function} cb      Callback function
   * @return {[type]}           Promise|Cb
   */
  execSeries(command, options, pFn, cb) {
    if (typeof options === 'function') {
      if (pFn === undefined)
        var cb = options, options = {};
      else
        var cb = pFn, pFn = options, options = {};
    } else {
      if (cb === undefined)
        var cb = pFn, pFn = null;
    }

    options = extend(true, {}, this.options, options);

    let exec = (srv) =>  {
      let cmdArr = this.warpInSsh(command, options);
      cmdArr.unshift('ssh', srv.name);

      return () => srv.cmd.exec(cmdArr.join(' '), options);
    };

    let tasks = [];
    this.servers.forEach((srv, index) => {
      if (pFn)
        tasks.push(pFn(srv.name, exec(srv), index, this.servers));
      else
        tasks.push(exec(srv));
    });

    let out = [];
    function runSerial(tasks) {
      var result = Promise.resolve();
      tasks.forEach(task => {
        result = result.then(() => {
          return task().then(res => {
            out.push(res);
          });
        });
      });

      return result;
    }

    let all = runSerial(tasks).then(() => out);

    if (!cb) return all;

    all.then(res => { cb(null, res); }, err => { cb(err); });
  }
}

module.exports = SshCmd;
