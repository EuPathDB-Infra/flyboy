const zaq = require('zaq');
const DeltaTable = require('./DeltaTable');
const {
  diverge,
  getCommonFilesByHash,
  getCommonFilesByFilename,
  findFileByFilename,
  getOnlyUniqueValues,
  makeSorter,
  unique,
  getListUniques,
  transformToFilenameList
} = require('../utils');

class MapDelta {
  constructor (fromState, toState, config) {
    this.fromState = fromState;
    this.toState = toState;
    this.config = config;
    if (!toState.getFlatStructure || !fromState.getFlatStructure)
      throw new TypeError(`Invalid dirs given to MapDelta: ${fromState.toString()}, ${toState.toString()}`);
    this.fromFiles = this.fromState.getFlatStructure();
    this.toFiles = this.toState.getFlatStructure();
    this.delta = {
      added: [],
      untouched: [],
      moved: [],
      removed: []
    };
    this.compute();
  }

  compute () {
    const { fromFiles, toFiles } = this;
    this.detectMoves(fromFiles, toFiles);
    this.detectAdditions(fromFiles, toFiles);
    this.detectDeletions(fromFiles, toFiles);
    return this.delta;
  }

  detectAdditions (fromFiles, toFiles) {
    fromFiles = transformToFilenameList(fromFiles);
    const additions = toFiles.filter(file => {
      return !fromFiles.includes(file.name);
    });
    this.delta.added = additions;
  }

  getMovedFiles () {
    return this.delta.moved;
  }

  getAddedFiles () {
    return this.delta.added;
  }

  getRemovedFiles () {
    return this.delta.removed;
  }

  getUntouchedFiles () {
    return this.delta.untouched;
  }

  getCommonFiles () {
    return [...this.getMovedFiles(), ...this.getUntouchedFiles()];
  }

  detectMoves (fromFiles, toFiles) {
    const hashMatches = getCommonFilesByHash(fromFiles, toFiles);
    const nameMatches = getCommonFilesByFilename(fromFiles, toFiles);
    const allMatches = unique([...hashMatches, ...nameMatches].sort(makeSorter('toPath')), ({ toPath }) => toPath);
    const uniqueMatches = getOnlyUniqueValues(allMatches);
    const [ movedFiles, unmovedFiles ] = diverge(uniqueMatches, ({ fromPath, toPath }) => toPath !== fromPath);
    this.delta.moved = movedFiles;
    this.delta.untouched = unmovedFiles;
  }

  detectDeletions (fromFiles, toFiles) {
    toFiles = transformToFilenameList(toFiles);
    const deletions = fromFiles.filter(file => {
      return !toFiles.includes(file.name);
    });
    this.delta.removed = deletions;
  }

  forecast () {
    const table = new DeltaTable(this.delta, this.config);
    zaq.log(table.render());
  }

  generateCommands () {
    const additions = this.generateAdditionCommands();
    const removals = this.generateRemovalCommands();
    const moves = this.generateMoveCommands();
    return [ ...additions, ...removals, ...moves ];
  }

  generateAdditionCommands () {
    const output = [];
    this.delta.added.forEach(addition => {
      if (addition.type === 'directory')
        output.push('svn mkdir ' + addition.uri);
      else if (addition.type === 'file')
        output.push('svn add ' + addition.uri);
    });
    return output;
  }

  generateRemovalCommands () {
    const output = [];
    this.delta.removed.forEach(removal => {
      output.push('svn rm ' + removal.uri);
    });
    return output;
  }

  generateMoveCommands () {
    const output = [];
    this.delta.moved.forEach(moved => {
      output.push('svn mv ' + moved.fromPath + ' ' + moved.toPath);
    });
    return output;
  }
};

module.exports = MapDelta;
