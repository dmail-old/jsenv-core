/*

add -r parameter that if no test is exported will run any test found in imported files
the default value of -r parameter is true if the file is named index.js else false

this way we could just run system-test index.js to run every test of files imported by index.js so for a whole module

using System.trace = true we'll have access to System.loads which would allow this
moreover I may need System.loads ALL the time to be able to add meta for modules at runtime

*/

export * from './test.js';
