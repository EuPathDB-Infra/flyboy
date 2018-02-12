const DirectoryMap = require('./classes/DirectoryMap');
const MapDelta = require('./classes/MapDelta');

class Migrant {
  constructor (fromDir, toDir, config) {
    this.fromState = new DirectoryMap(fromDir, config);
    this.toState = new DirectoryMap(toDir, config);
    this.delta = new MapDelta(this.fromState, this.toState);
  }
};

module.exports = Migrant;
