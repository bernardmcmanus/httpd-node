/* jshint -W014 */
/* jshint -W069 */

module.exports = (function() {


    var util = require( 'util' );
    var http = require( 'http' );
    var https = require( 'https' );
    var colors = require( 'colors' );
    var fs = require( 'fs-extra' );
    var MOJO = require( 'mojo' );
    var Promise = require( 'wee-promise' );


    var RequestPath = require( './lib/requestPath' );
    var Rewrite = require( './lib/rewrite' );
    var RouteModel = require( './models/routeModel' );
    var ResponseModel = require( './models/responseModel' );
    var log = require( './lib/logger' );


    var Environ = {
        root: __dirname,
        logLevel: 'info',
        version: fs.readJsonSync( './package.json' ).version,
        profile: 'prod'
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

        that._environ = new MOJO( Environ );
        that.listening = false;

        if (that.ssl) {
            that.ssl = httpd._readSSL( that.ssl.key , that.ssl.cert );
        }

        MOJO.construct( that );

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
            },
            _rewriteRules: {
                value: {}
            }
        });

        // add environ event listeners
        that._environ.$when([ '$$set' ] , that );

        // add httpd event listeners
        that.$when([
            '$$set',
            '$$serve',
            '$$error',
            '$$connect',
            '$$disconnect'
        ], that );

        // add the default httpRoot
        that.dir( 'default' , '/www' );

        // add default headers
        /*that.use(function( req , res , data ) {
            res.setHeader( 'x-powered-by' , 'httpd-node ' + that._environ.version );
        });*/
    }


    httpd.log = log;


    httpd.environ = function( key , value ) {
        Environ[key] = value;
    };


    httpd.gzip = function( req , res ) {
        var accept = req.headers['Accept-Encoding'] || '';
        if (accept.indexOf( 'gzip' )) {
            res.setHeader( 'Content-Encoding' , 'gzip' );
            return true;
        }
        return false;
    };


    httpd.cleanHeaders = function( res ) {
        [
            'Content-Encoding'
        ]
        .forEach(function( key ) {
            res.removeHeader( key );
        });
    };


    httpd._getLogLevelIndex = function( text ) {
        return Environ._logLevels.indexOf( text );
    };


    httpd._fatal = function( res , err , stack ) {
        var routeModel = new RouteModel( 500 );
        httpd.cleanHeaders( res );
        res.writeHead( 500 , routeModel.headers );
        res.write( routeModel.body );
        res.end( stack ? err.stack : '' );
    };


    httpd._readSSL = function( key , cert ) {
        return {
            key: fs.readFileSync( key ),
            cert: fs.readFileSync( cert )
        };
    };


    httpd.prototype = MOJO.create({

        use: function( handler ) {
            var that = this;
            that._use.push( handler );
            return that;
        },

        rewrite: function( /*regexp , subdomain , headers , handler*/ ) {
            
            var that = this;
            var args = arrayCast( arguments );

            var handler = args.pop();
            var regexp = args.shift();
            var subdomain = (typeof args[0] === 'string' ? args.shift() : 'default');
            var headers = (Array.isArray( args[0] ) ? args.pop() : null);

            httpd.log({
                handler: handler,
                regexp: regexp,
                headers: headers,
                subdomain: subdomain
            });

            var subset = that._rewriteRules[subdomain] || [];

            subset.push(
                new Rewrite( regexp , handler , headers )
            );

            that._rewriteRules[subdomain] = subset;

            return that;
        },

        environ: function( key , value ) {
            var that = this;
            that._environ.$set( key , value );
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
                util.puts(
                    (
                        'server running at '
                        + that.protocol
                        + '://localhost:'
                        + that.port + '/'
                    ).cyan
                );
            })
            .then(function() {
                that.$emit( '$$connect' );
            })
            .catch(function( err ) {
                that.$emit( '$$error' , err );
            });

            return that;
        },

        stop: function( callback ) {
            var that = this;
            callback = callback || function() {};
            that.server.close(function() {
                that.$emit( '$$disconnect' );
                callback();
            });
        },

        getHttpRoot: function( subdomain ) {
            var that = this;
            var root = that._environ.root;
            var httpRoot = that.httpRoot[subdomain];
            return root + httpRoot;
        },

        handleMOJO: function() {

            var that = this;
            var args = arrayCast( arguments );
            var e = args.shift();
            var target, key, err;

            if (MOJO.Event.isPrivate( e.type )) {
                that.$emit( e.type.replace( /^\${2}/ , '' ) , args );
            }

            switch (e.type) {

                case '$$set':
                    target = e.target;
                    key = args.pop();
                    if (target === that._environ && that._environ[key] === 'dev') {
                        that.environ( 'logLevel' , 'trace' );
                    }
                break;

                case '$$serve':
                    if (that.verbose) {
                        httpd.log.request.apply( null , args );
                    }
                break;

                case '$$error':
                    err = args.shift();
                    that._log( err , 4 );
                break;

                case '$$connect':
                    that.listening = true;
                break;

                case '$$disconnect':
                    that.listening = false;
                break;
            }
        },

        _createServer: function() {
            
            var that = this;

            function reqHandler() {
                try {
                    that._handle.apply( that , arguments );
                }
                catch( err ) {
                    that._fatal( res , err );
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
                    that.$emit( '$$error' , err );
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
                that._fatal( res , err );
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
                    that.$emit( '$$error' , err );
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

            that.$emit( '$$serve' , [ req , resModel.statusCode , reqPath ]);
        },

        _log: function( args , level ) {
            var that = this;
            var logLevel = that._environ.logLevel;
            args = Array.isArray( args ) ? args : [ args ];
            if (level <= httpd._getLogLevelIndex( logLevel )) {
                httpd.log.apply( null , args );
            }
        },

        _fatal: function( res , err ) {
            var that = this;
            var stack = that._environ.profile === 'dev';
            that.$emit( '$$error' , err );
            httpd._fatal( res , err , stack );
        },

        _getRewriteRules: function( subdomain ) {
            var that = this;
            return that._rewriteRules[subdomain] || [];
        },

        _getSubdomain: function( req ) {
            var arr = (req.headers.host || '').split( '.' );
            return (arr.length < 2 ? 'default' : arr[0]);
        }
    });


    function arrayCast( subject ) {
        return Array.prototype.slice.call( subject , 0 );
    }


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



















