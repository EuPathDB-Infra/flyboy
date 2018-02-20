const fs = require('fs');
const path = require('path');
const zaq = require('zaq');

const { flattenMap } = require('../utils');
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
    const data = { structure, dir: Array.isArray(dir) ? dir.map(dirName => path.resolve(base, dirName)) : path.resolve(base, dir), base };
    const fileName = `${fileBaseName}.fmap.json`;
    const filePath = path.resolve(config.base, fileName);
    zaq.info(`${Array.isArray(dir) && dir[0] === '.' ? 'Current directory' : dir} contains ${structure.length} objects. Saving to...`, filePath);
    fs.writeFileSync(filePath, JSON.stringify(data));
    zaq.win('Saved map to file ' + fileName, data);
    zaq.weight(filePath);
  }
};

module.exports = StructureMap;
