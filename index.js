/* jshint -W014 */
/* jshint -W069 */

module.exports = (function() {


    var util = require( 'util' );
    var http = require( 'http' );
    var https = require( 'https' );
    var colors = require( 'colors' );
    var fs = require( 'fs-extra' );
    //var mime = require( 'mime' );
    var Promise = require( 'wee-promise' );


    var RequestPath = require( './lib/requestPath' );
    var Rewrite = require( './lib/rewrite' );
    var RouteModel = require( './models/routeModel' );
    var ResponseModel = require( './models/responseModel' );
    var Log = require( './lib/logger' );


    var Environ = {
        root: __dirname,
        logLevel: 'info',
        version: fs.readJsonSync( './package.json' ).version
    };

    Object.defineProperty( Environ , '_logLevels' , {
        value: [ 'trace' , 'debug' , 'info' , 'warn' , 'error' ]
    });


    function httpd( options ) {

        var that = this;
        options = options || {};

        that.port = 8888;
        that.index = 'index.html';
        that.verbose = true;
        that.ssl = null;

        Object.keys( options ).forEach(function( key ) {
            that[key] = options[key];
        });

        that._environ = Object.create( Environ );
        that.listening = false;

        if (that.ssl) {
            that.ssl = httpd._readSSL( that.ssl.key , that.ssl.cert );
        }

        Object.defineProperties( that , {
            protocol: {
                get: function() {
                    return that.ssl ? 'https' : 'http';
                }
            },
            httpRoot: {
                value: {}
            },
            _use: {
                value: []
                //value: {}
            },
            _rewriteRules: {
                value: {}
            }
        });

        // add the default httpRoot
        that.dir( 'default' , '/www' );

        // add default headers
        /*that.use(function( req , res , data ) {
            res.setHeader( 'x-powered-by' , 'httpd-node ' + that._environ.version );
        });*/
    }


    httpd.log = Log;


    httpd.environ = function( key , value ) {
        Environ[key] = value;
    };


    httpd._getLogLevelIndex = function( text ) {
        return Environ._logLevels.indexOf( text );
    };


    httpd.gzip = function( req , res ) {
        var accept = req.headers['Accept-Encoding'] || '';
        if (accept.indexOf( 'gzip' )) {
            res.setHeader( 'Content-Encoding' , 'gzip' );
            return true;
        }
        return false;
    };


    /*httpd._formatCode = function( code ) {
        code = code.toString();
        switch (code) {
            case '200':
                return ( '[' + code + ']' ).green;
            case '302':
                return ( '[' + code + ']' ).cyan;
            case '401':
            case '404':
                return ( '[' + code + ']' ).yellow;
            case '500':
                return ( '[' + code + ']' ).red;
            default:
                return ( '[' + code + ']' ).white;
        }
    };*/


    /*httpd.log = function() {
        
        var args = Array.prototype.slice.call( arguments , 0 );
        
        if (args[0] instanceof Error) {
            return httpd._logError( args[0] );
        }

        var str = args
        .map(function( arg ) {
            return util.inspect.apply( util , [ arg , { colors: true, depth: null }]);
        })
        .join( ' ' ) + '\n';

        console.log( str );
    };*/


    /*httpd._logRequest = function( req , code , reqPath ) {

        var reqdata = {
            requestPath: reqPath.original,
            query: reqPath.query,
            remoteAddress: getRemoteAddress( req ),
            timestamp: new Date().toUTCString()
        };

        util.print(
            httpd._formatCode( code ) + ' ->\n'
        );
        
        httpd.log( reqdata );
    };*/


    /*httpd._logError = function( err ) {
        var stack = err.stack.split( '\n' );
        var message = stack.shift();
        stack = stack.join( '\n' );
        util.puts(
            ( message ).red
        );
        util.puts(
            ( stack ).gray
        );
    };*/


    httpd._fatal = function( res , err ) {
        Log.error( err );
        res.writeHead( 500 , {
            'Content-Type': 'text/plain'
        });
        res.end( '500 Internal Server Error\n' );
    };


    httpd._readSSL = function( key , cert ) {
        return {
            key: fs.readFileSync( key ),
            cert: fs.readFileSync( cert )
        };
    };


    httpd.prototype = {

        use: function( handler ) {
            var that = this;
            that._use.push( handler );
            return that;
        },

        rewrite: function( /*regexp , subdomain , headers , handler*/ ) {
            
            var that = this;
            //var args = Array.prototype.slice.call( arguments , 0 );
            var args = Array.cast( arguments );

            var handler = args.pop();
            var regexp = args.shift();
            var headers = (Array.isArray( args[0] ) ? args.pop() : null);
            var subdomain = (typeof args[0] === 'string' ? args.pop() : 'default');
            var subset = that._rewriteRules[subdomain] || [];

            subset.push(
                new Rewrite( regexp , handler , headers )
            );

            that._rewriteRules[subdomain] = subset;

            return that;
        },

        environ: function( key , value ) {
            var that = this;
            that._environ[key] = value;
            return that;
        },

        dir: function( domain , value ) {
            var that = this;
            that.httpRoot[domain] = value;
            return that;
        },

        start: function() {
            
            var that = this;

            that._createServer().then(function( server ) {
                that.server = server;
                that.listening = true;
                util.puts(
                    (
                        'server running at '
                        + that.protocol
                        + '://localhost:'
                        + that.port + '/'
                    ).cyan
                );
            })
            .catch(function( err ) {
                that.listening = false;
                that._log( err , 4 );
            });

            return that;
        },

        stop: function( callback ) {
            var that = this;
            that.server.close( callback );
            that.listening = false;
        },

        getHttpRoot: function( subdomain ) {
            var that = this;
            var root = that._environ.root;
            var httpRoot = that.httpRoot[subdomain];
            return root + httpRoot;
        },

        _createServer: function() {
            
            var that = this;

            function reqHandler() {
                try {
                    that._handle.apply( that , arguments );
                }
                catch( err ) {
                    httpd._fatal( res , err );
                }
            }

            return new Promise(function( resolve , reject ) {

                var server;

                if (that.ssl) {
                    server = https.createServer( that.ssl , reqHandler );
                }
                else {
                    server = http.createServer( reqHandler );
                }

                server.on( 'clientError' , function( err ) {
                    if (that.verbose) {
                        Log( err );
                    }
                });

                server.listen( that.port , function() {
                    resolve( server );
                });
            });
        },

        _handle: function( req , res ) {

            var that = this;
            var subdomain = that._getSubdomain( req );
            var rules = that._getRewriteRules( subdomain );
            var httpRoot = that.getHttpRoot( subdomain );
            var reqPath = new RequestPath( req.url , httpRoot );

            reqPath.rewrite(
                Rewrite.match( reqPath , rules )( req , res , reqPath.relative )
            );

            that._route( reqPath ).then(function( routeModel ) {

                var resModel = new ResponseModel(
                    subdomain,
                    httpRoot,
                    reqPath,
                    routeModel
                );

                that._use.forEach(function( handler ) {
                    handler( req , res , resModel );
                });

                that._serve( req , res , reqPath , resModel , routeModel.body );
            })
            .catch(function( err ) {
                httpd._fatal( res , err );
            });
        },

        _route: function( reqPath ) {

            var that = this;

            return new Promise(function( resolve , reject ) {

                if (reqPath.pointsToDirectory) {
                    reqPath.append( '/' );
                    resolve(
                        new RouteModel( reqPath , { code: 302 })
                    );
                    return;
                }

                if (reqPath.pointsToIndex) {
                    reqPath.append( that.index );
                }

                Promise.all([
                    readFile( reqPath.current.abs ),
                    fileStat( reqPath.current.abs )
                ])
                .then(function( args ) {

                    var body = args[0];
                    var stats = args[1];

                    var routeModel = new RouteModel( reqPath , {
                        code: 200,
                        headers: {
                            'Content-Length': stats.size,
                            'Last-Modified': new Date( stats.mtime ).toUTCString()
                        },
                        body: body
                    });

                    resolve( routeModel );
                })
                .catch(function( err ) {
                    that._log( err , 4 );
                    resolve(
                        new RouteModel( reqPath , { code: 404 })
                    );
                });
            });
        },

        _serve: function( req , res , reqPath , resModel , body ) {

            var that = this;

            res.writeHead( resModel.statusCode , resModel.headers );
            res.end( body );

            if (that.verbose) {
                Log.request( req , resModel.statusCode , reqPath );
            }
        },

        _log: function( args , level ) {
            var that = this;
            var logLevel = that._environ.logLevel;
            args = Array.isArray( args ) ? args : [ args ];
            if (level <= httpd._getLogLevelIndex( logLevel )) {
                Log.apply( null , args );
            }
        },

        _getRewriteRules: function( subdomain ) {
            var that = this;
            return that._rewriteRules[subdomain] || [];
        },

        _getSubdomain: function( req ) {
            var arr = (req.headers.host || '').split( '.' );
            return (arr.length < 2 ? 'default' : arr[0]);
        }
    };


    /*function getErrorType( err ) {
        if (err instanceof EvalError) {
            return 'EvalError';
        }
        else if (err instanceof RangeError) {
            return 'RangeError';
        }
        else if (err instanceof ReferenceError) {
            return 'ReferenceError';
        }
        else if (err instanceof TypeError) {
            return 'TypeError';
        }
        else if (err instanceof URIError) {
            return 'URIError';
        }
        else {
            return 'Error';
        }
    }*/


    /*function getRemoteAddress( req ) {
        return (
            req.headers['x-forwarded-for'] || 
            req.connection.remoteAddress || 
            req.socket.remoteAddress
        );
    }*/


    /*function arrayCast() {
        return Array.prototype.slice.call( arguments , 0 );
    }*/
    Array.cast = function( subject ) {
        return Array.prototype.slice.call( subject , 0 );
    };


    function readFile( filepath ) {
        return new Promise(function( resolve , reject ) {
            fs.readFile( filepath , function( err , content ) {
                return err ? reject( err ) : resolve( content );
            });
        });
    }


    function fileStat( filepath ) {
        return new Promise(function( resolve , reject ) {
            fs.stat( filepath , function( err , stats ) {
                return err ? reject( err ) : resolve( stats );
            });
        });
    }


    return httpd;


}());



















