const fs = require('fs');
const zaq = require('zaq');

const { dirExists, mapDirectory, isParentStructure, flattenMap } = require('../utils');
const { crash } = require('../lifecycle');

class DirectoryMap {
  constructor (dir, config) {
    if (!dir || !dirExists(dir))
      return crash('Invalid dir provided to DirectoryMap constructor.', dir);
    this._dir = dir;
    this._config = config;
    this.build();
    return this;
  }

  getStructure () {
    return [...this.structure];
  }

  getFlatStructure () {
    return flattenMap(this.structure);
  }

  build () {
    const { _dir, _config } = this;
    const { ignore } = _config;
    if (!Array.isArray(ignore)) return zaq.err('Invalid .ignore config property provided (Array expected)', ignore);
    this.structure = mapDirectory(_dir, { ignore });
    return this.structure;
  }
};

module.exports = DirectoryMap;
