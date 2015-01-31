module.exports = (function() {
    

  var util = require( 'util' );
  var colors = require( 'colors' );
  var $Request = require( './request' );
  var Warning = require( './warning' );


  var COLOR_MAP = {
    200: 'green',
    302: 'cyan',
    403: 'yellow',
    404: 'yellow',
    500: 'red',
    default: 'white'
  };


  function Log() {
    
    var args = arrayCast( arguments );
    
    if (args[0] instanceof $Request) {
      return Log.request( args[0] );
    }
    else if (args[0] instanceof Warning) {
      return Log.warn( args[0] );
    }
    else if (args[0] instanceof Error) {
      return Log.error( args[0] );
    }

    var str = args
    .map(function( arg ) {
      return util.inspect.apply( util , [ arg , { colors: true, depth: null }]);
    })
    .join( ' ' ) + '\n';

    console.log( str );
  }


  Log.request = function( $req ) {

    var data = {
      requestPath: $req.$reqPath,
      hostName: getHostname( $req.$original ),
      get: $req.$get,
      remoteAddress: getRemoteAddress( $req.$original ),
      timestamp: new Date().toString()
    };

    util.print(
      Log.formatCode( $req.$code ) + ' ->\n'
    );
    
    Log( data );
  };


  Log.formatCode = function( code ) {
    var color = COLOR_MAP[code] || COLOR_MAP.default;
    var str = ( '[code]' ).replace( 'code' , code.toString() )
    return str[ color ]
  };


  Log.warn = function( warning ) {
    util.puts( warning.message.yellow );
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



















