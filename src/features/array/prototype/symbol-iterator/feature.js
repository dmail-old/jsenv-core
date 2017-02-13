this.dependsOn('symbol-iterator');
this.code = this.produceFromComposedPath;
this.pass = 'inherit';
this.solution = {
    type: 'polyfill',
    location: 'corejs://es6.array.iterator'
};
