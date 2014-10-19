module.exports = (function() {


    var url = require( 'url' );
    var querystring = require( 'querystring' );


    function RequestPath( requrl , httpRoot ) {
        
        var that = this;
        var parsed = url.parse( requrl );

        that.original = parsed.pathname;
        that.relative = parsed.pathname;
        that.rewritten = null;
        that.search = parsed.search || '';
        that.query = querystring.parse( parsed.query || '' );
        that.httpRoot = httpRoot;

        Object.defineProperties( that , {
            full: {
                get: function() {
                    return that.relative + that.search;
                },
                enumerable: true
            },
            absolute: {
                get: function() {
                    return that.httpRoot + that.relative;
                },
                enumerable: true
            },
            current: {
                get: function() {
                    var current = that.rewritten !== null ? that.rewritten : that.relative;
                    return {
                        rel: current,
                        abs: that.httpRoot + current
                    };
                },
                enumerable: true
            },
            isRewrite: {
                get: function() {
                    return that.rewritten !== null;
                },
                enumerable: true
            },
            pointsToDirectory: {
                get: function() {
                    return !(/(\/$)|(\.[0-9,a-z]+$)/i).test( that.relative );
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

        rewrite: function( relative ) {
            this.rewritten = relative;
        },
        
        append: function( extra ) {
            this.relative += extra;
        }
    };


    return RequestPath;


}());



















