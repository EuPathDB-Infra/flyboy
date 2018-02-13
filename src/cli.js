#!/usr/bin/env node
const chalk = require('chalk');
const cli = require('commander');
const zaq = require('zaq').as('Flyboy');
const Flyboy = require('./flyboy');

cli
  .version('0.0.1')
  .description(`
    ${chalk.bold.red('flyboy')} evaluates and augments the transition from one codebase organization to another.
    Wrangle and rearrange your project's files however you like, then flyboy will take care
    of all the "svn mv", "svn rm", ad inf., which is the usual process.

    - Set the "from" (${chalk.bold('-f, --from')}) and "to" (${chalk.bold('-t, --to')}) options to directory paths that reference
      project start and end states.
    - Set the "base" (${chalk.bold('-b, --base')}) option to specify the relative root/base when transitioning.
      ${chalk.blue('Defaults to current working directory.')}
    - Haven't used any 'svn mv' commands at all during your reorg? Same here.
      Just use a pristine checkout of your project as the "from" directory.
    ${chalk.yellow(`- [COMINGSOON] Use the '-g/--generate' flag to create a shell script file containing the SVN commands.`)}
    ${chalk.yellow(`- [COMINGSOON] Use the '-E/--execute' flag to execute the migration once the forecast
      is to your liking.`)}


    ${chalk.dim('Example Usage:')}

    flyboy -f ./View/webapp/WDK/js/client -t ./View/src`)
  .option('-f, --from [dor]', 'Set the "from" directory, representing the starting state.')
  .option('-t, --to [dir]', 'Set the "to" directory, representing the desired end state.')
  .option('-b, --base [dir]', 'Set the "base" directory, representing the desired end state.')
  .option('-v, --verbose', 'Set verbose mode. This will show all tentative operations instead of limiting each type to 20 rows.')
  .option('-q, --quiet', 'Set quiet mode. No forecast or other messages will be displayed (except errors!).')
  .option('-g, --generate', '[COMINGSOON].')
  .option('-E, --execute', '[COMINGSOON].')
  .parse(process.argv)

const { from, to, quiet, execute, verbose } = cli;
const rootDir = cli.base ? cli.base : process.cwd();
console.log(cli);
const instance = new Flyboy({ from, to }, { rootDir, verbose });
if (!quiet) instance.forecast();
