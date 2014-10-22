(function() {

    var httpd = require( './index.js' );

    process.on( 'message' , function( msg ) {
        if (msg.event === 'exit') {
            server.stop();
        }
    });

    var server = new httpd()
    .dir( 'default' , '/public' )
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
    .use(function( req , res , responseModel ) {
        //httpd.log( responseModel );
    })
    .$when([ 'set' , 'serve' , 'error' , 'connect' , 'disconnect' ] , function( e ) {
        //httpd.log(e);
    })
    .start();

    //server.$dispel();
    //httpd.log(server.handlers);

}());



















