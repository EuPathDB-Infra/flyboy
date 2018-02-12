const zaq = require('zaq').as('Migrant');
const Migrant = require('./index');
const test = new Migrant(
  '/Users/austinjb/Dropbox/Code/upenn/projects/ClinEpiDB/WDK/View/webapp/wdk',
  '/Users/austinjb/Dropbox/Code/upenn/_src',
  { ignore: ['node_modules', '.git', '.svn', '.DS_Store']
});


const fromStructure = test.fromState.structure;
const toStructure = test.toState.getFlatStructure();
const mapDelta = test.delta.compute();
zaq.info('Initital Structure:', fromStructure);
zaq.info('Resultant Structure:', toStructure);
zaq.info('Delta:', mapDelta);
