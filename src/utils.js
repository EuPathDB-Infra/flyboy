const fs = require('fs');
const zaq = require('zaq');
const path = require('path');
const chalk = require('chalk');
const { createHash } = require('crypto');
const { exec } = require('child_process');
const { compareTwoStrings } = require('string-similarity');
const {
  IMAGE_TYPES,
  TEXT_TYPES,
  RESOLVE_EXTENSIONS,
  IMPORT_PATH_PATTERN,
  SIMILARITY_THRESHOLD
} = require('./constants');

function getFileHash (path) {
  if (!fileExists(path))
    throw new TypeError(`Invalid file path provided, can't hash: ${path}`);
  if (dirExists(path))
    throw new TypeError(`Invalid file path provided; received dir. Can't hash: ${path}`);

  const data = fs.readFileSync(path, 'utf-8');
  const hash = createHash('md5')
    .update(data)
    .digest("hex");
  return hash;
}

function fileExists (path) {
	let exists = false;
	try {
		const stats = fs.statSync(path);
		exists = true;
	} catch (e) {}
	return exists;
}

function dirExists (path) {
	let exists = false;
	try {
		const stats = fs.statSync(path);
		return stats.isDirectory();
	} catch (e) {}
	return exists;
}

function isImageExtension (extension) {
  return IMAGE_TYPES.includes(extension.toLowerCase());
}

function mapDirectory (dir, { ignore = [], base = '/', ignoreWhen = null } = {}) {
  if (!dirExists(dir)) return null;
  return fs.readdirSync(dir)
    .filter(name => {
      if (ignore.includes(name)) return false;
      if (typeof ignoreWhen === 'function' && ignoreWhen(name)) return false;
      return true;
    })
    .map(name => {
      const fullUri = path.join(dir, name);
      const uri = path.relative(base, fullUri);
      const stats = fs.statSync(fullUri);
      const { size } = stats;
      const isDir = stats.isDirectory();
      const type = isDir ? 'directory' : 'file';
      const output = { name, uri, type};
      if (isDir) {
        output.content = mapDirectory(fullUri, { ignore, base, ignoreWhen });
      } else {
        output.extension = path.extname(name).substring(1);
        output.hash = getFileHash(fullUri);
        output.filename = path.parse(name).name;
        if (TEXT_TYPES.includes(output.extension))
          output.content = fs.readFileSync(fullUri, 'utf-8');
      }
      return output;
    });
}

function flattenMap (structure = []) {
  let layer = [...structure];
  while (layer.some(isParentStructure)) {
    layer = layer.reduce((itemSet, item) => {
      if (item.type !== 'directory') {
        return [ ...itemSet, item ];
      } else {
        const { content } = item;
        if (Array.isArray(content) && content.every(item => typeof item === 'object')) {
          const additionals = flattenMap(content);
          item.content = content
            .filter(({ hash }) => hash)
            .map(({ hash }) => hash);
          return [ ...itemSet, item, ...additionals ];
        } else {
          return [ ...itemSet ];
        }
      }
    }, []);
  };
  return layer;
}

function isValidList (list) {
  return Array.isArray(list) && list.every(item => typeof item === 'object');
}

function filterDirectories (list) {
  if (!isValidList(list))
    throw new TypeError(`Invalid list provided to filterDirectories: ${list.toString()}`);
  return list.filter(({ type }) => type !== 'directory');
}

function transformToHashList (list) {
  if (!isValidList(list))
    throw new TypeError(`Invalid list provided to transformToHashList: ${list.toString()}`);
  return list.filter(({ hash }) => hash).map(({ hash }) => hash);
}

function transformToFilenameList (list) {
  if (!isValidList(list))
    throw new TypeError(`Invalid list provided to transformToFilenameList: ${list}`);
  return list.map(({ name }) => name);
}

function getListIntersection (listA, listB) {
  return listA.filter(item => listB.includes(item));
}

function getListUniques (listA, listB) {
  return listA.filter(item => !listB.includes(item));
}

function findFileByHash (list, _hash) {
  return list.find(({ hash }) => hash === _hash);
}

function findFileByFilename (list, _name, strict = true) {
  return strict
    ? list.find(({ name }) => name === _name)
    : list.find(({ name }) => name.toLowerCase() === _name.toLowerCase())
}

function findFileByUri (list, _uri, strict = true) {
  return strict
    ? list.find(({ uri }) => uri === _uri)
    : list.find(({ uri }) => uri.indexOf(_uri) === 0)
}

function findFileByContents (list, contents) {
  const checkableList = list.filter(({ toContent }) => toContent);
}

function filenameHasExtension (filename, extension) {
  if (typeof filename !== 'string' || typeof extension !== 'string') return false;
  const lastIndex = filename.lastIndexOf(extension);
  return lastIndex !== -1 && (lastIndex + extension.length === filename.length);
}

function getResolvedShortName (filename) {
  let output = filename;
  if (typeof filename === 'string') {
    RESOLVE_EXTENSIONS.forEach(extension => {
      if (filenameHasExtension(filename, extension))
        output = filename.substring(0, filename.length - extension.length);
    });
  }
  return output;
}

