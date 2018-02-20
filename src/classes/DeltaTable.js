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
      case 'green': return chalk.bgGreen.black;
      case 'cyan': return chalk.bgBlue;
      case 'yellow': return chalk.bgYellow.black;
      case 'red': return chalk.bgRed;
      default: return (content) => content;
    }
  }

  renderSubtable (action, set, color, getPath) {
    const table = new Table({
      chars: dividerChars,
      head: ['Action', 'File', 'Type', 'Path'].map(val => chalk.black.underline(val)),
      colWidths: [ 12, 30, 6, process.stdout.columns - 62 ]
    });
    const wrapper = this.getWrapper(color);
    const heading = `\n  ${set.length} ${action} paths. `;
    if (!set.length) return wrapper(heading);
    if (typeof getPath !== 'function') getPath = (file) => file.uri;

    set.forEach((file, index) => {
      if (index < 20 || this.config.verbose) table.push([
        action + ' ',
        (file.type === 'directory' ? '/' : '') + file.name,
        (file.type === 'directory' ? 'dir' : file.type),
        getPath(file) || chalk.dim('Unknown Path')
      ]);
      if (index === 20 && !this.config.verbose) table.push([ '', chalk.italic(' + ' + (set.length - 20) + ' more.'), '', '' ]);
    });
    return wrapper(heading + '\n' + table.toString());
  }

  render () {
    const { added, untouched, moved, removed } = this.delta;
    const displayMovedPath = ({ fromPath, toPath }) => `${fromPath} ${chalk.white('-->')} ${toPath}`;
    return [
      this.renderSubtable('Untouched', untouched, 'cyan'),
      this.renderSubtable('Removed', removed, 'red'),
      this.renderSubtable('Added', added, 'green'),
      this.renderSubtable('Moved', moved, 'yellow', displayMovedPath)
    ].join('\n');
  }
};

module.exports = DeltaTable;
