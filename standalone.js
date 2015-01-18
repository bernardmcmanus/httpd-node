(function() {

  var path = require( 'path' );
  var colors = require( 'colors' );
  var httpd = require( './index.js' );

  httpd.environ( 'root' , path.join( __dirname , '../bfmiv/public' ));

  process.on( 'message' , function( msg ) {
    if (msg.event === 'exit') {
      server.stop();
    }
  });

  var server = new httpd({
    port: 3000
  })
  .dir( 'vm' , '/vm' )
  .dir( 'default' , '/public' )
  .dir( 'cdn' , '/cdn' )
  .environ( 'profile' , 'dev' )
  .rewrite({
    pattern: /\.js$/i,
    preserve: true,
    handle: function( req , res , match ) {
      if (httpd.gzip( req , res )) {
        match = match.replace( /\.js$/i , '.js.gz' );
      }
      return match;
    }
  })
  .rewrite({
    pattern: /^\/[^\/]+\.js$/i,
    subdomain: 'cdn',
    preserve: true,
    handle: function( req , res , match ) {
      if (httpd.gzip( req , res )) {
        match = match
        .replace( /^\//i , '/gz/' )
        .replace( /\.js$/i , '.js.gz' );
      }
      return match;
    }
  })
  .use(function( req , res , responseModel ) {
    //httpd.log( responseModel );
  })
  .$when( 'error' , function( e , err ) {
    console.log( err.stack.red );
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



