function getCommonFilesByHash (fromList, toList) {
  const files = getCommonFiles(transformToHashList, fromList, toList);
  return files.map(hash => {
    const fromFile = findFileByHash(fromList, hash);
    const toFile = findFileByHash(toList, hash);
    return getMigrantFileStats(fromFile, toFile);
  });
}

function getCommonFilesBySimilarity (fromList, toList, threshold = SIMILARITY_THRESHOLD) {
  return fromList.reduce((output, originFile) => {
    let confidence = 0;
    const destinationFile = toList.find(possibleMatch => {
      if (possibleMatch.hash === originFile.hash || possibleMatch.content === originFile.content) {
        confidence = 1;
        return true;
      };
      if (!originFile.content || !possibleMatch.content) return false;
      const similarity = compareTwoStrings(originFile.content, possibleMatch.content);
      if (similarity >= threshold) {
        confidence = similarity;
        return true;
      };
      return false;
    });
    if (!destinationFile) return output;
    zaq.info(`${chalk.dim('Assuming')} ${chalk.reset.bold(originFile.uri)} ${chalk.dim('has been moved/renamed to')} ${chalk.reset.bold(destinationFile.uri)} ${chalk.magenta(`(${Math.floor(confidence * 1000)/10}% Match)`)}`);
    return [ ...output, getMigrantFileStats(originFile, destinationFile) ]
  }, []);
}

function getPatternMatches (source, pattern) {
  if (!source || typeof source !== 'string')
    throw new TypeError(`Bad source given to getPatternMatches (${source.toString()})`);
  if (!pattern || !pattern instanceof RegExp)
    throw new TypeError(`Bad pattern given to getPatternMatches (${pattern.toString()})`);
  let match;
  const output = [];
  while ((match = pattern.exec(source)) !== null) {
    output.push({ match, index: match.index });
  };
  return output;
}

function extractFileReferences (fileContent) {
  if (!fileContent || typeof fileContent !== 'string')
    throw new TypeError(`Bad fileContent given to extractFileReferences: ${fileContent}`);
  const references = getPatternMatches(fileContent, IMPORT_PATH_PATTERN)
    .map(({ match, index }) => {
      const [ fullMatch, fileReference ] = match;
      const matchPos = fullMatch.lastIndexOf(fileReference);
      const start = index + matchPos;
      const end = start + fileReference.length;
      return { match: fileReference, start, end };
    });
  return references;
}

function getFileReferences (fileContent) {
  return categorizeFileReferences(extractFileReferences(fileContent));
}

function applyTextChanges (text, changeList) {
  let offset = 0;
  return changeList.reduce((content, change) => {
    const { original, replacement, start, end } = change;
    const lengthDifference = replacement.length - original.length;
    const offsetStart = start + offset;
    const offsetEnd = end + offset;
    content = content.substring(0, offsetStart) + replacement + content.substring(offsetEnd);
    offset += lengthDifference;
    return content;
  }, text);
}

function categorizeFileReferences (referenceObjectList) {
  if (!Array.isArray(referenceObjectList))
    throw new TypeError(`Bad referenceObjectList passed to categorizeFileReferences: ${referenceObjectList}`);
  const references = { relative: [], libraries: [], absolute: [] };
  referenceObjectList
    .filter(({ match }) => match.indexOf('node_modules') === -1)
    .forEach(reference => {
      if (reference.match.indexOf('.') === -1 && reference.match.indexOf('/') === -1)
        references.libraries.push(reference);
      else if (reference.match.indexOf('.') === 0)
        references.relative.push(reference);
      else
        references.absolute.push(reference);
    });
  return references;
}

function diverge (list, predicate) {
  if (!Array.isArray(list))
    throw new TypeError(`Invalid list given to #diverge(): ${list.toString()}`);
  else if (typeof predicate !== 'function')
    throw new TypeError(`Invalid predicate fn given to #diverge(): ${predicate.toString()}`);
  const matches = [];
  const rejects = [];
  list.forEach(item => (predicate(item) ? matches : rejects).push(item));
  return [ matches, rejects ];
}

function generateObject (properties, defaultValue = null) {
  const output = {};
  if (!Array.isArray(properties)) return output;
  if (typeof defaultValue === 'function') defaultValue = defaultValue();
  properties.forEach(prop => output[prop] = defaultValue);
  return output;
}

function getExt (uri) {
  return path.parse(uri).ext.replace('.', '');
}

function getMigrantFileStats (fromFile, toFile) {
  const modified = (toFile.hash !== fromFile.hash);
  const migrated = (toFile.uri !== fromFile.uri);
  const toExt = path.parse(toFile.uri).ext.replace('.', '');
  return {
    modified,
    migrated,
    type: toFile.type,
    name: toFile.name,
    toExt: getExt(toFile.uri),
    toPath: toFile.uri,
    toHash: toFile.hash,
    toVirtual: toFile.virtual,
    toContent: toFile.content,
    fromExt: getExt(fromFile.uri),
    fromPath: fromFile.uri,
    fromHash: fromFile.hash,
    fromVirtual: fromFile.virtual,
    fromContent: fromFile.content,
  };
}

