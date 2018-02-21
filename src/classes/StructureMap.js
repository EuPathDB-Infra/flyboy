const fs = require('fs');
const path = require('path');
const zaq = require('zaq');

const { MAP_EXTENSION } = require('../constants')
const { flattenMap, displayObject } = require('../utils');
const configDefaults = require('../configDefaults');

class StructureMap {
  constructor (config) {
    this.config = Object.assign({}, configDefaults, config);
    this.getStructure = this.getStructure.bind(this);
    this.writeMapToFile = this.writeMapToFile.bind(this);
    this.getFlatStructure = this.getFlatStructure.bind(this);
  }

  getStructure () {
    return [];
  }

  getFlatStructure () {
    return flattenMap(this.getStructure());
  }

  writeMapToFile (fileBaseName = 'flyboy') {
    const { dir, config, getStructure, getFlatStructure } = this;
    const { base } = config;
    const structure = getFlatStructure();
    const data = { base, dir: (Array.isArray(dir) ? dir.map(dirName => path.resolve(base, dirName)).join(' : ') : path.resolve(base, dir)), structure };
    const fileName = `${fileBaseName}${MAP_EXTENSION}`;
    const filePath = path.resolve(config.base, fileName);
    zaq.info(`${Array.isArray(dir) && dir[0] === '.' ? 'Current directory' : dir} contains ${structure.length} objects. Saving to...`, filePath);
    fs.writeFileSync(filePath, JSON.stringify(data));
    zaq.win('Saved map to file ' + fileName, displayObject(Object.assign({}, data, { structure: `[${structure.length} Objects]` })));
    zaq.weight(filePath);
  }
};

module.exports = StructureMap;
