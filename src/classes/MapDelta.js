class MapDelta {
  constructor (fromState, toState, options) {
    this.fromState = fromState;
    this.toState = toState;
  }

  compute () {
    const delta = {
      added: [],
      moved: [],
      removed: []
    };
    return delta;
  }
};

module.exports = MapDelta;
