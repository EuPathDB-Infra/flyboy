const zaq = require('zaq');
const DirectoryMap = require('./classes/DirectoryMap');
const MapDelta = require('./classes/MapDelta');

class Flyboy {
  constructor ({ from, to }, config) {
    try {
      this.fromState = new DirectoryMap(from, config);
      this.toState = new DirectoryMap(to, config);
      this.delta = new MapDelta(this.fromState, this.toState, config);
    } catch (e) {
      zaq.err(e);
    }
    return this;
  }

  forecast () {
    return this.delta.forecast();
  }
};

module.exports = Flyboy;
