(function() {

  var colors = require( 'colors' );
  var httpd = require( './index.js' );

  process.on( 'message' , function( msg ) {
    if (msg.event === 'exit') {
      server.stop();
    }
  });

  var server = new httpd({
    port: 3000
  })
  .dir( 'default' , '/public' )
  .env( 'profile' , 'dev' )
  .gzip({
    pattern: /\.js$/i,
    replacement: function( match ) {
      return match.replace( /\.js$/i , '.js.gz' );
    }
  })
  .use(function( req , res , responseModel ) {
    //httpd.log( responseModel );
  })
  .$when( 'error' , function( e , err ) {
    httpd.log( err );
  })
  /*.$when( '*' , function( e ) {
    var _e = Object.create( e );
    for (var key in e) {
      if (e.hasOwnProperty( key ) && key != 'target') {
        _e[key] = e[key];
      }
    }
    httpd.log( _e );
  })*/
  /*.$when([ 'set' , 'serve' , 'error' , 'connect' , 'disconnect' ] , function( e ) {
    httpd.log(e);
  })*/
  .start();

  //server.$dispel();
  //httpd.log(server.handlers);

}());



















