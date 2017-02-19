expose(
    {
        code: transpile`(function(a) {
            return [
                \`x\ry\`,
                \`x\ny\`,
                \`x\r\ny\`,
            ];
        })`,
        pass: function(fn) {
            var result = fn();
            var carriageReturn = result[0];
            var linefeedReturn = result[1];
            var carriageAndLineFeedReturn = result[2];
            return (
                carriageReturn.length === 3 &&
                carriageReturn[1] === '\r' &&
                linefeedReturn.length === 3 &&
                linefeedReturn[1] === '\n' &&
                carriageAndLineFeedReturn.length === 3 &&
                carriageAndLineFeedReturn[1] === '\n'
            );
        },
        solution: parent.solution
    }
);
