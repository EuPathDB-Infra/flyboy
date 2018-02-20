const fs = require('fs');
const zaq = require('zaq');
const path = require('path');
const chalk = require('chalk');
const MapDelta = require('./classes/MapDelta');
const MapSet = require('./classes/MapSet');
const {
  filterDirectories,
  findFileByUri,
  findFileByHash,
  applyTextChanges,
  getFileReferences,
  runShellScript,
  getResolvedShortName,
  localize
} = require('./utils');

class Flyboy {
  constructor (config) {
    const { from, to, base } = config;
    if (!Array.isArray(from)) throw new Error(`
      No "from" provided as CLI argument or within configuration.
      Use the -f <dir> flag or set the "from" property in this directory\'s "flyboy.json".
      Acceptable Values are directory paths or paths to .fmap.json files describing a file mapping.
    `);
    if (!Array.isArray(to)) throw new Error(`
      No "to" provided as CLI argument or within configuration.
      Use the -t <dir> flag or set the "to" property in this directory\'s "flyboy.json".
      Acceptable Values are directory paths or paths to .fmap.json files describing a file mapping.
    `);
    this.fromState = new MapSet(from, config);
    this.toState = new MapSet(to, config);
    this.delta = new MapDelta(this.fromState, this.toState, config);
    this.config = config;
  }

  forecast () {
    if (!this.config.quiet) this.delta.forecast();
  }

  generateScript (execute) {
    const { quiet } = this.config;
    if (!quiet) console.log();
    const { base } = this.config;
    if (!quiet) zaq.info(chalk.dim(`Generating shell script...`));
    const script = this.delta.generateCommands().join('\n');
    const outputFile = path.resolve(base, 'flyboy.sh');
    if (!quiet) zaq.info(chalk.dim('Writing to file ') + chalk.reset(outputFile + '...'));
    fs.writeFileSync(outputFile, script);
    if (!quiet) zaq.win('Saved migration script to ' + chalk.bold('flyboy.sh'));
    if (!quiet) zaq.weight(outputFile);
    if (!quiet && execute) zaq.info('Executing SVN shell script...')
    if (execute) runShellScript(outputFile);
    if (!quiet) console.log();
  }

  copyFiles (execute) {
    const { quiet } = this.config;
    if (!quiet) console.log();
    this.delta
      .getCommonFiles()
      .forEach(({ toPath, fromPath }) => {
        if (execute) fs.copyFileSync(fromPath, toPath);
        if (!quiet) zaq.info(`${chalk.dim(execute ? 'Copied' : 'Will Copy')} ${chalk.reset(fromPath)} ${chalk.reset.dim('to')} ${toPath}`);
      });
    if (!execute && !quiet)
      zaq.flag('Run this command again with the "execute" flag (-e/--execute) in order to copy the above files.');
    if (!quiet) console.log();
  }

  rebaseImports (affectSource = false, execute = false) {
    const { base } = this.config;
    const fromRoot = (_path) => path.relative(base, _path);
    const commonFiles = this.delta.getCommonFiles();

    const allChanges = commonFiles.map(file => {
      const sourcePathKey = (affectSource ? 'toPath' : 'fromPath');
      const sourcePath = file[sourcePathKey];
      const sourceContentKey = affectSource ? 'toContent' : 'fromContent';
      const sourceContent = file[sourceContentKey];
      const sourceContext = fromRoot(path.parse(sourcePath).dir);

      const destPathKey = (affectSource ? 'fromPath' : 'toPath');
      const destPath = file[destPathKey];
      const destContentKey = affectSource ? 'fromContent' : 'toContent';
      const destContent = file[destContentKey];
      const destContext = fromRoot(path.parse(destPath).dir);

      const referenceChanges = getFileReferences(sourceContent)
        .relative
        .map(reference => {
          const { start, end, match } = reference;
          const importedRelativePath = match;
          const importedFullPath = fromRoot(path.resolve(sourceContext, importedRelativePath));
          const importedFile = commonFiles.find(file => file[sourcePathKey].indexOf(importedFullPath) === 0);
          if (!importedFile) {
            zaq.warn(`Couldn't find imported file: ${importedFullPath} (as "${importedRelativePath}") from within ${sourcePath}`);
            return;
          }
          const replacementFullPath = importedFile[destPathKey];
          const replacementRelativePath = getResolvedShortName(localize(path.relative(destContext, replacementFullPath)));
          const lengthDifference = replacementRelativePath.length - importedRelativePath.length;
          return { start, end, original: importedRelativePath, replacement: replacementRelativePath };
        })
        .filter(({ original, replacement } = {}) => {
          return replacement && original !== replacement;
        });

      const count = referenceChanges.length;
      if (!count) return null;

      const newContent = applyTextChanges(sourceContent, referenceChanges);
      const changeList = referenceChanges.map(change => {
        return `${change.original} ${chalk.blue('-->')} ${change.replacement}`
      }).reduce((text, move) => text + `${move}\n`, '').trim();

      if (execute) fs.writeFileSync(destPath, newContent, 'utf-8');

      zaq.info(`${count} ${execute ? 'import' + (count !== 1 ? 's' : '') + ' updated' : 'import' + (count !== 1 ? 's' : '') + ' to update'} in file ${destPath}`, changeList);
      return Object.assign({}, file, { [destContentKey]: newContent })
    }).filter(item => item);

    if (!allChanges.length) zaq.warn(chalk.italic('No import statements need rewritten.'));
    if (!execute && allChanges.length) zaq.flag('Run this command again with the "execute" flag (-e/--execute) in order to execute the rewrite and edit the above files.');
    return allChanges;
  }
};

module.exports = Flyboy;
