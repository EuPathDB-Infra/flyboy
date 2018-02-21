#!/usr/bin/env node
const fs = require('fs');
const cwd = process.cwd();
const path = require('path');
const chalk = require('chalk');
const cli = require('commander');
const Flyboy = require('./flyboy');
const MapSet = require('./classes/MapSet');
const zaq = require('zaq').as('Flyboy');
const { version } = require('../package');
const { fileExists, displayObject } = require('./utils');
const { CONFIG_FILENAME, MIGRATE_SCRIPT_NAME, MAP_EXTENSION } = require('./constants');

cli.version(version)
  .description(`
    ${chalk.bold.yellow('flyboy')} evaluates and augments the transition from one codebase organization to another.

    - Set the "from" (${chalk.bold('-f, --from')}) and "to" (${chalk.bold('-t, --to')}) options to directory paths that reference
      project start and end states.
    - Set the "base" (${chalk.bold('-b, --base')}) option to specify the relative root/base when transitioning.
      ${chalk.dim.italic('Defaults to current working directory.')}
    - Place a ${chalk.green(`"${CONFIG_FILENAME}"`)} file in your working directory containing the same options you'd pass via command-line
      (except use camelCase instead of snake-case; i.e. if you'd use the option "--invert-rebase", set { "invertRebase": true } in your json).
      This file can be easily generated using the ${chalk.bold('flyboy config')} command.

      ${chalk.bold('The following commands are available (and may likely be used in this order):')}

      ${chalk.cyan('flyboy map <inputDir> <outputFileName>')}
          Creates a JSON map of the given <inputDir>.
          This file can be consumed flyboy as if it were an actual directory, and can preserve the state of a directory for later comparison or migration.
          The map will be saved as ${chalk.italic('<outputFileName>')}${MAP_EXTENSION} in flyboy's.
          Files with this dual extension are effectively ignored by flyboy when mapping directories.

      ${chalk.cyan('flyboy config [...args]')}
          Pass arguments to the "config" command to save them as your default configuration.
          If you run the following:
              ${chalk.blue('flyboy config -f initialState.fmap.json -m ./src')}
          The following ${chalk.italic('.flyboyrc')} is generated:
              ${chalk.blue(`{ "from": "initialState${MAP_EXTENSION}", "moduleRoot": "./src" }`)}

      ${chalk.cyan('flyboy status')}
          Prints a table indicating the files which are to be added, removed, moved, or left untouched.
          Use with -v to see the full list (by default, limited to first 20 items per list).

      ${chalk.cyan('flyboy rebase')}
          Rewrite destination file "import" statements to reflect changes in project architecture.
          Affected import statements include ES6 import statements, as well as CSS/SCSS @import statements.
          Does a dry run unless the execute (-e) flag is given.

      ${chalk.cyan('flyboy copy')}
          Copy known common files from source/"from" structure to destination/"to" structure.
          Useful to "undo" changes made to destination files. If you ran ${chalk.bold('rebase')}, and have changed file/directory structure afterward, run ${chalk.bold('copy')} to "reset" the files.
          Does a dry run unless the execute (-e) flag is given.

      ${chalk.cyan('flyboy generate <git|svn>')}
          Generates a shell script ("${MIGRATE_SCRIPT_NAME}") containing the git or svn mkdir/rm/mv commands, based on given from/to states.
          Immediately run the script after generation by passing the execute (-e) flag.
  `)
  .option('-f, --from [dir]', 'Set the "from" directory, representing the starting state. Optionally provide multiple directories separated by commas.')
  .option('-t, --to [dir]', 'Set the "to" directory, representing the desired end state. Optionally provide multiple directories separated by commas.')
  .option('-b, --base [dir]', 'Set the "base" directory, representing the desired end state.')
  .option('-m, --module-root [dir]', 'Set a webpack-style "module" root directory. When running "rebase", import paths will be relative to this root instead of to their respective source files.')
  .option('-s, --strict', 'Set strict mode. In strict mode, files which do not exactly match in content or in unique filenames will not be detected as having moved (and instead will appear "deleted" from source, and "added" to destination.)')
  .option('-v, --verbose', 'Set verbose mode. This will show all tentative operations instead of limiting each type to 20 rows.')
  .option('-q, --quiet', 'Set quiet mode. No forecast or other messages will be displayed (except errors!).')
  .option('-e, --execute', 'Destructive commands do a "dry run" unless this option is passed.')
cli.parse(process.argv)

const configPath = path.resolve(cwd, '.flyboyrc');
const config = fileExists(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : null;

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
  moduleRoot: getOptionValue('moduleRoot'),
  rebaseSource: getOptionValue('rebaseSource')
};

if (!options.quiet && config) zaq.info('Using configuration from path:', chalk.blue(configPath));
if (!options.quiet && options.verbose) zaq.info('Using options:', displayObject(options));

cli.command('map <inputDir> <filename>', `Creates a JSON map of the given <inputDir>, saved to <filename>${MAP_EXTENSION}.`)
  .action((dir, filename) => (new MapSet(listify(dir), options)).writeMapToFile(filename));

cli.command('config', 'Pass arguments to the "config" command to save them as your default configuration.')
  .action(kind => Flyboy.createConfig(options));

cli.command('status', 'Prints a table indicating the files which are to be added, removed, moved, or left untouched.')
  .action(() => (new Flyboy(options)).forecast());


cli.command('rebase', 'Rewrite destination file "import" statements to reflect changes in project architecture.')
  // .option('-i, --invert-rebase', 'When used with the "rebase" command, this will overwrite the "import" statements in text files in the source ("from") directory instead of destination ("to") directory.')
  .action(invertRebase => (new Flyboy(options)).rebaseImports(invertRebase, options.execute));


cli.command('copy', 'Copy known common files from source/"from" structure to destination/"to" structure.')
  .action(() => (new Flyboy(options)).copyFiles(options.execute));

cli.command('generate <kind>', `Generates a shell script ("${MIGRATE_SCRIPT_NAME}") containing the git or svn commands, based on given from/to states.`)
  .action(kind => (new Flyboy(options)).generateScript(kind, options.execute));

cli.parse(process.argv.length === 2 ? [...process.argv, '-h'] : process.argv);
