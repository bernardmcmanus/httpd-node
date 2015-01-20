module.exports = (function() {


  var url = require( 'url' );
  var path = require( 'path' );
  var querystring = require( 'querystring' );
  var fs = require( 'fs-extra' );
  var E$ = require( 'emoney' );
  var Error = require ( 'errno-codes' );
  var Promise = require( 'es6-promise' ).Promise;
  var Rewrite = require( './rewrite' );


  var WARN = 'warn';
  var ERROR = 'error';
  var RESOLVED = 'resolved';


  function $Request( req , options ) {
    
    var that = this;
    var parsed = url.parse( req.url );
    var pathname = decodeURIComponent( parsed.pathname );

    E$.construct( that );

    Object.defineProperties( that , {
      $original: {
        value: req
      },
      $subdomain: {
        value: options.subdomain,
        enumerable: true
      },
      $rootDir: {
        value: options.rootDir,
        enumerable: true
      },
      $rewriteRules: {
        value: options.rewriteRules,
        enumerable: true
      },
      $index: {
        value: options.index,
        enumerable: true
      },
      $isRoot: {
        get: function() {
          return (that.$reqPath == '/');
        }
      }
    });

    that.$code = null;
    that.$stat = {};
    that.$isRewrite = false;
    that.$reqPath = pathname;
    that.$resPath = pathname;
    that.$search = (parsed.search || '');
    that.$get = querystring.parse( parsed.query || '' );
  }


  $Request.prototype = E$.create({

    rewrite: function( relative ) {
      var that = this;
      that.$resPath = relative;
      that.$isRewrite = true;
    },

    relative: function() {
      var that = this;
      return {
        reqPath: that.$reqPath,
        resPath: that.$resPath,
        index: path.join( that.$resPath , that.$index )
      };
    },

    absolute: function() {
      var that = this;
      var rootDir = that.$rootDir;
      var relative = that.relative();
      for (var key in relative) {
        relative[key] = path.join( rootDir , relative[key] );
      }
      return relative;
    },

    append: function( fpath ) {
      var that = this;
      that.$resPath = path.join( that.$resPath , fpath );
    },

    digest: function() {
      var that = this;
      return new Promise(function( resolve ) {
        resolve( that._digest() );
      })
      .then(function( digestPromise ) {
        return digestPromise;
      })
      .then(function() {
        return that.$emit( RESOLVED , { code: that.$code });
      });
    },

    _digest: function() {

      var that = this;
  
      return new Promise(function( resolve ) {

        var rules = that.$rewriteRules;
        var rewriter = Rewrite.match( that.$resPath , rules );

        if (rewriter) {
          that.rewrite(
            rewriter.handle( that.$resPath )
          );
        }

        resolve();
      })
      .then(function() {
        if (that.$isRoot) {
          that.append( that.$index );
        }
      })
      .then(function() {

        return that.getStats().then(function( stat ) {
          that.$stat = stat;
          return stat.isDirectory() ? 302 : 200;
        })
        .catch(function( err ) {
          if (err.code == Error.ENOENT.code) {
            that.$emit( WARN , err );
            return 404;
          }
          else {
            throw err;
          }
        });
      })
      .then(function( code ) {
        if (code == 302) {
          return that.hasIndex().then(function( hasIndex ) {
            return hasIndex ? 302 : 403;
          });
        }
        return code;
      })
      .then(function( code ) {
        that.$code = code;
      })
      .catch(function( err ) {
        that.$code = 500;
        that.$emit( ERROR , err );
      });
    },

    hasIndex: function() {
      var that = this;
      return new Promise(function( resolve ) {
        fs.exists( that.absolute().index , resolve );
      });
    },

    getStats: function() {
      var that = this;
      var fpath = that.absolute().resPath;
      return new Promise(function( resolve , reject ) {
        fs.stat( fpath , function( err , stats ) {
          return err ? reject( err ) : resolve( stats );
        });
      });
    }

  });


  /*function getStats( path ) {
    return new Promise(function( resolve , reject ) {
      fs.stat( path , function( err , stats ) {
        return err ? reject( err ) : resolve( stats );
      });
    });
  }*/


  /*function pointsToDirectory( path ) {
    return (/(\/$)|(\.[0-9,a-z]+$)/i).test( path );
  }*/


  return $Request;


}());



















