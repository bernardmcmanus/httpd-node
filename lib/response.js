module.exports = (function() {


  /*var url = require( 'url' );
  var querystring = require( 'querystring' );*/
  var fs = require( 'fs-extra' );
  var Promise = require( 'es6-promise' ).Promise;
  var extend = require( 'extend' );
  var ResponseThread = require( './response-thread' );


  var BODY = {

    200: '200 OK\n',

    302: '302 Found\n',

    403: '403 Forbidden\n',

    404: '404 Not Found\n',

    500: '500 Internal Server Error\n'

  };


  function $Response( $req , res ) {
    
    var that = this;

    Object.defineProperties( that , {
      $original: {
        value: res
      },
      /*$subdomain: {
        value: options.subdomain,
        enumerable: true
      },
      $rootDir: {
        value: options.rootDir,
        enumerable: true
      }*/
    });

    that.$target = $req.$absolute;

    that.$code = $req.$code;

    that.$headers = {};

    that.$body = (function() {

      var code = that.$code;
      var body = null;

      if (code != 200) {
        body = BODY[code] || BODY[500];
      }

      return body;

    }());

    that.$send = function() {

      var original = that.$original;

      return new Promise(function( resolve ) {

        if (that.$body) {
          original.writeHead( that.$code , that.$headers );
          original.end( that.$body );
        }
        else {

          var readable = fs.createReadStream( that.$target );

          /*readable.on( ERROR , function( err ) {
            that.$emit( ERROR , err );
          });

          original.on( ERROR , function( err ) {
            that.$emit( ERROR , err );
          });*/

          original.writeHead( that.$code , that.$headers );

          readable.pipe( original );
        }
      });
    };

    that.$setHeaders = function( headers ) {
      extend( that.headers , headers );
    };
    
    that.$revert = function() {
      var original = that.$original;
      that = original;
      return original;
    };

    return that;
  }


  return $Response;


}());



















