const fs = require('fs');
const path = require('path');
const zaq = require('zaq').as('DirectoryMap');
const StructureMap = require('./StructureMap');

const { dirExists, mapDirectory } = require('../utils');

class DirectoryMap extends StructureMap {
  constructor (dir, config) {
    super(config);
    if (!dir || !dirExists(dir))
      throw new TypeError(`Invalid dir provided to DirectoryMap constructor: ${dir}`);
    this.dir = dir;
    this.build = this.build.bind(this);
    this.getStructure = this.getStructure.bind(this);
    this.writeMapToFile = this.writeMapToFile.bind(this);
    this.getFlatStructure = this.getFlatStructure.bind(this);
    this.build();
  }

  getStructure () {
    return [...this.structure];
  }

  build () {
    const { dir, config } = this;
    if (!config.quiet) zaq.info(`Scanning ${dir}...`);
    this.structure = mapDirectory(dir, config);
    if (!config.quiet) zaq.info(`Done.`);
    return this.structure;
  }
};

module.exports = DirectoryMap;
