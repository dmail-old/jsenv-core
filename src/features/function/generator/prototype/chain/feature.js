expose(
    {
        code: parent.code,
        pass: function(generatorFn) {
            var generator = generatorFn();
            var ownProto = Object.getPrototypeOf(generator);
            var sharedProto = Object.getPrototypeOf(ownProto);
            var ancestorProto = Object.getPrototypeOf(sharedProto);

            return (
                ancestorProto.hasOwnProperty(Symbol.iterator) &&
                sharedProto.hasOwnProperty(Symbol.iterator) === false &&
                ownProto.hasOwnProperty(Symbol.iterator) === false &&
                generator[Symbol.iterator]() === generator
            );
        },
        solution: parent.solution
    }
);
