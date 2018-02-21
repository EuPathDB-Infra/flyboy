const chalk = require('chalk');
const zaq = require('zaq').as('MapDelta');

const DeltaTable = require('./DeltaTable');
const {
  diverge,
  getCommonFilesByHash,
  getCommonFilesByFilename,
  getCommonFilesBySimilarity,
  findFileByFilename,
  getOnlyUniqueValues,
  makeSorter,
  unique,
  getMigrantFileStats,
  getListUniques,
  filterDirectories,
  transformToFilenameList
} = require('../utils');

class MapDelta {
  constructor (fromState, toState, config) {
    this.config = config;
    if (!toState.getFlatStructure || !fromState.getFlatStructure)
      throw new TypeError(`Invalid dirs given to MapDelta: ${fromState.toString()}, ${toState.toString()}`);
    this.fromFiles = fromState.getFlatStructure();
    this.toFiles = toState.getFlatStructure();
    this.delta = { added: [], untouched: [], moved: [], removed: [] };
    this.compute();
    this.detectMismatches = this.detectMismatches.bind(this);
  }

  compute () {
    const { config, fromFiles, toFiles } = this;
    this.detectMoves(fromFiles, toFiles);
    this.detectAdditions(fromFiles, toFiles);
    this.detectDeletions(fromFiles, toFiles);
    this.detectMismatches();
    return this.delta;
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

  detectAdditions (fromFiles, toFiles) {
    fromFiles = transformToFilenameList(fromFiles);
    const additions = toFiles.filter(file => {
      return !fromFiles.includes(file.name);
    });
    this.delta.added = additions;
  }

  detectMismatches (fromFiles, toFiles) {
    if (this.config.strict) zaq.warn('YO LOL WTF');
    const removed = filterDirectories(this.delta.removed);
    const added = filterDirectories(this.delta.added);
    const alterations = getCommonFilesBySimilarity(removed, added);
    if (!alterations.length) return;

    const matchedSourcePaths = alterations.map(({ fromPath }) => fromPath);
    const matchedDestinationPaths = alterations.map(({ toPath }) => toPath);
    const actuallyRemoved = this.delta.removed.filter(file => !matchedSourcePaths.includes(file.uri));
    const actuallyAdded = this.delta.added.filter(file => !matchedDestinationPaths.includes(file.uri));

    this.delta.moved = [ ...this.delta.moved, ...alterations ];
    this.delta.added = actuallyAdded;
    this.delta.removed = actuallyRemoved;
  }

  forecast () {
    const table = new DeltaTable(this.delta, this.config);
    zaq.log(table.render());
  }

  generateCommands (kind) {
    const additions = this.generateAdditionCommands(kind);
    const removals = this.generateRemovalCommands(kind);
    const moves = this.generateMoveCommands(kind);
    return [ ...additions, ...removals, ...moves ];
  }

  generateAdditionCommands (kind) {
    const output = [];
    this.delta.added.forEach(addition => {
      if (addition.type === 'directory' && kind === 'svn')
        output.push(kind + ' mkdir ' + addition.uri);
      else if (addition.type === 'file')
        output.push(kind + ' add ' + addition.uri);
    });
    return output;
  }

  generateRemovalCommands (kind) {
    const output = [];
    this.delta.removed.forEach(removal => {
      output.push(kind + ' rm ' + removal.uri);
    });
    return output;
  }

  generateMoveCommands (kind) {
    const output = [];
    this.delta.moved.forEach(moved => {
      output.push(kind + ' mv ' + moved.fromPath + ' ' + moved.toPath);
    });
    return output;
  }
};

module.exports = MapDelta;
