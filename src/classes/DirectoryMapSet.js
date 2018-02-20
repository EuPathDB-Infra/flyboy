const fs = require('fs');
const zaq = require('zaq');

const DirectoryMap = require('./DirectoryMap');
const configDefaults = require('../configDefaults');
const { flattenMap } = require('../utils');

class DirectoryMapSet {
  constructor (dirs, config) {
    if (!Array.isArray(dirs) || !dirs.length || !dirs.every(dir => typeof dir === 'string'))
      throw new TypeError(`Invalid dirs provided to DirectoryMapSet constructor: ${dirs ? dirs.toString() : ''}`);
    this.maps = dirs.map(dirPath => new DirectoryMap(dirPath, config));
  }

  getStructure () {
    return this.maps.reduce((structure, thisMap) => {
      const mapStructure = thisMap.getStructure();
      return [...structure, ...mapStructure];
    }, []);
  }

  getFlatStructure () {
    return flattenMap(this.getStructure());
  }
};

module.exports = DirectoryMapSet;
