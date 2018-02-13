const zaq = require('zaq');
const chalk = require('chalk');
const Table = require('cli-table');

const { generateObject } = require('../utils');
const dividerChars = generateObject(['top', 'top-mid', 'top-left', 'top-right', 'bottom', 'bottom-mid', 'bottom-left' , 'bottom-right', 'left', 'left-mid', 'mid', 'mid-mid', 'right', 'right-mid', 'middle'], '');


class DeltaTable {
  constructor (delta, config = {}) {
    this.delta = delta;
    this.config = config;
    return this;
  }

  getWrapper (color) {
    switch (color) {
      case 'green':
        return chalk.bgGreen.black;
      case 'cyan':
        return chalk.bgCyan.black;
      case 'yellow':
        return chalk.bgYellow.black;
      case 'red':
        return chalk.bgRed;
      default:
        return (content) => content;
    }
  }

  renderSubtable (action, set, color, getPath) {
    const table = new Table({
      chars: dividerChars,
      head: ['Action', 'File', 'Type', 'Path'].map(val => chalk.black.underline(val)),
      colWidths: [ 12, 35, 15 ]
    });
    const wrapper = this.getWrapper(color);
    const heading = `\n  ${set.length} ${action} paths. `;
    if (!set.length) return wrapper(heading);
    if (typeof getPath !== 'function') getPath = (file) => file.uri;

    set.forEach((file, index) => {
      if (index < 20 || this.config.verbose) table.push([
        action + ' ',
        (file.type === 'directory' ? '/' : '') + file.name,
        file.type,
        getPath(file) || chalk.dim('Unknown Path')
      ]);
      if (index === 20) table.push([
        '',
        chalk.bold(' + ' + (set.length - 20) + ' more.'),
        '',
        ''
      ]);
    });
    return wrapper(heading + '\n' + table.toString());
  }

  render () {
    const { added, untouched, moved, removed } = this.delta;
    const displayMovedPath = ({ fromPath, toPath }) => `${fromPath} => ${toPath}`;
    // zaq.info('DELTA', this.delta);
    return [
      this.renderSubtable('Added', added, 'green'),
      this.renderSubtable('Untouched', untouched, 'cyan'),
      this.renderSubtable('Moved', moved, 'yellow', displayMovedPath),
      this.renderSubtable('Removed', removed, 'red')
    ].join('\n');
  }
};

module.exports = DeltaTable;


/*
const { added, removed, untouched, moved } = this.delta;
const renderAddedLine = (file) => ` ${file.name}    ${chalk.dim('@')} ${file.toPath}`;
const renderUntouchedLine = (file) => ` ${file.name}    ${chalk.dim('@')} ${file.toPath}`;
const renderRemovedLine = (file) => ` ${chalk.bold.cyan('[ REMOVED ] ')} ${file.name}    ${chalk.dim('@')} ${file.uri}`;
const renderMovedLine = (file) => ` ${chalk.bold.cyan('[ MOVED ] ')} ${file.name}    ${file.fromPath}  ${chalk.cyan('=>')}  ${file.toPath}`;

const forecastText = [
  chalk.bgRed.bold(' ⌦ ' + removed.length + ' objects removed. '),
  chalk.bgGreen.bold(' ' + added.length + ' objects added. '),
  chalk.bgYellow.bold(' ' + untouched.length + ' objects untouched. '),
  chalk.bgBlue.bold(' ⎘ ' + moved.length + ' objects moved. ')
].join('\n');

return zaq.log(chalk.reset(forecastText));
`${chalk.red.bold(` ${removed.length} objects removed.`)}
${chalk.bgRed(removed.map(renderRemovedLine).join('\n'))}
${chalk.green.bold(` ${added.length} objects added.`)}
${chalk.bgGreen(added.map(renderAddedLine).join('\n'))}
${chalk.yellow.bold(`${untouched.length} objects untouched.`)}
${chalk.bgYellow.black(untouched.map(renderUntouchedLine).join('\n'))}
${chalk.blue.bold(`${moved.length} objects moved.`)}
${chalk.bgBlue(moved.map(renderMovedLine).join('\n'))}
    `));

*/
