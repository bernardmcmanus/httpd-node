module.exports = (function() {


  var url = require( 'url' );
  var path = require( 'path' );
  var querystring = require( 'querystring' );
  var fs = require( 'fs-extra' );
  var Error = require ( 'errno-codes' );
  var Promise = require( 'es6-promise' ).Promise;
  var Rewrite = require( './rewrite' );


  function $Request( req , options ) {
    
    var that = Object.create( req );
    var parsed = url.parse( req.url );
    var pathname = decodeURIComponent( parsed.pathname );

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
      $absolute: {
        get: function() {
          return path.join( that.$rootDir , that.$requested );
        }
      },
      $index: {
        get: function() {
          return path.join( that.$absolute , options.index );
        }
      }
    });

    that.$code = null;
    that.$err = null;
    that.$headers = {};
    that.$isRewrite = false;
    that.$requested = pathname;
    that.$relative = pathname;
    that.$search = (parsed.search || '');
    that.$get = querystring.parse( parsed.query || '' );

    that.$rewrite = function( relative ) {
      that.$relative = relative;
      that.$isRewrite = true;
    };

    that.$process = function() {
  
      return new Promise(function( resolve ) {

        var rules = that.$rewriteRules;
        var rewriter = Rewrite.match( that.$relative , rules );

        if (rewriter) {
          that.$rewrite(
            rewriter.handle( that.$relative )
          );
        }

        resolve();
      })
      .then(function() {

        return that.$getStats().then(function( stat ) {
          return stat.isDirectory() ? 302 : 200;
        })
        .catch(function( err ) {
          console.log(err);
          if (err.code == Error.ENOENT.code) {
            return 404;
          }
          else {
            throw err;
          }
        });
      })
      .then(function( code ) {
        if (code == 302) {
          return that.$hasIndex().then(function( hasIndex ) {
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
        that.$err = err;
      });
    };

    that.$hasIndex = function() {
      return new Promise(function( resolve ) {
        fs.exists( that.$index , resolve );
      });
    };

    that.$getStats = function() {
      return new Promise(function( resolve , reject ) {
        fs.stat( that.$absolute , function( err , stats ) {
          return err ? reject( err ) : resolve( stats );
        });
      });
    };
    
    that.$revert = function() {
      var original = that.$original;
      that = original;
      return original;
    };

    return that;
  }


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



















