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
Simple run `DEBUG=* dp ` to see output from all running commands.

### Multitarget usage
Coming soon

## To be continued...
For more information you could check this deploy tasks: [deploy](https://github.com/mink0/deploy-by-dopy)

