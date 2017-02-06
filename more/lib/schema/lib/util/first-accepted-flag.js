function listAcceptedFlags(flags, availableFlags){
    return availableFlags.filter(function(flagList){
        return flagList.every(function(flag, index){
            return flag === '' ? true : flags.indexOf(flag) > -1;
        });
    }).sort(function(flagListA, flagListB){
        var aLength = flagListA.length;
        var bLength = flagListB.length;
        var diff = bLength - aLength;

        if( diff === 0 ){
            diff = flagListB.join('').length - flagListA.join('').length;
        }

        return diff;
    });
}

function firstAcceptedFlag(flags, availableFlags){
    return listAcceptedFlags(flags, availableFlags)[0];
}

export default firstAcceptedFlag;

export const test = {
    modules: ['@node/assert'],

    suite(add){
        var assert = this.modules[0];

        function assertAcceptedFlagIndexIs(flags, availableFlags, index){
            var expectedFlag = availableFlags[index];
            var acceptedFlags = firstAcceptedFlag(flags, availableFlags);
            assert.equal(acceptedFlags, expectedFlag);
        }

        add("firstAcceptedFlag", function(){

            assertAcceptedFlagIndexIs(
                ['a', 'b'],
                [
                    ['a'],
                    ['b', 'a'],
                    ['']
                ],
                1
            );

            assertAcceptedFlagIndexIs(
                [],
                [
                    [''],
                    ['a', 'c'],
                ],
                0
            );

            assertAcceptedFlagIndexIs(
                ['not'],
                [
                    [''],
                    ['not'],
                ],
                1
            );

            assertAcceptedFlagIndexIs(
                ['empty', 'not'],
                [
                    [''],
                    ['empty'],
                    ['not'],
                    ['not', 'empty']
                ],
                3
            );

        });

    }
};
