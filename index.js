const errors = require('./lib/errors');
const config = require('./lib/config');
const colors = require('./lib/colors');

class Dopy {

}

// Let people use this class from our instance
Dopy.prototype.Dopy = Dopy;

Dopy.prototype.config = config;

Dopy.prototype.colors = colors;

Dopy.prototype.errors = errors;

Dopy.prototype.run = run;

var inst = new Dopy();

module.exports = inst;

/**
 * run task
 * @param  {obj} task env
 * @param  {obj} yargs argv
 * @param  {function} task
 */
function run(task, env, argv) {
  let res = task(env, argv, done);

  if (typeof res === 'object' && res.then)
    res.then(() => done(), (err) => done(err));

  function done(err) {
    if (err) return errors.critical(err);

    env.log('all tasks are completed!');
    process.exit(0);
  }
}
