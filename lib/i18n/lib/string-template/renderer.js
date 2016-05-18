const Renderer = {
    stringify: String,

    reduce(strings, values, fn, bind, buffer) {
        let i = 0;
        let j = values.length;
        let string;
        let value;

        while (i < j) {
            value = this.stringify(values[i]);
            string = strings[i + 1];
            buffer = fn.call(bind, buffer, value, string, i);
            i++;
        }

        return buffer;
    },

    stringReducer(prev, value, string) {
        return prev + value + string;
    },

    arrayReducer(prev, value, string) {
        prev.push(value, string);
        return prev;
    },

    renderAsString(strings, values) {
        return this.reduce(strings, values, this.stringReducer, this, strings[0]);
    },

    renderAsArray(strings, values) {
        return this.reduce(strings, values, this.arrayReducer, this, [strings[0]]);
    }
};

export default Renderer;
