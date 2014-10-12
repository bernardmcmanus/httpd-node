module.exports = (function() {


    var querystring = require( 'querystring' );


    function RequestPath( parsed , httpRoot ) {
        
        var that = this;

        that.original = parsed.pathname;
        that.relative = parsed.pathname;
        that.search = parsed.search || '';
        that.query = querystring.parse( parsed.query || '' );
        that.httpRoot = httpRoot;

        Object.defineProperties( that , {
            absolute: {
                get: function() {
                    return that.httpRoot + that.relative;
                },
                enumerable: true
            },
            pointsToDirectory: {
                get: function() {
                    return !(/(\/$)|(\.[0-9a-z]+$)/i).test( that.relative );
                },
                enumerable: true
            },
            pointsToIndex: {
                get: function() {
                    return (/\/$/).test( that.relative );
                },
                enumerable: true
            }
        });
    }


    RequestPath.prototype = {

        modify: function( relative ) {
            this.relative = relative;
        },
        
        append: function( extra ) {
            this.relative += extra;
        }
    };


    return RequestPath;


}());



















