module.exports = (function() {


    var colors = require( 'colors' );


    var Codes = [];


    Codes.format = function( code ) {

        code = code.toString();

        switch (code) {
            case '200':
                return ( '[' + code + ']' ).bold.green;
            case '302':
                return ( '[' + code + ']' ).bold.cyan;
            case '401':
            case '404':
                return ( '[' + code + ']' ).bold.yellow;
            case '500':
                return ( '[' + code + ']' ).bold.red;
            default:
                return ( '[' + code + ']' ).bold.white;
        }
    };


    Codes[200] = function( res , args ) {
        res.writeHead( 200 , args.headers );
        res.end( args.body );
    };


    Codes[302] = function( res , args ) {
        res.writeHead( 302 , args.headers );
        res.end();
    };


    Codes[401] = function( res  , args ) {
        res.writeHead( 401 , args.headers );
        res.end( '401 Unauthorized\n' );
    };


    Codes[404] = function( res , args ) {
        res.writeHead( 404 , args.headers );
        res.end( '404 Not Found\n' );
    };


    Codes[500] = function( res ) {
        res.writeHead( 500 , {
            'Content-Type': 'text/plain'
        });
        res.end( '500 Internal Server Error\n' );
    };

    
    return Codes;


}());



















