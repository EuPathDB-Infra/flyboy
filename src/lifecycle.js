const zaq = require('zaq');

const crash = (message = 'An Error Occurred', loggables) => {
  zaq.err(message, loggables);
  return new Error(message);
}

module.exports = { crash };
