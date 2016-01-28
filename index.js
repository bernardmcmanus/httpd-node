'use strict';

var
  _ = require( 'lodash' ),
  http = require( 'http' ),
  https = require( 'https' ),
  colors = require( 'colors' ),
  mime = require( 'mime' ),
  fs = require( 'fs-extra' ),
  E$ = require( 'emoney' ),
  Promise = require( 'bluebird' );

var
  RequestPath = require( './lib/requestPath' ),
  Rewrite = require( './lib/rewrite' ),
  RouteModel = require( './models/routeModel' ),
  ResponseModel = require( './models/responseModel' ),
  log = require( './lib/logger' );

var
  ERROR = 'error',
  SERVE = 'serve',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  START_MESSAGE = 'server running at [protocol]://localhost:[port]/';

var Environ = {
  get _logLevels(){
    return [ 'trace' , 'debug' , 'info' , 'warn' , 'error' ];
  },
  root: __dirname,
  logLevel: 'info',
  version: fs.readJsonSync( './package.json' ).version,
  profile: 'prod'
};

module.exports = httpd;

function httpd( options ) {
  var that = this;
  E$.call( that );

  _.defaults( that , {
    port: 8888,
    index: 'index.html',
    verbose: true,
    ssl: null
  });

  _.extend( that , options );

  that._environ = E$( Environ );
  that.listening = false;
  that._handle = that._handle.bind( that );

  if (that.ssl) {
    that.ssl = httpd._readSSL( that.ssl.key , that.ssl.cert );
  }

  Object.defineProperties( that , {
    protocol: { get: function() {
      return that.ssl ? 'https' : 'http';
    }},
    httpRoot: { value: {} },
    _use: { value: [] },
    _rewriteRules: { value: {} }
  });

  // watch environ
  that.$watch( that._environ );

  // listen to self
  that.$when();

  // add the default httpRoot
  that.dir( 'default' , '/www' );

  // add default headers
  that.use(function( req , res , data ) {
    res.setHeader( 'Transfer-Encoding' , 'chunked' );
    //res.setHeader( 'x-powered-by' , 'httpd-node ' + that._environ.version );
  });
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
  if (!res.headersSent) {
    [ 'Content-Encoding' ].forEach(function( key ) {
      res.removeHeader( key );
    });
  }
};

httpd._getLogLevelIndex = function( text ) {
  return Environ._logLevels.indexOf( text );
};

httpd.fatal = function( res , err , printStack ) {
  var routeModel = new RouteModel( 500 );
  httpd.cleanHeaders( res );
  res.writeHead( 500 , routeModel.headers );
  res.write( routeModel.body );
  res.end( printStack ? err.stack : '' );
};

httpd._readSSL = function( key , cert ) {
  return {
    key: fs.readFileSync( key ),
    cert: fs.readFileSync( cert )
  };
};

httpd.defineMime = function( extension , mimeType ) {
  var obj = {};
  obj[mimeType] = [ extension ];
  mime.define( obj );
  return httpd;
};

