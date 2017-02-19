expose(
    {
        pass: function(datePrototypeToJSON) {
            var value = 1;
            var fakeDate = {
                toISOString: function() {
                    return value;
                }
            };

            return datePrototypeToJSON.call(fakeDate) === value;
        }
    }
);
