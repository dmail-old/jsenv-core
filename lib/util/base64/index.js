var ByteArrayConstructor = typeof Uint8Array === 'undefined' ? Array : Uint8Array;

var base64StringHelpers;
/*
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
// but this version does not exists anymore at this address and instead propose the version below
// which is cleaner so this one is deprecated but I keep it commented because I may need it someday
base64StringHelpers = (function() {
    var base64StringToByteArray = (function() {
        // Array of bytes to base64 string decoding
        function b64ToUint6(charCode) {
            if (charCode > 64 && charCode < 91) {
                return charCode - 65;
            }
            if (charCode > 96 && charCode < 123) {
                return charCode - 71;
            }
            if (charCode > 47 && charCode < 58) {
                return charCode + 4;
            }
            if (charCode === 43) {
                return 62;
            }
            if (charCode === 47) {
                return 63;
            }
            return 0;
        }

        return function base64StringToByteArray(base64String, blockLength) {
            var base64EncodedString = base64String.replace(/[^A-Za-z0-9\+\/]/g, "");
            var base64EncodedStringLength = base64EncodedString.length;

            var byteLength;
            if (blockLength) {
                byteLength = Math.ceil((base64EncodedStringLength * 3 + 1 >> 2) / blockLength) * blockLength;
            } else {
                byteLength = base64EncodedStringLength * 3 + 1 >> 2;
            }

            var byteArray = new ByteArrayConstructor(byteLength);
            var nMod3;
            var nMod4;
            var nUint24 = 0;
            var nOutIdx = 0;
            var nInIdx = 0;

            for (;nInIdx < base64EncodedStringLength; nInIdx++) {
                nMod4 = nInIdx & 3;
                nUint24 |= b64ToUint6(base64EncodedString.charCodeAt(nInIdx)) << 6 * (3 - nMod4);
                if (nMod4 === 3 || base64EncodedStringLength - nInIdx === 1) {
                    for (nMod3 = 0; nMod3 < 3 && nOutIdx < byteLength; nMod3++, nOutIdx++) {
                        byteArray[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
                    }
                    nUint24 = 0;
                }
            }

            return byteArray;
        };
    })();

    var byteArrayToBase64String = (function() {
        function uint6ToB64(nUint6) {
            if (nUint6 < 26) {
                return nUint6 + 65;
            }
            if (nUint6 < 52) {
                return nUint6 + 71;
            }
            if (nUint6 < 62) {
                return nUint6 - 4;
            }
            if (nUint6 === 62) {
                return 43;
            }
            if (nUint6 === 63) {
                return 47;
            }
            return 65;
        }

        return function byteArrayToString(byteArray) {
            var nMod3 = 2;
            var string = "";
            var nLen = byteArray.length;
            var nUint24 = 0;
            var nIdx = 0;

            for (;nIdx < nLen; nIdx++) {
                nMod3 = nIdx % 3;
                if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) {
                    string += "\r\n";
                }
                nUint24 |= byteArray[nIdx] << (16 >>> nMod3 & 24);
                if (nMod3 === 2 || byteArray.length - nIdx === 1) {
                    string += String.fromCharCode(
                        uint6ToB64(nUint24 >>> 18 & 63),
                        uint6ToB64(nUint24 >>> 12 & 63),
                        uint6ToB64(nUint24 >>> 6 & 63),
                        uint6ToB64(nUint24 & 63)
                    );
                    nUint24 = 0;
                }
            }

            var suffix;
            if (nMod3 === 2) {
                suffix = '';
            } else if (nMod3 === 1) {
                suffix = '=';
            } else {
                suffix = '==';
            }

            return string.substr(0, string.length - 2 + nMod3) + suffix;
        };
    })();

    return {
        toByteArray: base64StringToByteArray,
        fromByteArray: byteArrayToBase64String
    };
});
*/
// https://github.com/beatgammit/base64-js/blob/master/lib/b64.js
base64StringHelpers = (function() {
    var lookup = [];
    var revLookup = [];
    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var i = code.length;

    while (i--) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
    }
    revLookup['-'.charCodeAt(0)] = 62;
    revLookup['_'.charCodeAt(0)] = 63;

    function base64StringToByteArray(base64String) {
        var len = base64String.length;

        if (len % 4 > 0) {
            throw new Error('Invalid string. Length must be a multiple of 4');
        }

        // the number of equal signs (place holders)
        // if there are two placeholders, than the two characters before it
        // represent one byte
        // if there is only one, then the three characters before it represent 2 bytes
        // this is just a cheap hack to not do indexOf twice
        var placeHolders;
        if (base64String[len - 2] === '=') {
            placeHolders = 2;
        } else if (base64String[len - 1] === '=') {
            placeHolders = 1;
        } else {
            placeHolders = 0;
        }

        // base64 is 4/3 + up to two characters of the original data
        var byteArray = new ByteArrayConstructor(len * 3 / 4 - placeHolders);

        var L = 0;
        var firstByte;
        var secondByte;
        var thirdByte;
        var fourthByte;
        var tmp;

        var i = 0;
        var j = 0;
        // if there are placeholders, only get up to the last complete 4 chars
        var l = placeHolders > 0 ? len - 4 : len;
        for (;i < l; i += 4, j += 3) {
            firstByte = revLookup[base64String.charCodeAt(i)] << 18;
            secondByte = revLookup[base64String.charCodeAt(i + 1)] << 12;
            thirdByte = revLookup[base64String.charCodeAt(i + 2)] << 6;
            fourthByte = revLookup[base64String.charCodeAt(i + 3)];

            tmp = firstByte | secondByte | thirdByte | fourthByte;
            byteArray[L++] = (tmp >> 16) & 0xFF;
            byteArray[L++] = (tmp >> 8) & 0xFF;
            byteArray[L++] = tmp & 0xFF;
        }

        if (placeHolders === 2) {
            firstByte = revLookup[base64String.charCodeAt(i)] << 2;
            secondByte = revLookup[base64String.charCodeAt(i + 1)] >> 4;

            tmp = firstByte | secondByte;
            byteArray[L++] = tmp & 0xFF;
        } else if (placeHolders === 1) {
            firstByte = revLookup[base64String.charCodeAt(i)] << 10;
            secondByte = revLookup[base64String.charCodeAt(i + 1)] << 4;
            thirdByte = revLookup[base64String.charCodeAt(i + 2)] >> 2;

            tmp = firstByte | secondByte | thirdByte;
            byteArray[L++] = (tmp >> 8) & 0xFF;
            byteArray[L++] = tmp & 0xFF;
        }

        return byteArray;
    }

    var byteArrayToBase64String = (function() {
        function tripletToBase64(num) {
            return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
        }

        function encodeChunk(byteArray, start, end) {
            var tmp;
            var output = [];
            var i = start;

            for (;i < end; i += 3) {
                tmp = (byteArray[i] << 16) + (byteArray[i + 1] << 8) + (byteArray[i + 2]);
                output.push(tripletToBase64(tmp));
            }

            return output.join('');
        }

        return function byteArrayToBase64String(byteArray) {
            var tmp;
            var len = byteArray.length;
            var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
            var output = '';
            var parts = [];
            var maxChunkLength = 16383; // must be multiple of 3
            var i = 0;

            var len2 = len - extraBytes;

            // go through the array every three bytes, we'll deal with trailing stuff later
            for (; i < len2; i += maxChunkLength) {
                parts.push(encodeChunk(byteArray, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
            }

            // pad the end with zeros, but make sure to not forget the extra bytes
            if (extraBytes === 1) {
                tmp = byteArray[len - 1];
                output += lookup[tmp >> 2];
                output += lookup[(tmp << 4) & 0x3F];
                output += '==';
            } else if (extraBytes === 2) {
                tmp = (byteArray[len - 2] << 8) + (byteArray[len - 1]);
                output += lookup[tmp >> 10];
                output += lookup[(tmp >> 4) & 0x3F];
                output += lookup[(tmp << 2) & 0x3F];
                output += '=';
            }

            parts.push(output);

            return parts.join('');
        };
    })();

    return {
        toByteArray: base64StringToByteArray,
        fromByteArray: byteArrayToBase64String
    };
})();

var stringHelpers = {
    toByteArray(string) {
        var charCode;
        var stringLength = string.length;
        var byteArrayLength = 0;
        var charCodeLength;

        /* mapping... */
        var mapIndex = 0;
        for (;mapIndex < stringLength; mapIndex++) {
            charCode = string.charCodeAt(mapIndex);

            if (charCode < 0x80) {
                charCodeLength = 1;
            } else if (charCode < 0x800) {
                charCodeLength = 2;
            } else if (charCode < 0x10000) {
                charCodeLength = 3;
            } else if (charCode < 0x200000) {
                charCodeLength = 4;
            } else if (charCode < 0x4000000) {
                charCodeLength = 5;
            } else {
                charCodeLength = 6;
            }

            byteArrayLength += charCodeLength;
        }

        var byteArray = new ByteArrayConstructor(byteArrayLength);
        var index = 0;
        var charIndex = 0;
        for (;index < byteArrayLength; charIndex++) {
            charCode = string.charCodeAt(charIndex);

            if (charCode < 128) { /* one byte */
                byteArray[index++] = charCode;
            } else if (charCode < 0x800) {  /* two bytes */
                byteArray[index++] = 192 + (charCode >>> 6);
                byteArray[index++] = 128 + (charCode & 63);
            } else if (charCode < 0x10000) { /* three bytes */
                byteArray[index++] = 224 + (charCode >>> 12);
                byteArray[index++] = 128 + (charCode >>> 6 & 63);
                byteArray[index++] = 128 + (charCode & 63);
            } else if (charCode < 0x200000) { /* four bytes */
                byteArray[index++] = 240 + (charCode >>> 18);
                byteArray[index++] = 128 + (charCode >>> 12 & 63);
                byteArray[index++] = 128 + (charCode >>> 6 & 63);
                byteArray[index++] = 128 + (charCode & 63);
            } else if (charCode < 0x4000000) { /* five bytes */
                byteArray[index++] = 248 + (charCode >>> 24);
                byteArray[index++] = 128 + (charCode >>> 18 & 63);
                byteArray[index++] = 128 + (charCode >>> 12 & 63);
                byteArray[index++] = 128 + (charCode >>> 6 & 63);
                byteArray[index++] = 128 + (charCode & 63);
            } else { /* six bytes (nChr <= 0x7fffffff) */
                byteArray[index++] = 252 + (charCode >>> 30);
                byteArray[index++] = 128 + (charCode >>> 24 & 63);
                byteArray[index++] = 128 + (charCode >>> 18 & 63);
                byteArray[index++] = 128 + (charCode >>> 12 & 63);
                byteArray[index++] = 128 + (charCode >>> 6 & 63);
                byteArray[index++] = 128 + (charCode & 63);
            }
        }

        return byteArray;
    },

    fromByteArray(byteArray) {
        var string = "";
        var byte;
        var nLen = byteArray.length;
        var nIdx = 0;
        var charcode;
        var firstByte;
        var secondByte;
        var thirdByte;
        var fourthByte;
        var fifthByte;
        var sixthByte;

        for (;nIdx < nLen; nIdx++) {
            byte = byteArray[nIdx];

            if (byte > 251 && byte < 254 && nIdx + 5 < nLen) { /* six bytes */
                firstByte = (byte - 252) * 1073741824;
                secondByte = (byteArray[++nIdx] - 128 << 24);
                thirdByte = (byteArray[++nIdx] - 128 << 18);
                fourthByte = (byteArray[++nIdx] - 128 << 12);
                fifthByte = (byteArray[++nIdx] - 128 << 6);
                sixthByte = byteArray[++nIdx] - 128;

                charcode = firstByte + secondByte + thirdByte + fourthByte + fifthByte + sixthByte;
            } else if (byte > 247 && byte < 252 && nIdx + 4 < nLen) { /* five bytes */
                firstByte = (byte - 248 << 24);
                secondByte = (byteArray[++nIdx] - 128 << 18);
                thirdByte = (byteArray[++nIdx] - 128 << 12);
                fourthByte = (byteArray[++nIdx] - 128 << 6);
                fifthByte = byteArray[++nIdx] - 128;

                charcode = firstByte + secondByte + thirdByte + fourthByte + fifthByte;
            } else if (byte > 239 && byte < 248 && nIdx + 3 < nLen) { /* four bytes */
                firstByte = (byte - 240 << 18);
                secondByte = (byteArray[++nIdx] - 128 << 12);
                thirdByte = (byteArray[++nIdx] - 128 << 6);
                fourthByte = byteArray[++nIdx] - 128;

                charcode = firstByte + secondByte + thirdByte + fourthByte;
            } else if (byte > 223 && byte < 240 && nIdx + 2 < nLen) { /* three bytes */
                firstByte = (byte - 224 << 12);
                secondByte = (byteArray[++nIdx] - 128 << 6);
                thirdByte = byteArray[++nIdx] - 128;

                charcode = firstByte + secondByte + thirdByte;
            } else if (byte > 191 && byte < 224 && nIdx + 1 < nLen) { /* two bytes */
                firstByte = (byte - 192 << 6);
                secondByte = byteArray[++nIdx] - 128;

                charcode = firstByte + secondByte;
            } else { /* one byte (nPart < 127) */
                firstByte = byte;

                charcode = firstByte;
            }

            string += String.fromCharCode(charcode);
        }

        return string;
    }
};

var base64Helpers = {
    toBase64String(string) {
        var byteArray = stringHelpers.toByteArray(string);
        return base64StringHelpers.fromByteArray(byteArray);
    },

    fromBase64String(base64String) {
        var base64EncodedByteArray = base64StringHelpers.toByteArray(base64String);
        return stringHelpers.fromByteArray(base64EncodedByteArray);
    }
};

var base64 = {
    encode(string) {
        return base64Helpers.toBase64String(string);
    },

    decode(base64String) {
        return base64Helpers.fromBase64String(base64String);
    }
};

export default base64;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        var samples = [
            {string: '✓ à la mode', base64String: '4pyTIMOgIGxhIG1vZGU='},
            {string: '\n', base64String: 'Cg=='}
        ];

        samples.forEach(function(sample) {
            assert.equal(base64.encode(sample.string), sample.base64String);
            assert.equal(base64.decode(sample.base64String), sample.string);
        });
    }
};
