module.exports = (function() {


    var fs = require( 'fs-extra' );


    function CodeHandler( res , data ) {

        var that = this;
        var content = null;
        var contentSource = null;

        that.statusCode = data.statusCode;
        that.headers = data.headers || {};

        Object.defineProperties( that , {
            res: {
                get: function() {
                    return res;
                }
            },
            subdomain: {
                value: data.subdomain,
                enumerable: true
            },
            httpRoot: {
                value: data.httpRoot,
                enumerable: true
            },
            content: {
                get: function() {
                    return content || '';
                },
                set: function( value ) {
                    content = value;
                    contentSource = null;
                },
                enumerable: true
            },
            contentSource: {
                get: function() {
                    return contentSource;
                },
                set: function( value ) {
                    contentSource = value;
                    content = null;
                },
                enumerable: true
            }
        });
    }

    CodeHandler.prototype = {

        send: function() {

            var that = this;
            var res = that.res;

            if (that.contentSource) {

                fs.stat( that.contentSource , function( err , stats ) {
                    
                    if (err) {
                        throw err;
                    }

                    that.updateHead( 'Content-Length' , stats.size );
                    that.updateHead( 'Last-Modified' , new Date( stats.mtime ).toUTCString() );

                    that.writeHead( that.statusCode );

                    fs.createReadStream( that.contentSource )
                    .on( 'data' , function( chunk ) {
                        res.write( chunk );
                    })
                    .on( 'end' , function() {
                        res.end();
                    });
                });
            }
            else {
                that.writeHead( that.statusCode );
                res.end( that.content );
            }
        },

        writeHead: function( code ) {
            var that = this;
            if (!that._headersSent) {
                that.res.writeHead( code , that.headers );
                that.statusCode = code;
                that._headersSent = true;
            }
            return that;
        },

        updateHead: function( key , val , rude ) {
            var that = this;
            if (rude || that.headers[key] === undefined) {
                that.headers[key] = val;
            }
        }
    };


    return CodeHandler;


}());



















