module.exports = (function() {


  var zlib = require( 'zlib' );
  //var mime = require( 'mime' );
  var fs = require( 'fs-extra' );
  var Promise = require( 'es6-promise' ).Promise;
  //var extend = require( 'extend' );
  var E$ = require( 'emoney' );
  //var Codes = require( './codes' );
  //var ResponseThread = require( './response-thread' );


  /*function gzip( path , stat ) {

    var that = E$(new Promise(function( resolve ) {
      return stat ? resolve( stat ) : fs.stat( path , resolve );
    })
    .then(function( stat ) {
      
      var size = 0;
      var stream = fs.createReadStream( path );

      stream = stream.pipe( zlib.createGzip() );

      stream.on( 'data' , function( chunk ) {
        size += chunk.length;
      });

      stream.on( 'end' , function( chunk ) {
        that.$emit( 'readable' , { size: size });
      });

      return stream;
    })
    .catch(function( err ) {
      console.log(err.stack);
    }));

    return that;
  }*/


  function gzip( path , stat ) {

    var that = this;

    that.size = 0;

    E$.construct( that );

    return that._init( path , stat );
  }

  gzip.prototype = E$.create({

    _init: function( path , stat ) {
      
      var that = this;

      return new Promise(function( resolve ) {
        return stat ? resolve( stat ) : fs.stat( path , resolve );
      })
      .then(function( stat ) {
        
        var size = 0;
        var buffer = new Buffer( stat.size );
        var stream = fs.createReadStream( path );

        stream = stream.pipe( zlib.createGzip() );

        stream.on( 'data' , function( chunk ) {
          size += chunk.length;
          buffer = Buffer.concat([ buffer , chunk ]);
        });

        stream.on( 'end' , function( chunk ) {
          buffer = buffer.slice( 0 , size );
          that.$emit( 'readable' , { size: size });
        });

        that.stream = stream;

        return that;
      })
      .catch(function( err ) {
        console.log(err.stack);
      });
    },


  });


  return gzip;


}());



















