import Lab from './lab.js';
import './merge.js';

const dam = {name: 'dam', item: {name: 'sword'}};
const seb = {name: 'seb', item: {price: 10}, age: 10};
const damElement = Lab.scan(dam);
const sebElement = Lab.scan(seb);
// const merged = damElement.meBrge(sebElement);
const composed = damElement.compose(sebElement);
console.log(damElement.compile(), composed.compile());