function getCommonFilesByFilename (fromList, toList, { strict } = {}) {
  const [ uniqueFromFiles, uniqueToFiles ] = [fromList, toList].map(getOnlyUniqueFilenames);
  const shared = getCommonFiles(transformToFilenameList, uniqueFromFiles, uniqueToFiles);
  return shared
    .map(filename => {
      const fromFile = findFileByFilename(fromList, filename, strict);
      const toFile = findFileByFilename(toList, filename, strict);
      return getMigrantFileStats(fromFile, toFile);
    });
}

function getOnlyUniqueFilenames (list) {
  if (!isValidList(list))
    throw new TypeError(`Invalid list provided to getOnlyUniqueFilenames: ${list}`);
  return getOnlyUniqueValues(list, ({ name }) => name);
}

function getOnlyUniqueValues (list, transformValueFn) {
  if (!Array.isArray(list))
    throw new TypeError(`Invalid list provided to getOnlyUniqueValues: ${list}`);
  if (typeof transformValueFn !== 'function')
    transformValueFn = (value) => value;
  const duplicatedValues = [];
  const encounteredValues = []
  list.forEach(value => {
    const transformed = transformValueFn(value);
    if (encounteredValues.includes(transformed)) {
      if (!duplicatedValues.includes(transformed)) duplicatedValues.push(transformed);
    } else {
      encounteredValues.push(transformed);
    };
  });
  return list.filter(value => !duplicatedValues.includes(transformValueFn(value)));
}

function unique (list, transformValueFn) {
  if (!Array.isArray(list))
    throw new TypeError(`Invalid list provided to unique(): ${list}`);
  if (typeof transformValueFn !== 'function')
    transformValueFn = (value) => value;
  const output = [];
  const encounteredValues = []
  list.forEach(value => {
    const transformed = transformValueFn(value);
    if (!encounteredValues.includes(transformed)) {
      encounteredValues.push(transformed);
      output.push(value);
    };
  });
  return output;
}

function getCommonFiles (listMapperFn, ...lists) {
  if (!lists || !lists.length)
    throw new TypeError('No lists provided to getCommonFiles.');
  if (lists && lists.length && lists.some(list => !isValidList(list)))
    throw new TypeError(`Invalid lists provided to getCommonFiles: ${lists.toString()}`);
  if (typeof listMapperFn !== 'function')
    listMapperFn = (list) => list;

  const listSet = lists
    .map(filterDirectories)
    .map(listMapperFn);
  const [ initial, ...rest ] = listSet;
  return listSet.reduce((commonFiles, thisList) => {
    return getListIntersection(commonFiles, thisList);
  }, initial);
}

function isParentStructure (fileItem = {}) {
  const { type, content } = fileItem;
  return type === 'directory'
    && Array.isArray(content)
    && content.some(subItem => typeof subItem !== 'string');
}

function makeSorter (key) {
  return (a, b) => {
    if (a[key] > b[key]) return -1;
    if (b[key] > a[key]) return 1;
    return 0;
  };
}

function displayObject (object = {}) {
  return Object.keys(object)
    .reduce((output, key) => {
      const content = object[key];
      const color = (content === null ? 'dim' : content === true ? 'green' : content === false ? 'red' : 'blue')
      output += chalk.bold(key) + chalk.dim(': ');
      output += chalk[color](zaq.pretty(content));
      output += '\n';
      return output;
    }, '').trim();
};

function localize (pathname) {
  if (typeof pathname !== 'string') return pathname;
  return pathname.indexOf('.') === 0 ? pathname : './' + pathname;
};

function runShellScript (scriptPath) {
  if (!scriptPath || typeof scriptPath !== 'string' || !fileExists(scriptPath))
    throw new Error(`Unable to execute shell script: invalid path given (${scriptPath}).`);
  exec(`sh ${scriptPath}`, (error, stdout, stderr) => {
    zaq.log(`${stdout}`);
    zaq.log(`${stderr}`);
    if (error) zaq.err(`exec error: ${error}`);
  });
};


module.exports = {
  diverge,
  fileExists,
  displayObject,
  dirExists,
  makeSorter,
  mapDirectory,
  unique,
  getExt,
  localize,
  flattenMap,
  getCommonFiles,
  generateObject,
  filterDirectories,
  getCommonFilesByHash,
  findFileByFilename,
  extractFileReferences,
  categorizeFileReferences,
  getFileReferences,
  findFileByHash,
  findFileByUri,
  getCommonFilesByFilename,
  getCommonFilesBySimilarity,
  applyTextChanges,
  transformToHashList,
  transformToFilenameList,
  getOnlyUniqueValues,
  getMigrantFileStats,
  getResolvedShortName,
  getListUniques,
  isValidList,
  IMPORT_PATH_PATTERN,
  RESOLVE_EXTENSIONS
};
