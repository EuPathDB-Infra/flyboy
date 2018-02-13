const zaq = require('zaq');
const DeltaTable = require('./DeltaTable');
const {
  diverge,
  getCommonFilesByHash,
  getCommonFilesByFilename,
  findFileByFilename,
  getOnlyUniqueValues,
  getListUniques,
  transformToFilenameList
} = require('../utils');

class MapDelta {
  constructor (fromState, toState, config) {
    this.fromState = fromState;
    this.toState = toState;
    this.config = config;
    if (!toState.getFlatStructure || !fromState.getFlatStructure)
      return Error('Invalid dirs.');
    this.compute();
  }

  compute () {
    this.delta = {
      added: [],
      untouched: [],
      moved: [],
      removed: []
    };
    if (!this.fromState || !this.toState) return null;
    const fromList = this.fromState.getFlatStructure();
    const toList = this.toState.getFlatStructure();

    this.detectMoves(fromList, toList);
    this.detectAdditions(fromList, toList);
    this.detectDeletions(fromList, toList);
    return this.delta;
  }

  detectAdditions (fromList, toList) {
    const fromFiles = transformToFilenameList(fromList);
    const additions = toList.filter(file => {
      return !fromFiles.includes(file.name);
    });
    this.delta.added = additions;
  }

  detectMoves (fromList, toList) {
    const hashMatches = getCommonFilesByHash(fromList, toList);
    const nameMatches = getCommonFilesByFilename(fromList, toList);
    const uniqueMatches = getOnlyUniqueValues([...hashMatches, ...nameMatches]);
    const [ movedFiles, unmovedFiles ] = diverge(uniqueMatches, ({ fromPath, toPath }) => toPath !== fromPath);
    this.delta.moved = movedFiles;
    this.delta.untouched = unmovedFiles;
  }

  detectDeletions (fromList, toList) {
    const toFiles = transformToFilenameList(toList);
    const deletions = fromList.filter(file => {
      return !toFiles.includes(file.name);
    });
    this.delta.removed = deletions;
  }

  forecast () {
    const table = new DeltaTable(this.delta, this.config);
    zaq.log(table.render());
  }
};

module.exports = MapDelta;
