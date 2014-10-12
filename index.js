module.exports = (function() {


    var util = require( 'util' );
    var http = require( 'http' );
    var https = require( 'https' );
    var Url = require( 'url' );
    var fs = require( 'fs-extra' );
    var mime = require( 'mime' );
    var Codes = require( './lib/codes' );
    var CodeHandler = require( './lib/codehandler' );
    var RequestPath = require( './lib/requestPath' );


    var Environ = {
        root: __dirname
    };


    function HTTPD( options ) {

        var that = this;
        options = options || {};

        that._environ = Object.create( Environ );
        that.port = 8888;
        that.index = 'index.html';
        that.verbose = true;
        that.ssl = null;

        Object.keys( options ).forEach(function( key ) {
            that[key] = (options[key] !== undefined ? options[key] : config[key]);
        });

        if (that.ssl) {
            that.ssl = that._getSSLCerts( that.ssl.key , that.ssl.cert );
        }

        Object.defineProperties( that , {
            protocol: {
                get: function() {
                    return that.ssl ? 'https' : 'http';
                }
            },
            httpRoot: {
                value: options.httpRoot ? Object.create( options.httpRoot ) : {}
            },
            _use: {
                value: []
            },
            validIndexes: {
                value: {}
            }
        });

        // add the default httpRoot
        that.setHttpDir( 'default' , '/www' );
    }


    HTTPD.environ = function( key , value ) {
        HTTPD.Environ( key , value );
    };


    HTTPD.log = function() {
        var args = Array.prototype.slice.call( arguments , 0 );
        args.push({ colors: true, depth: null });
        console.log(
            util.inspect.apply( util , args )
        );
    };


    HTTPD.prototype = {

        environ: function( key , value ) {
            this._environ[key] = value;
            return this;
        },

        setHttpDir: function( domain , value ) {
            this.httpRoot[domain] = value;
            return this;
        },

        _getSSLCerts: function( key , cert ) {
            return {
                key: fs.readFileSync( key ),
                cert: fs.readFileSync( cert )
            };
        },

        start: function() {
            
            var that = this;

            if (that.ssl) {
                https.createServer( that.ssl , function() {
                    that._handle.apply( that , arguments );
                })
                .listen( that.port );
            }
            else {
                http.createServer(function() {
                    that._handle.apply( that , arguments );
                })
                .listen( that.port );
            }

            util.puts( 'server running at ' + that.protocol + '://localhost:' + ( that.port ) + '/' );

            return that;
        },

        use: function( handler ) {
            var that = this;
            that._use.push( handler );
            return that;
        },

        getHttpRoot: function( subdomain ) {

            var that = this;
            var root = that._environ.root;

            if (typeof that.httpRoot === 'string') {
                return root + that.httpRoot;
            }

            var httpRoot = (that.httpRoot[subdomain] || that.httpRoot.default);

            if (typeof httpRoot === 'function') {
                return httpRoot( root );
            }
            else {
                return root + httpRoot;
            }            
        },

        _handle: function( req , res ) {

            var that = this;
            var subdomain = that._getSubdomain( req );
            var httpRoot = that.getHttpRoot( subdomain );
            var path = that._getPath( req.url , httpRoot );

            that._route( path , function( code , info ) {

                var data = new CodeHandler( res , {
                    statusCode: code,
                    headers: info.headers,
                    subdomain: subdomain,
                    httpRoot: httpRoot
                });

                if (info.content) {
                    data.content = info.content;
                }
                else if (info.contentSource) {
                    data.contentSource = info.contentSource;
                }

                try {
                    //throw new Error( 'error' );
                    that._serve( req , res , path , data );
                }
                catch (err) {
                    util.puts( err.stack );
                    res.end();
                }
            });
        },

        _route: function( path , callback ) {

            var that = this;

            if (path.pointsToDirectory) {
                path.append( '/' );
                return callback( 302 , {
                    headers: {
                        'Location': path.relative + path.search
                    }
                });
            }

            if (path.pointsToIndex) {
                path.modify(
                    that._getIndex( path )
                );
            }

            if (!fs.existsSync( path.absolute )) {
                return callback( 404 , {
                    content: '404 Not Found\n',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });
            }

            var stats = fs.statSync( path.absolute );

            if (stats.isDirectory()) {
                return callback( 401 , {
                    content: '401 Unauthorized\n',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });
            }

            callback( 200 , {
                contentSource: path.relative,
                headers: {
                    'Content-Type': mime.lookup( path.absolute )
                }
            });
        },

        _serve: function( req , res , path , data ) {

            var that = this;

            that._use.forEach(function( handler ) {
                handler( req , res , data );
            });

            if (data.contentSource) {
                path.modify( data.contentSource );
                data.contentSource = path.absolute;
            }

            data.send();

            if (that.verbose) {
                util.puts(
                    Codes.format( data.statusCode ) + ' -> ' + path.original
                );
            }
        },

        _getPath: function( url , httpRoot ) {
            var parsed = Url.parse( url );
            return new RequestPath( parsed , httpRoot );
        },

        _getSubdomain: function( request ) {
            var arr = (request.headers.host || '').split( '.' );
            return (arr.length < 2 ? '' : arr[0]);
        },

        _getIndex: function( path ) {

            var that = this;
            var relative = path.relative;
            var absolute = path.absolute;

            if (that.validIndexes[absolute]) {
                return relative + that.index;
            }
            
            if (that.index && fs.existsSync( absolute + that.index )) {
                that.validIndexes[absolute] = that.index;
                return relative + that.index;
            }

            return relative;
        }
    };


    return HTTPD;


}());



















