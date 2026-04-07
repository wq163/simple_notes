const oldName = 'dd';
const newName = 'dda';
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const r = new RegExp(`(^|\\s)(\\\\?)#${escapeRegExp(oldName)}(?![a-zA-Z0-9_\\u4e00-\\u9fa5])`, 'gi');
console.log("Regex:", r);

const str = 'dddds\n\n\\#dd2 #dd';
console.log("Original string:", JSON.stringify(str));
const replaced = str.replace(r, `$1$2#${newName}`);
console.log("Replaced string:", JSON.stringify(replaced));
