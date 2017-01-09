export function stringToArrayBuffer(string) {
    string = String(string);
    var buffer = new ArrayBuffer(string.length * 2); // 2 bytes for each char
    var bufferView = new Uint16Array(buffer);
    var i = 0;
    var j = string.length;
    for (;i < j; i++) {
        bufferView[i] = string.charCodeAt(i);
    }
    return buffer;
}

const BodyConsumer = {
    bodyUsed: false,

    text() {
        let bodyTextPromise;

        if (this.body) {
            bodyTextPromise = this.body.readAsString();
        } else {
            bodyTextPromise = Promise.resolve('');
        }

        return bodyTextPromise.then(function(text) {
            this.bodyUsed = true;
            return text;
        }.bind(this));
    },

    arraybuffer() {
        return this.text().then(stringToArrayBuffer);
    },

    json() {
        return this.text().then(JSON.parse);
    }
};

export default BodyConsumer;
