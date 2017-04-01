// transform(
//     'src/trace/fixtures/conditional/entry.js',
//     null,
//     {
//         exclude(node) {
//             return node.id === 'src/trace/fixtures/conditional/file.js'
//         }
//     }
// ).then((result) => {
//     console.log('result', result)
// }).catch((e) => {
//     setTimeout(() => {
//         throw e
//     })
// })
