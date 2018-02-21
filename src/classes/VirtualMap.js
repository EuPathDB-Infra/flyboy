const path = require('path');
const zaq = require('zaq');
const StructureMap = require('./StructureMap');
const { fileExists } = require('../utils');

class VirtualMap extends StructureMap {
  constructor (mapLocation, config) {
    super(config);
    if (typeof mapLocation !== 'string' || !fileExists(mapLocation))
      throw new TypeError(`Invalid map path provided to VirtualMap constructor : ${mapLocation}`);

    const { dir, structure } = require(path.resolve(config.base, mapLocation));
    this.dir = dir;
    this.structure = structure;

    this.getStructure = this.getStructure.bind(this);
    this.getFlatStructure = this.getFlatStructure.bind(this);
    this.writeMapToFile = this.writeMapToFile.bind(this);
  }

  getStructure () {
    return this.structure.map(item => Object.assign({}, item, { virtual: true }));
  }

  getFlatStructure () {
    return this.getStructure();
  }
};

module.exports = VirtualMap;
