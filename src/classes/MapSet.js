const fs = require('fs');
const zaq = require('zaq');
const path = require('path');

const VirtualMap = require('./VirtualMap');
const DirectoryMap = require('./DirectoryMap');
const StructureMap = require('./StructureMap');
const configDefaults = require('../configDefaults');
const { flattenMap } = require('../utils');

class MapSet extends StructureMap {
  constructor (maps, config) {
    super(config);
    if (!Array.isArray(maps) || !maps.length || !maps.every(item => typeof item === 'string'))
      throw new TypeError(`Invalid maps provided to MapSet constructor: ${maps ? maps.toString() : '(?)'}`);
    this.dir = maps;
    this.mapList = maps.map(location => {
      location = path.resolve(config.base, location);
      return path.parse(location).ext === '.json'
        ? new VirtualMap(location, config)
        : new DirectoryMap(location, config)
    });
    this.getStructure = this.getStructure.bind(this);
    this.getFlatStructure = this.getFlatStructure.bind(this);
    this.writeMapToFile = this.writeMapToFile.bind(this);
  }

  getStructure () {
    return this.mapList.reduce((structure, thisMap) => {
      const mapStructure = thisMap.getStructure();
      return [...structure, ...mapStructure];
    }, []);
  }
};

module.exports = MapSet;
