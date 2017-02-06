import MacroInstruction from './instruction-macro.js';

export default function macro() {
    // macro(isString).or(macro(isNumber).or(isString)).anyOf()
    return MacroInstruction.create.apply(MacroInstruction, arguments);
}

export const test = {
    modules: ['node/assert'],

    suite(assert) {
        const TypeInstruction = MacroInstruction.getPrototypeByName('type');
        const EqualsInstruction = MacroInstruction.getPrototypeByName('equals');

        const isString = TypeInstruction.create('string');
        const isNumber = TypeInstruction.create('number');
        const isBoolean = TypeInstruction.create('boolean');
        const isFunction = TypeInstruction.create('function');
        const equalsFoo = EqualsInstruction.create('foo');

        this.add("macro creation", function() {
            this.add("core", function() {
                const isStringFollowedByIsNumber = macro(isString, isNumber);

                assert(isString.isPrototypeOf(isStringFollowedByIsNumber.args[0]));
                assert(isNumber.isPrototypeOf(isStringFollowedByIsNumber.args[1]));
            });

            this.add("nested", function() {
                const isStringFollowedByIsNumber = macro(isString, isNumber);
                const isBooleanFollowedByIsFunction = macro(isBoolean, isFunction);
                const nestedMacro = macro(isStringFollowedByIsNumber, isBooleanFollowedByIsFunction);

                assert(isStringFollowedByIsNumber.isPrototypeOf(nestedMacro.args[0]));
                assert(isBooleanFollowedByIsFunction.isPrototypeOf(nestedMacro.args[1]));
            });
        });

        this.add("macro execution", function() {
            function assertTruthy(instruction, value) {
                assert(instruction.run(value).isTruthy());
            }

            function assertFalsy(instruction, value) {
                assert(instruction.run(value).isFalsy());
            }

            this.add("core", function() {
                assertTruthy(macro(isString), "foo");
                assertFalsy(macro(isString), 10);
            });

            this.add("and", function() {
                const isStringAndFoo = macro(isString).and(equalsFoo);

                assertTruthy(isStringAndFoo, 'foo');
                assertFalsy(isStringAndFoo, 'bar');
            });

            this.add("or", function() {
                const isStringOrNumber = macro(isString).or(isNumber);
                const stringOrNumberResult = isStringOrNumber.run(10);

                assert(stringOrNumberResult.compiledList[0].isFalsy());
                assert(stringOrNumberResult.compiledList[1].isTruthy());
                assert(stringOrNumberResult.isTruthy());
            });

            this.add("allOf", function() {
                const allOfStringAndFoo = macro().allOf(isString, equalsFoo);

                assertTruthy(allOfStringAndFoo, 'foo');
                assertFalsy(allOfStringAndFoo, 'bar');
            });

            this.add("anyOf", function() {
                const anyOfStringAndNumber = macro().anyOf(isString, isNumber);

                assertTruthy(anyOfStringAndNumber, 'foo');
                assertTruthy(anyOfStringAndNumber, 10);
                assertFalsy(anyOfStringAndNumber, true);
            });

            this.add("oneOf", function() {
                const oneOfStringAndFoo = macro().oneOf(isString, equalsFoo);

                assertTruthy(oneOfStringAndFoo, 'bar');
                assertFalsy(oneOfStringAndFoo, 'foo');
                assertFalsy(oneOfStringAndFoo, true);
            });
        });
    }
};
