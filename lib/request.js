module.exports = (function() {


  var url = require( 'url' );
  var path = require( 'path' );
  var querystring = require( 'querystring' );
  var fs = require( 'fs-extra' );
  var E$ = require( 'emoney' );
  var mime = require( 'mime' );
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
      $isDir: {
        get: function() {
          return (/\/$/).test( that.$reqPath );
        }
      }
    });

    that.$code = null;
    that.$stat = {};
    that.$isRewrite = false;
    that.$reqPath = pathname;
    that.$resPath = pathname;
    that.$location = null;
    that.$mime = null;
    that.$gzip = false;
    that.$search = (parsed.search || '');
    that.$get = querystring.parse( parsed.query || '' );
  }


  $Request.prototype = E$.create({

    rewrite: function( rewriter ) {
      var that = this;
      if (rewriter) {
        that.$resPath = rewriter.handle( that.$resPath );
        that.$isRewrite = true;
        if (rewriter.gzip) {
          that.$mime = mime.lookup( that.$reqPath );
          that.$gzip = true;
        }
      }
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
        that.rewrite(
          Rewrite.match( that.$resPath , rules )
        );
        resolve();
      })
      .then(function() {
        if (that.$isDir) {
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
        if (code == 200) {
          that.$mime = that.$mime || mime.lookup( that.$resPath );
        }
        else if (code == 302) {
          return that.hasIndex().then(function( hasIndex ) {
            if (hasIndex) {
              that.append( '/' );
              that.$location = that.$resPath;
            }
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


  return $Request;


}());



















