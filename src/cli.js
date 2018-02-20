#!/usr/bin/env node
const chalk = require('chalk');
const cli = require('commander');
const path = require('path');
const zaq = require('zaq').as('Flyboy');
const Flyboy = require('./flyboy');
const { fileExists, displayObject } = require('./utils');
const cwd = process.cwd();

cli
  .version('0.0.2')
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
    - Use the "generate" (${chalk.bold('-g/--generate')}) flag to create a shell script file containing the SVN commands.
    - Place a "flyboy.json" file in your working directory containing the same options you'd pass via command-line
      (except use camelCase instead of snake-case; i.e. if you'd use the option "--rewrite-imports", set { "rewriteImports": true } in your json)

    ${chalk.dim('Example Usage:')}

    flyboy -f ./View/webapp/WDK/js/client -t ./View/src`)
  .option('-f, --from [dir]', 'Set the "from" directory, representing the starting state.')
  .option('-t, --to [dir]', 'Set the "to" directory, representing the desired end state.')
  .option('-b, --base [dir]', 'Set the "base" directory, representing the desired end state.')
  .option('-v, --verbose', 'Set verbose mode. This will show all tentative operations instead of limiting each type to 20 rows.')
  .option('-q, --quiet', 'Set quiet mode. No forecast or other messages will be displayed (except errors!).')
  .option('-g, --generate', 'Generate a shell script "flyboy.sh" containing the SVN commands.')
  .option('-c, --copy', 'Copy known common files from source/"from" structure to destination/"to" structure. Useful to update stale files prior to SVN reorginazation.')
  .option('-r, --rewrite-imports', 'Rewrite destination file import statements to reflect changes in project architecture. This affects files in the destination ("to") directory, unless the -s option is supplied.')
  .option('-s, --rewrite-source-imports', 'When used with the -r option, this will overwrite the "import" statements in text files in the source ("from") directory.')
  .option('-x, --reset-import-context', 'When used with the -r option, this will reset any "import" statements to reference their original paths. For instance, if you\'ve rewritten import statements in your source/"from" folder to reference the new architecture of your destination/"to", use `flyboy -rsc` to reset their paths to reference the original "from" folder locations.')
  .option('-e, --execute', 'Rewrite functionality does a "dry run" unless this option is passed.')
  .parse(process.argv);

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

let options = {
  base: getOptionValue('base', cwd),
  to: listify(getOptionValue('to')),
  from: listify(getOptionValue('from')),
  quiet: getOptionValue('quiet'),
  copy: getOptionValue('copy'),
  execute: getOptionValue('execute'),
  verbose: getOptionValue('verbose'),
  generate: getOptionValue('generate'),
  rewriteImports: getOptionValue('rewriteImports'),
  rewriteSourceImports: getOptionValue('rewriteSourceImports'),
  rewriteImportContext: getOptionValue('rewriteImportContext')
}

if (!options.quiet && config) zaq.info('Using configuration at path:', chalk.blue(configPath));
if (!options.quiet && options.verbose) zaq.info('Using options:', displayObject(options));

const instance = new Flyboy({
  from: options.from,
  to: options.to
}, {
  rootDir: options.base,
  verbose: options.verbose,
  quiet: options.quiet
});

if (!options.quiet) instance.forecast();
if (options.copy) instance.copyFiles(options.execute);
if (options.generate) instance.generateScript(options.execute);
if (options.rewriteImports) instance.rewriteImports(options.rewriteSourceImports, options.execute);
