(function() {

    var util = require( 'util' );
    var httpd = require( './index.js' );

    //httpd.environ( 'root' , __dirname + 'test' );

    /*new httpd()
    .use(function( req , res , data ) {
        console.log(data);
    })
    .start();*/

    new httpd({
        //verbose: false
    })
    .setHttpDir( 'default' , '/test' )
    .use(function( req , res , data ) {

        //httpd.log( data );

        /*var accept = req.headers['Accept-Encoding'] || '';

        if (accept.indexOf( 'gzip' )) {
            data.headers['Content-Encoding'] = 'gzip';
            data.contentSource += '.gz';
        }*/
    })
    .start();

}());



















