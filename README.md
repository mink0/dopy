## Dopy
Yep, we deploy a lot.

### Keys fetures
  * remote tasks by system's OpenSSH SSH client
  * extensive bash completion support using [yargs](https://github.com/yargs/yargs)
  * environment inheritance
  * environment templating by [mustache](https://mustache.github.io/)
  * multi server and multitarget environments support
  * yaml environment templates

### Installation using *dopy-cli*
  1. Install `dopy` globally: `npm -g install dopy`. You could run `dp` anywhere after that.

  2. Create directory structure:

  ```
  deploy/
  |
  ├─ envs/
  |   ├─ default.yml
  |   ├─ dev.yml
  |   └─ prod.yml
  |   └─ ...
  |
  └─ tasks/
        ├─ my-task1.js
        └─ my-task2.js
        └─ ...
  ```
  You should have both `/envs` and `/tasks` directories.

  3. Add environment files to `/envs` dir:

    default.yml:

    ```yaml
    ---
    web-app:
      # root for `web-app` environment

      general:
        # this will be merged to the remote and local section
        repo: git@github.com:user/git.git

      remote:
        # settings for the commands that will be run remotely
        log:
          nginx: /var/log/nginx/nginx.log
          app: '{{{ applog }}}/app.log'

      local:
        # settings for the commands that will be run localy
        path: /home/user/repo
    ```

    dev.yml:

    ```yaml
    ---
    parent: web-app # inherit all props from web-app
    template:
      applog: /home/app
    development:
      remote:
        servers: alpha.domain.com
    test:
      remote:
        servers: beta.domain.com
    ```

    prod.yml:

    ```yaml
    ---
    parent: web-app # inherit all props from web-app
    template:
      applog: /var/log
    production:
      remote:
        servers:
          - user@prod-01.domain.com
          - user@prod-02.domain.com
    ```

  4. Add your tasks to `/tasks` dir. For example simple log task:

    log.js

    ```js
    exports.command = 'log [type]';

    exports.desc = 'Show logs at remote server';

    exports.task = (env, argv) => {
      let logs = env.config.remote.log;

      if (!logs) return taskCb('no logs configured for ' + env.name);

      let path = (typeof logs === 'object') ? logs[argv.type || 'app'] : logs;

      return env.remote(`tail -n100 -f ${path}`, { verbose:true });
    };
    ```
    Where:
      - `env` is the object containing main `dopy` worker methods such as `.remote` and `.local`.
      - `argv` parsed arguments

  5. Run `dp` from the root directory:
    `dp development log`
    `dp production log nginx`

    You could also specify root path with `--cwd` option and run:
    `dp --cwd ~/deploy test log`

    You could even make an alias in your `.bashrc` file:
    `alias dp="dp --cwd ~/deploy"` and run `dp` with your tasks anywhere


### Installation using *dopy api*
1. Run `npm install dopy`

2. Create a `.js` file:

```js
const dopy = require('dopy');

let envs = {
  webApp: {
    remote: {
      repo: 'git@github.com:user/git.git',
      log: {
        nginx: '/var/log/nginx/nginx.log',
        app: '{{{ applog }}}/app.log'
      },
    }
  },
  dev: {
    parent: 'webApp',
    template: {
      applog: '/home/app'
    },
    remote: {
      servers: '192.168.10.113'
    }
  },
  prod: {
    parent: 'webApp',
    template: {
      applog: '/var/log/app'
    },
    remote: {
      servers: [
        'user@prod-01.domain.com',
        'user@prod-02.domain.com'
      ]
    }
  }
};

function task(env) {
  let repo = env.config.remote.repo;
  return env.local('pwd; ls -a').then(() => env.remote(`git clone ${repo}`));
}

dopy.run(task, dopy.config.initEnv('dev', envs));
```

### Install bash completions
See `dp completions` output and run `dp completions >> ~/.bashrc` or
`dp completions >> ~/.bash_profile`.
Open new terminal session.
After that you will be able to use bash completions in your tasks.

### Debug
Run `DEBUG=* dp ` to see verbose output from all running commands.

### Multitarget usage
If you have multiple applications (deployable parts) installed on the same servers, you could use targets:

/envs/production.yml:

```yaml
---
production:
  remote:
    servers:
      - user@prod-01.domain.com
      - user@prod-02.domain.com
  targets:
    framework:
      remote:
        path: /var/www/app
    api:
      remote:
        path: /var/www/app/api
    frontend:
      remote:
        path: /var/www/app/public
```

Than add `targets` as command argument at your task file:
`exports.command = 'taskname [targets]';`

Or init it manually:
`dopy.config.initTargets(argv.targets);`

After that `env` instance will have `targets` property with array of targets. Each target is have `.remote` and `.local` methods for runnning commands. You are free to control the order and how command will be executed for each target.

----------

Methods of the env object
=======

.local(command, [options](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback), [callback])
----
Execute local *command* through the system shell using [execa](https://github.com/sindresorhus/execa). It takes a *callback* or returns a promise. Returns error or result object which contains stdout, stderr and exit code and some other useful information. See [exaca](https://github.com/sindresorhus/execa#execashellcommand-options) for details. If `mute` is set to `false` (by default) it will pipe stdout and stderr to the console.

Additional options are:
---
#### prefix
Type: object
Default:

```js
{
  cmd: '> ',
  stdout: '  ',
  stderr: '@err '
}
```

#### verbose
Default: `false`
If set to `true` it will print the running command before execution

#### mute
Default: `false`
If set to `true` no output will be redirected to the console. You will get error and the result object when command is finished.


.remote(command, [options](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback), [callback])
----
Execute *command* on the remote servers **in parallel** through system's OpenSSH client. So you should install and setup `ssh` client first. It takes a *callback* or returns a promise. Returns error or array of results matching the order of servers set in configuration. If you want to use remote commands in your deploy task you should set `servers` in your configuration:

```yaml
web:
  remote:
    servers:
      - user@prod-01.domain.com
      - user@prod-02.domain.com
      - user@prod-03.domain.com
      ...
```
NB: You could use some advanced bash scripting like this:
`env.reomte('git describe --tags $(git rev-parse origin/master)'`

NB: If you want to run the commands **in serial** (command will be run at the next server only when it will finish at the previous server) you could use: `env.ssh.execSeries`.

All ssh-specific options are grouped in `options.ssh` object.

Additional options are:
---
#### ssh.user
This user will be used to login to servers.

### ssh.interactive
Default: `false`
Ssh session will be spawn with `-tt` option for the interactive input.
NB: Any command containing `sudo` will be set as interactive.

### ssh.port
Ssh session will be spawn with `-p` option to specify port to connect to on the remote host.

### ssh.key
Selects a file from which the identity (private key) for public key authentication is read.

### ssh.cwd
Specify current working dir for the remote command to run.

-----------------------------------------------------

.log(message, color)
---
Fancy print log messages to the console. Servers and targets will be properly prefixed using various colors for easy reading.

## To be continued...
For more information you could check this deploy tasks: [deploy](https://github.com/mink0/deploy-by-dopy)

