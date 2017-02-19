expose(
    'object/get-prototype-of',
    {
        pass: function(generatorFn) {
            var generator = generatorFn();
            var ownProto = Object.getPrototypeOf(generator);
            var sharedProto = Object.getPrototypeOf(ownProto);

            return (
                ownProto === generatorFn.prototype &&
                sharedProto !== Object.prototype &&
                sharedProto === Object.getPrototypeOf(generatorFn.prototype) &&
                sharedProto.hasOwnProperty('next')
            );
        }
    }
);
