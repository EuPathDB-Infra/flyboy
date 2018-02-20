#!/usr/bin/env node
const cwd = process.cwd();
const path = require('path');
const chalk = require('chalk');
const cli = require('commander');
const Flyboy = require('./flyboy');
const MapSet = require('./classes/MapSet');
const zaq = require('zaq').as('Flyboy');
const { version } = require('../package');
const { fileExists, displayObject } = require('./utils');

cli.version(version)
  .description(`
    ${chalk.bold.red('flyboy')} evaluates and augments the transition from one codebase organization to another.
    Wrangle and rearrange your project's files however you like, then flyboy will take care
    of all the "svn mv", "svn rm", ad inf., which is the usual process.

    - Set the "from" (${chalk.bold('-f, --from')}) and "to" (${chalk.bold('-t, --to')}) options to directory paths that reference
      project start and end states.
    - Set the "base" (${chalk.bold('-b, --base')}) option to specify the relative root/base when transitioning.
      ${chalk.blue.italic('Defaults to current working directory.')}
    - Haven't used any 'svn mv' commands at all during your reorg? Same here.
      Just use a pristine checkout of your project as the "from" directory.
    - Use the "generate" (${chalk.bold('-g/--generate')}) flag to create a shell script file containing the SVN commands.
    - Place a ${chalk.green('"flyboy.json"')} file in your working directory containing the same options you'd pass via command-line
      (except use camelCase instead of snake-case; i.e. if you'd use the option "--rebase-source", set { "rebaseSource": true } in your json)

      ${chalk.bold('The following commands are available:')}

      ${chalk.cyan('flyboy status')}
          Prints a table indicating the files which are to be added, removed, moved, or left untouched.
          Use with -v to see the full list (by default, limited to first 20 items per list).
      ${chalk.cyan('flyboy rebase')}
          Rewrite destination file "import" statements to reflect changes in project architecture.
          Affected import statements include ES6 import statements, as well as CSS/SCSS @import statements.
          This affects files in the destination ("to") directory, unless the -s option is supplied.
          Does a dry run unless the execute (-e) flag is given.
      ${chalk.cyan('flyboy copy')}
          Copy known common files from source/"from" structure to destination/"to" structure.
          Useful to update stale files prior to SVN reorginazation.
          Does a dry run unless the execute (-e) flag is given.
      ${chalk.cyan('flyboy generate')}
          Generate a shell script "flyboy.sh" containing the SVN mkdir/rm/mv commands.
          Immediately run the script after generation by passing the execute (-e) flag.
      ${chalk.cyan('flyboy map <inputDir> <outputFileName>')}

    ${chalk.dim('Example Usage:')}

    flyboy -f ./View/webapp/WDK/js/client -t ./View/src`)
  .option('-f, --from [dir]', 'Set the "from" directory, representing the starting state. Optionally provide multiple directories separated by commas.')
  .option('-t, --to [dir]', 'Set the "to" directory, representing the desired end state. Optionally provide multiple directories separated by commas.')
  .option('-b, --base [dir]', 'Set the "base" directory, representing the desired end state.')
  .option('-v, --verbose', 'Set verbose mode. This will show all tentative operations instead of limiting each type to 20 rows.')
  .option('-q, --quiet', 'Set quiet mode. No forecast or other messages will be displayed (except errors!).')
  .option('-e, --execute', 'Destructive commands do a "dry run" unless this option is passed.')
cli.parse(process.argv)

const configPath = path.resolve(cwd, 'flyboy.json');
const config = fileExists(configPath) ? require(configPath) : null;

function getOptionValue (option, defaultValue = null) {
  if (typeof cli[option] !== 'undefined') return cli[option];
  if (config && typeof config[option] !== 'undefined') return config[option];
  return defaultValue;
}

function listify (value) {
  return typeof value === 'string'
    ? value.split(',')
    : Array.isArray(value)
      ? value
      : null;
}

const options = {
  base: getOptionValue('base', cwd),
  to: listify(getOptionValue('to')),
  from: listify(getOptionValue('from')),
  quiet: getOptionValue('quiet'),
  execute: getOptionValue('execute'),
  verbose: getOptionValue('verbose'),
  rebaseSource: getOptionValue('rebaseSource')
};

if (!options.quiet && config) zaq.info('Using configuration from path:', chalk.blue(configPath));
if (!options.quiet && options.verbose) zaq.info('Using options:', displayObject(options));

cli.command('status')
  .action(() => (new Flyboy(options)).forecast());

cli.command('copy')
  .action(() => (new Flyboy(options)).copyFiles(options.execute));

cli.command('generate')
  .action(() => (new Flyboy(options)).generateScript(options.execute));

cli.command('rebase')
  .option('-s, --rebase-source', 'When used with the "rebase" command, this will overwrite the "import" statements in text files in the source ("from") directory instead of destination ("to") directory.')
  .action(rebaseSource => (new Flyboy(options)).rebaseImports(rebaseSource, options.execute));

cli.command('map <inputDir> <outputFilename>')
  .action((dir, outputFilename) => (new MapSet(listify(dir), options)).writeMapToFile(outputFilename));

cli.parse(process.argv);
