this.dependencies = ['let'];
this.code = transpile`(function() {
    let {c = c} = {};
    let {c = d, d} = {d: 1};
})`;
this.fail = function(error) {
    return error instanceof Error;
};
this.solution = 'inherit';
