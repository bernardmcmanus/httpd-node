module.exports = (function() {


  var fs = require( 'fs-extra' );
  var Promise = require( 'es6-promise' ).Promise;
  var extend = require( 'extend' );
  var E$ = require( 'emoney' );
  var Codes = require( './codes' );
  //var ResponseThread = require( './response-thread' );


  var WARN = 'warn';
  var ERROR = 'error';
  var RESOLVED = 'resolved';


  function $Response( $req , res ) {
    
    var that = this;

    E$.construct( that );

    Object.defineProperties( that , {
      $original: {
        value: res
      }
    });

    that.$code = $req.$code;
    that.$headers = {};
    that.$target = $req.absolute().resPath;
    that.$stat = $req.$stat;
    that.$body = Codes.body( $req.$code );

    that.setHeaders(
      Codes.headers( $req.$code )
    );

    if ($req.$mime) {
      that.setHeaders({ 'Content-Type': $req.$mime });
    }

    if ($req.$location) {
      that.setHeaders({ 'Location': $req.$location });
    }

    if ($req.$gzip) {
      that.setHeaders({ 'Content-Encoding': 'gzip' });
    }
  }


  $Response.prototype = E$.create({

    setHeaders: function( headers ) {
      var that = this;
      extend( that.$headers , headers );
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
      var original = that.$original;
      var code = that.$code;
      var headers = that.$headers;
      var target = that.$target;

      return new Promise(function( resolve , reject ) {

        if (that.$body) {
          that.setHeaders({ 'Content-Length': that.$body.length });
          original.writeHead( code , headers );
          original.end( that.$body );
          resolve();
        }
        else {

          that.setHeaders({ 'Content-Length': that.$stat.size });
          
          var stream = fs.createReadStream( target );

          stream.on( ERROR , reject );
          original.on( ERROR , reject );
          original.on( 'finish' , resolve );
          original.writeHead( code , headers );
          stream.pipe( original );
        }
      })
      .catch(function( err ) {
        that.$emit( ERROR , err );
      });
    }

  });


  return $Response;


}());



















