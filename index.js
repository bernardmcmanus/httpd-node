/* jshint -W014 */
/* jshint -W069 */

module.exports = (function() {


  var http = require( 'http' );
  var https = require( 'https' );
  var colors = require( 'colors' );
  var mime = require( 'mime' );
  var fs = require( 'fs-extra' );
  var extend = require( 'extend' );
  var E$ = require( 'emoney' );
  var Promise = require( 'es6-promise' ).Promise;


  var $Request = require( './lib/request' );
  var $Response = require( './lib/response' );
  var Rewrite = require( './lib/rewrite' );
  var log = require( './lib/logger' );


  var USE = 'use';
  var WARN = 'warn';
  var ERROR = 'error';
  var SERVE = 'serve';
  var CONNECT = 'connect';
  var DISCONNECT = 'disconnect';
  var RESOLVED = 'resolved';
  var DEFAULT_SUBDOMAIN = 'default';
  var START_MESSAGE = 'server running at [protocol]://localhost:[port]/';


  var ENV = {
    root: __dirname,
    logLevel: 'info',
    version: fs.readJsonSync( './package.json' ).version,
    profile: 'prod'
  };


  Object.defineProperty( ENV , '_logLevels' , {
    value: [ 'trace' , 'debug' , 'info' , 'warn' , 'error' ]
  });


  function httpd( options ) {

    var that = this;

    that.port = 8888;
    that.index = 'index.html';
    that.verbose = true;
    that.ssl = null;

    extend( that , options );

    that._env = E$( ENV );
    that.listening = false;
    that._handle = that._handle.bind( that );

    if (that.ssl) {
      that.ssl = httpd._readSSL( that.ssl.key , that.ssl.cert );
    }

    E$.construct( that );

    Object.defineProperties( that , {
      protocol: {
        get: function() {
          return that.ssl ? 'https' : 'http';
        }
      },
      httpRoot: {
        value: {}
      },
      _rewriteRules: {
        value: {}
      }
    });

    // watch intance _env
    that.$watch( that._env );

    // listen to self
    that.$when();

    // set the default httpRoot
    that.dir( DEFAULT_SUBDOMAIN , '/www' );

    // add default headers
    that.use(function( $req , $res ) {
      $res.setHeaders({ 'Transfer-Encoding': 'chunked' });
      //$res.$original.setHeader( 'x-powered-by' , 'httpd-node ' + that._env.version );
    });
  }


  httpd.log = log;


  httpd.env = function( key , value ) {
    ENV[key] = value;
  };


  /*httpd.gzip = function( req , res ) {
    var accept = req.headers['Accept-Encoding'] || '';
    if (accept.indexOf( 'gzip' )) {
      res.setHeader( 'Content-Encoding' , 'gzip' );
      return true;
    }
    return false;
  };*/


  httpd.cleanHeaders = function( res ) {
    if (!res.headersSent) {
      [ 'Content-Encoding' ].forEach(function( key ) {
        res.removeHeader( key );
      });
    }
  };


  httpd._getLogLevelIndex = function( text ) {
    return ENV._logLevels.indexOf( text );
  };


  httpd._fatal = function( res , err , printStack ) {
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


  httpd.prototype = E$.create({

    use: function( handle ) {
      var that = this;
      return that.$when( USE , function() {
        var args = arrayCast( arguments ).slice( 1 );
        handle.apply( null , args );
      });
    },

    rewrite: function( options , gzip ) {
      
      var that = this;
      var pattern = options.pattern;
      var replacement = options.replacement;
      var subdomain = options.subdomain || DEFAULT_SUBDOMAIN;

      that._getRewriteRules( subdomain ).push(
        new Rewrite( pattern , replacement , gzip )
      );

      return that;
    },

    gzip: function( options ) {
      var that = this;
      return that.rewrite( options , true );
    },

    env: function( key , value ) {
      var that = this;
      var env = that._env;
      env.$emit( 'set' , key , function( e ) {
        env[key] = value;
      });
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
        
        var msg = getStartMessage({
          protocol: that.protocol,
          port: that.port
        });

        console.log( msg.cyan );
      })
      .then(function() {
        that.$emit( CONNECT );
      })
      .catch(function( err ) {
        that.$emit( ERROR , err );
      });

      return that;
    },

    stop: function() {
      var that = this;
      that.server.close(function() {
        that.$emit( DISCONNECT );
      });
    },

    getHttpRoot: function( subdomain ) {
      var that = this;
      var root = that._env.root;
      var httpRoot = that.httpRoot;
      var relative = httpRoot[subdomain] || httpRoot[ DEFAULT_SUBDOMAIN ];
      return root + relative;
    },

    handleE$: function( e ) {

      var that = this;
      var args = arrayCast( arguments );
      //var e = args.shift();
      var target = e.target, key, err;

      /*if (target instanceof $Request) {
        that._handle$Request.apply( that , args );
      }
      else if (target instanceof $Response) {
        that._handle$Response.apply( that , args );
      }*/
      if (target instanceof $Request || target instanceof $Response) {
        that._handle$Correspondence.apply( that , args );
      }
      else if (target === that) {

        // remove event from args
        args.shift();

        switch (e.type) {

          case 'set':
            key = args.pop();
            if (target === that._env && that._env[key] === 'dev') {
              that.env( 'logLevel' , 'trace' );
            }
          break;

          case SERVE:
            if (that.verbose) {
              //httpd.log.request.apply( null , args );
            }
          break;

          case ERROR:
            err = args.shift();
            that._log( err , 4 );
          break;

          case CONNECT:
            that.listening = true;
          break;

          case DISCONNECT:
            that.listening = false;
          break;
        }
      }
    },

    _handle$Correspondence: function( e , data ) {
      
      var that = this;
      var target = e.target;

      switch (e.type) {

        case WARN:
          that.$emit( ERROR , data );
        break;

        case ERROR:
          that.$emit( ERROR , data );
        break;

        case RESOLVED:
          that.$ignore( target );
        break;
      }
    },

    _createServer: function() {
      
      var that = this;

      return new Promise(function( resolve ) {
        resolve( that.ssl ? https : http );
      })
      .then(function( module ) {
        
        var args = [ that._handle ];
        
        if (that.ssl) {
          args.unshift( that.ssl );
        }

        return new Promise(function( resolve ) {

          var server = module.createServer.apply( module , args );

          server.on( 'clientError' , function( err ) {
            that._log( err.message , 'info' );
            //that.$emit( ERROR , err );
          });

          server.listen( that.port , function() {
            resolve( server );
          });
        });
      })
      .then(function( server ) {
        return server;
      });
    },

    _spawnRequest: function( req ) {
      var that = this;
      var subdomain = that._getSubdomain( req );
      var httpRoot = that.getHttpRoot( subdomain );
      var rewriteRules = that._getRewriteRules( subdomain );
      var $req = new $Request( req , {
        subdomain: subdomain,
        rootDir: httpRoot,
        rewriteRules: rewriteRules,
        index: that.index
      });
      that.$watch( $req );
      return $req;
    },

    _spawnResponse: function( $req , res ) {
      var that = this;
      var $res = new $Response( $req , res );
      that.$watch( $res );
      return $res;
    },

    _handle: function( req , res ) {

      var that = this;

      var $req = that._spawnRequest( req );
      //var $response = that._spawnResponse( $req , res );

      $req.digest().then(function() {
        httpd.log($req);
        return that._spawnResponse( $req , res );
      })
      .then(function( $res ) {
        
        //httpd.log(that.handlers.use);
        that.$emit( USE , [ $req , $res ]);
        
        return new Promise(function( resolve , reject ) {
          that.$emit( SERVE , [ $req , $res ] , resolve );
          reject();
        })
        .then(function() {
          return $res.digest();
        });
      })
      .then(function( $res ) {
        httpd.log($res);
      })
      .catch(function( err ) {
        httpd.log(err);
      });
    },

    _log: function( args , level ) {
      var that = this;
      var logLevel = that._env.logLevel;
      args = Array.isArray( args ) ? args : [ args ];
      if (level <= httpd._getLogLevelIndex( logLevel )) {
        httpd.log.apply( null , args );
      }
    },

    _fatal: function( res , err ) {
      var that = this;
      var printStack = (that._env.profile === 'dev');
      that.$emit( ERROR , err );
      httpd._fatal( res , err , printStack );
    },

    _getRewriteRules: function( subdomain ) {
      var that = this;
      var rules = that._rewriteRules[subdomain] || [];
      that._rewriteRules[subdomain] = rules;
      return rules;
    },

    _getSubdomain: function( req ) {
      var host = req.headers.host || 'localhost';
      var arr = host.split( '.' );
      var len = arr.length;
      return (isIP( host ) || arr.length < 3 ? DEFAULT_SUBDOMAIN : arr[ len - 3 ]);
    }
  });


  function getStartMessage( params ) {
    var msg = START_MESSAGE;
    Object.keys( params ).forEach(function( key ) {
      var value = params[key];
      var re = new RegExp( '\\[' + key + '\\]' , 'gi' );
      msg = msg.replace( re , value );
    });
    return msg;
  }


  function isIP( host ) {
    return (/(\d{1,3}\.){3}\d{1,3}/).test( host );
  }


  function ensureArray( subject ) {
    return ( Array.isArray( subject ) ? subject : ( subject !== undefined ? [ subject ] : [] ));
  }


  function arrayCast( subject ) {
    return Array.prototype.slice.call( subject , 0 );
  }


  return httpd;


}());



















