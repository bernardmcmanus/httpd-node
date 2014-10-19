(function() {

    var httpd = require( './index.js' );

    //httpd.environ( 'root' , __dirname + 'test' );

    /*new httpd()
    .use(function( req , res , data ) {
        console.log(data);
    })
    .start();*/

    process.on( 'message' , function( msg ) {
        if (msg.event === 'exit') {
            server.stop();
        }
    });

    var server = new httpd({
        //verbose: false
    })
    .dir( 'default' , '/public' )
    .rewrite( /\.js$/i ,
        /*[
            'Content-Type'
        ],*/
        function( req , res , match ) {
            if (httpd.gzip( req , res )) {
                match = match.replace( /\.js$/i , '.js.gz' );
            }
            return match;
        }
    )
    .use(function( req , res , responseModel ) {

        /*if ((/\.html$/i).test( responseModel.responsePath )) {
            responseModel.headers['Content-Type'] = 'text/plain';
        }*/

        httpd.log( responseModel );
    })
    .start();

}());



















