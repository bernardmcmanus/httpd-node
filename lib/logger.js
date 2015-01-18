module.exports = (function() {
    

  var util = require( 'util' );
  var colors = require( 'colors' );


  function Log() {
    
    var args = arrayCast( arguments );
    
    if (args[0] instanceof Error) {
      return Log.error( args[0] );
    }

    var str = args
    .map(function( arg ) {
      return util.inspect.apply( util , [ arg , { colors: true, depth: null }]);
    })
    .join( ' ' ) + '\n';

    console.log( str );
  }


  Log.request = function( req , code , reqPath ) {

    var reqdata = {
      requestPath: reqPath.original,
      hostName: getHostname( req ),
      get: reqPath.get,
      remoteAddress: getRemoteAddress( req ),
      timestamp: new Date().toUTCString()
    };

    util.print(
      Log.formatCode( code ) + ' ->\n'
    );
    
    Log( reqdata );
  };


  Log.formatCode = function( code ) {
    code = code.toString();
    switch (code) {
      case '200':
        return ( '[' + code + ']' ).green;
      case '302':
        return ( '[' + code + ']' ).cyan;
      case '401':
      case '404':
        return ( '[' + code + ']' ).yellow;
      case '500':
        return ( '[' + code + ']' ).red;
      default:
        return ( '[' + code + ']' ).white;
    }
  };


  Log.error = function( err ) {
    var stack = err.stack.split( '\n' );
    var message = stack.shift();
    stack = stack.join( '\n' );
    util.puts(
      ( message ).red
    );
    util.puts(
      ( stack ).gray
    );
  };


  function getHostname( req ) {
    var host = req.headers.host || 'localhost';
    return host.split( ':' ).shift();
  }


  function getRemoteAddress( req ) {
    return (
      req.headers['x-forwarded-for'] || 
      req.connection.remoteAddress || 
      req.socket.remoteAddress ||
      '127.0.0.1'
    );
  }


  function arrayCast( subject ) {
    return Array.prototype.slice.call( subject , 0 );
  }


  return Log;

  
}());



