httpd.prototype = _.extend(Object.create( E$.prototype ), {
  use: function( handle ) {
    var that = this;
    that._use.push( handle );
    return that;
  },
  rewrite: function( options ) {
    var that = this;
    var pattern = options.pattern;
    var handle = options.handle;
    var subdomain = options.subdomain || 'default';
    var preserve = !!options.preserve;
    that._getRewriteRules( subdomain ).push(
      new Rewrite( pattern , handle , preserve )
    );
    return that;
  },
  environ: function( key , value ) {
    var that = this;
    var environ = that._environ;
    environ.$emit( 'set' , key , function( e ) {
      environ[key] = value;
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
    var root = that._environ.root;
    var httpRoot = that.httpRoot[subdomain];
    return root + httpRoot;
  },
  handleE$: function() {
    var that = this;
    var args = arrayCast( arguments );
    var e = args.shift();
    var target, key, err;
    switch (e.type) {
      case 'set':
        target = e.target;
        key = args.pop();
        if (target === that._environ && that._environ[key] === 'dev') {
          that.environ( 'logLevel' , 'trace' );
        }
      break;
      case SERVE:
        if (that.verbose) {
          httpd.log.request.apply( null , args );
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
  },
  _createServer: function() {
    var that = this;
    return new Promise(function( resolve , reject ) {
      var server;
      if (that.ssl) {
        server = https.createServer( that.ssl , that._handle );
      }
      else {
        server = http.createServer( that._handle );
      }
      server.listen( that.port , function() {
        resolve( server );
      });
    });
  },
  _handle: function( req , res ) {
    var that = this;
    var subdomain = that._getSubdomain( req );
    var httpRoot = that.getHttpRoot( subdomain );
    var reqPath = new RequestPath( req.url , httpRoot );
    var rules = that._getRewriteRules( subdomain );
    var rewriter = Rewrite.match( reqPath , rules );
    if (rewriter) {
      reqPath.rewrite(
        rewriter.handle( req , res , reqPath.relative )
      );
    }
    that._route( reqPath , rewriter ).then(function( routeModel ) {
      if (routeModel.statusCode !== 200) {
        httpd.cleanHeaders( res );
      }
      var resModel = new ResponseModel(
        subdomain,
        httpRoot,
        reqPath,
        routeModel
      );
      return Promise.mapSeries( that._use , function( handle ){
        return handle( req , res , resModel );
      })
      .return([ resModel , routeModel ]);
    })
    .spread(function( resModel , routeModel ){
      return that._serve( req , res , reqPath , resModel , routeModel );
    })
    .catch(function( err ) {
      that._fatal( res , err );
    });
  },
  _route: function( reqPath , rewriter ) {
    var that = this;
    return Promise.resolve().then(function(){
      if (reqPath.pointsToDirectory) {
        reqPath.append( '/' );
        return new RouteModel( 302 , {
          headers: { 'Location': reqPath.full }
        });
      }
      if (reqPath.pointsToIndex) {
        reqPath.append( that.index );
      }
      return Promise.all([
        getFileStat( reqPath.current.abs ),
        getFileMime( reqPath , ( rewriter && rewriter.preserve ))
      ])
      .spread(function( stats , contentType ) {
        return new RouteModel( 200 , {
          headers: {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Last-Modified': new Date( stats.mtime ).toUTCString()
          }
        });
      })
      .catch(function( err ) {
        that.$emit( ERROR , err );
        return new RouteModel( 404 );
      });
    });
  },
  _serve: function( req , res , reqPath , resModel , routeModel ) {
    var that = this;
    return new Promise(function( resolve , reject ){
      that.$emit( SERVE , [ req , resModel.statusCode , reqPath ] , function( e ) {
        res.on( 'finish' , resolve );
        if (routeModel.body) {
          resModel.headers['Content-Length'] = Buffer.byteLength( routeModel.body );
          res.writeHead( resModel.statusCode , resModel.headers );
          res.end( routeModel.body );
        }
        else {
          var readable = fs.createReadStream( reqPath.current.abs );
          readable.pipe( res );
          readable.on( ERROR , reject );
          res.on( ERROR , reject );
          res.writeHead( resModel.statusCode , resModel.headers );
        }
      });
    });
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
    var printStack = (that._environ.profile === 'dev');
    that.$emit( ERROR , err );
    httpd.fatal( res , err , printStack );
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
    return (isIP( host ) || arr.length < 3 ? 'default' : arr[ len - 3 ]);
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
  return (/((?:\d{1,3}\.?){4})/).test( host );
}

function arrayCast( subject ) {
  return Array.prototype.slice.call( subject , 0 );
}

function getFileStat( filepath ) {
  return new Promise(function( resolve , reject ) {
    fs.stat( filepath , function( err , stats ) {
      return err ? reject( err ) : resolve( stats );
    });
  });
}

function getFileMime( reqPath , preserveMime ) {
  return new Promise(function( resolve ) {
    resolve( preserveMime ? reqPath.absolute : reqPath.current.abs );
  })
  .then(function( path ) {
    return mime.lookup( path );
  });
}
