const fs = require('fs');
const zaq = require('zaq').as('DirectoryMap');

const configDefaults = require('../configDefaults');
const { dirExists, mapDirectory, isParentStructure, flattenMap } = require('../utils');

class DirectoryMap {
  constructor (dir, config) {
    if (!dir || !dirExists(dir))
      throw new TypeError(`Invalid dir provided to DirectoryMap constructor: ${dir}`);
    this._dir = dir;
    this._config = Object.assign({}, configDefaults, config);
    return this.build() ? this : null;
  }

  get dir () { return this._dir; }
  get config () { return this._config; }

  getStructure () {
    return [...this.structure];
  }

  getFlatStructure () {
    return flattenMap(this.getStructure());
  }

  build () {
    const { dir, config } = this;
    const { ignore, rootDir } = config;
    if (typeof rootDir !== 'string')
      return zaq.err('Invalid rootDir provided config.', rootDir);
    if (!Array.isArray(ignore))
      return zaq.err('Invalid .ignore config property provided (Array expected)', ignore);
    this.structure = mapDirectory(dir, config);
    return this.structure;
  }
};

module.exports = DirectoryMap;
