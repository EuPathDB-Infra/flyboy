const fs = require('fs');
const zaq = require('zaq');
const path = require('path');
const chalk = require('chalk');
const MapSet = require('./classes/MapSet');
const MapDelta = require('./classes/MapDelta');
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
 const {
   TEXT_TYPES,
   STYLE_TYPES,
   MAP_EXTENSION,
   CONFIG_FILENAME,
   MIGRATE_SCRIPT_NAME,
   RESOLVE_EXTENSIONS
 } = require('./constants');

class Flyboy {
  constructor (config) {
    const { from, to, base } = config;
    if (!Array.isArray(from)) throw new Error(`
      No "from" provided as CLI argument or within configuration.
      Use the -f <dir> flag or set the "from" property in this directory\'s "${CONFIG_FILENAME}".
      Acceptable Values are directory paths or paths to ${MAP_EXTENSION} files describing a file mapping.
    `);
    if (!Array.isArray(to)) throw new Error(`
      No "to" provided as CLI argument or within configuration.
      Use the -t <dir> flag or set the "to" property in this directory\'s "${CONFIG_FILENAME}".
      Acceptable Values are directory paths or paths to ${MAP_EXTENSION} files describing a file mapping.
    `);
    const fromState = new MapSet(from, config);
    const toState = new MapSet(to, config);
    this.mapDelta = new MapDelta(fromState, toState, config);
    this.config = config;
  }

  forecast () {
    if (!this.config.quiet) this.mapDelta.forecast();
  }

  generateScript (kind = '', execute) {
    kind = (typeof kind === 'string' ? kind.toLowerCase() : null);
    if (!['git', 'svn'].includes(kind))
      throw new Error(`Invalid script kind provided: use either 'git' or 'svn'. Got: ` + kind);
    const { quiet } = this.config;
    if (!quiet) console.log();
    const { base } = this.config;
    if (!quiet) zaq.info(chalk.dim(`Generating shell script...`));
    const script = this.mapDelta.generateCommands(kind).join('\n');
    const outputFile = path.resolve(base, MIGRATE_SCRIPT_NAME);
    if (!quiet) zaq.info(chalk.dim('Writing to file ') + chalk.reset(outputFile + '...'));
    fs.writeFileSync(outputFile, script);
    if (!quiet) zaq.win('Saved migration script to ' + chalk.bold(MIGRATE_SCRIPT_NAME));
    if (!quiet) zaq.weight(outputFile);
    if (!quiet && execute) zaq.info('Executing SVN shell script...')
    if (execute) runShellScript(outputFile);
    if (!quiet) console.log();
  }

  static createConfig (options) {
    const config = Object.keys(options).reduce((output, optionKey) => {
      const optionValue = options[optionKey];
      if (optionValue === null) return output;
      if (optionKey === 'base' && options[optionKey] === process.cwd()) return output;
      return Object.assign({}, output, { [optionKey]: optionValue })
    }, {});
    const filePath = path.resolve(process.cwd(), './' + CONFIG_FILENAME);
    fs.writeFileSync(filePath, zaq.pretty(config));
    if (!options.quiet) zaq.info(`Saved configuration to ${chalk.blue(filePath)}...`, config);
  }

  copyFiles (execute) {
    const { quiet } = this.config;
    if (!quiet) console.log();
    this.mapDelta
      .getCommonFiles()
      .forEach(commonFile => {
        const { toPath, fromPath, modified, fromContent, fromVirtual } = commonFile;
        if (!modified) return zaq.info(`${chalk.dim('Destination file')} ${chalk.reset.cyan(toPath)} ${chalk.dim('not modified, skipping.')}`)
        if (fromVirtual && !fromContent) return zaq.warn(`Can't copy non-text source file "${fromPath}" from JSON map. Use a live directory instead of a JSON map to copy this file.`);
        if (execute) {
          if (fromVirtual) fs.writeFileSync(toPath, fromContent, 'utf-8');
          else fs.copyFileSync(fromPath, toPath);
        }
        if (!quiet) zaq.info(`${chalk.dim(execute ? 'Copied' : 'Will Copy')} ${chalk.reset(fromPath)}${fromVirtual ? chalk.dim(' [VIRTUAL]') : ''} ${chalk.reset.dim('to')} ${toPath}`);
      });
    if (!execute && !quiet)
      zaq.flag('Run this command again with the "execute" flag (-e/--execute) in order to copy the above files.');
    if (!quiet) console.log();
  }

  rebaseImports (affectSource = false, execute = false) {
    const { base, moduleRoot, verbose } = this.config;
    const fromRoot = (_path) => path.relative(base, _path);
    const commonFiles = this.mapDelta.getCommonFiles();
    const invalidImports = [];

    const allChanges = commonFiles.map(file => {
      if (!TEXT_TYPES.includes(file.toExt.toLowerCase())) return null;
      const sourcePathKey = (affectSource ? 'fromPath' : 'toPath');
      const sourcePath = file[sourcePathKey];
      const sourceContentKey = affectSource ? 'fromContent' : 'toContent';
      const sourceContent = file[sourceContentKey];
      const sourceContext = fromRoot(path.parse(sourcePath).dir);

      const destPathKey = (affectSource ? 'toPath' : 'fromPath');
      const destPath = file[destPathKey];
      const destContentKey = affectSource ? 'toContent' : 'fromContent';
      const destContent = file[destContentKey];
      const destContext = fromRoot(path.parse(destPath).dir);


      const referenceChanges = getFileReferences(sourceContent)
        .relative
        .map(reference => {
          const { start, end, match } = reference;
          const importedRelativePath = match;
          const importedFullPath = fromRoot(path.resolve(sourceContext, importedRelativePath));
          const importedFile = commonFiles.find(file => {
            const filePath = file[sourcePathKey];
            if (filePath === importedFullPath)
              return true;
            if (filePath.toLowerCase() === importedFullPath.toLowerCase())
              return true;
            if (RESOLVE_EXTENSIONS.some(extension => (filePath === importedFullPath + extension) || (filePath === `${importedFullPath}/index.${extension}`)))
              return true;
            return false;
          });
          if (!importedFile) {
            zaq.warn(`Couldn't find imported file: ${importedFullPath} (as "${importedRelativePath}") from within ${sourcePath}`);
            invalidImports.push({ importedFullPath, importedFullPath, sourcePath });
            return;
          };
          const replacementFullPath = importedFile[destPathKey];
          const useModuleBasis = moduleRoot && !STYLE_TYPES.includes(importedFile.toExt);
          const replacementRelativePath = path.relative(useModuleBasis ? path.resolve(base, moduleRoot) : destContext, replacementFullPath);
          const replacement = getResolvedShortName(useModuleBasis  ? replacementRelativePath : localize(replacementRelativePath));
          const lengthDifference = replacement.length - importedRelativePath.length;
          return { start, end, original: importedRelativePath, replacement };
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

    if (invalidImports.length) {
      const invalidCount = invalidImports.length;
      zaq.warn(`${invalidCount} import${invalidCount === 1 ? '' : 's'} couldn't be resolved, and will not be updated. See above output for details.`);
    }
    if (!allChanges.length) zaq.warn(chalk.italic('No import statements need rewritten.'));
    if (!execute && allChanges.length) zaq.flag('Run this command again with the "execute" flag (-e/--execute) in order to execute the rewrite and edit the above files.');
    return allChanges;
  }
};

module.exports = Flyboy;
