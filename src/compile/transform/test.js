// transform(
//     'src/trace/fixtures/conditional/entry.js',
//     null,
//     {
//         exclude(importee, importer) {
//             if (
//                 importee === 'fixtures/consume-two/consume-b.js' &&
//                 importer === 'fixtures/consume-two/main.js'
//             ) {
//                 return true
//             }
//             if (
//                 importee === 'fixtures/consume-two/produce.js' &&
//                 importer === 'fixtures/consume-two/consume-a.js'
//             ) {
//                 return true
//             }
//         }
//     }
// ).then((result) => {
//     console.log('result', result)
// }).catch((e) => {
//     setTimeout(() => {
//         throw e
//     })
// })
