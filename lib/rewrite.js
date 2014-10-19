module.exports = (function() {
    

    function Rewrite( regexp , handler , headers ) {
        var that = this;
        that.regexp = regexp;
        that.handler = handler;
        that.headers = headers || [];
    }


    Rewrite.prototype = {
        match: function( endpoint ) {
            var that = this;
            return that.regexp.test( endpoint );
        }
    };


    Rewrite.match = function( reqPath , rules ) {
        for (var i = 0; i < rules.length; i++) {
            if (rules[i].match( reqPath.relative )) {
                return rules[i].handler;
            }
        }
        return function() { return reqPath.rewritten; };
    };


    return Rewrite;


}());



















