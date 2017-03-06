const fix = {
    type: 'corejs',
    value: 'es6.object.create'
};

export default fix;

// import {assertObject, getSharedKey, nonEnumerableKeys, polyfill} from '/helper/fix.js';
// import {definePropertiesSolution} from '../define-properties/feature.js';
// function createDict() {
//     // Thrash, waste and sodomy: IE GC bug
//     var iframe = document.createElement('iframe');
//     var lt = '<';
//     var gt = '>';
//     var iframeDocument;
//     iframe.style.display = 'none';
//     document.documentElement.appendChild(iframe);
//     iframe.src = 'javascript:'; // eslint-disable-line no-script-url
//     // createDict = iframe.contentWindow.Object;
//     // html.removeChild(iframe);
//     iframeDocument = iframe.contentWindow.document;
//     iframeDocument.open();
//     iframeDocument.write(lt + 'script' + gt + 'document.F=Object' + lt + '/script' + gt);
//     iframeDocument.close();
//     var F = iframeDocument.F;
//     var i = nonEnumerableKeys.length;
//     while (i--) {
//         delete F.prototype[nonEnumerableKeys[i]];
//     }
//     return new F();
// }
// function Empty() {}
// const IE_PROTO = getSharedKey('IE_PROTO');
// function create(object, properties) {
//     var result;
//     if (object === null) {
//         result = createDict();
//     } else {
//         assertObject(object);
//         Empty.prototype = object;
//         result = new Empty();
//         Empty.prototype = null;
//         result[IE_PROTO] = object;
//     }
//     if (properties) {
//         Object.defineProperties(result, properties);
//     }
//     return result;
// }
