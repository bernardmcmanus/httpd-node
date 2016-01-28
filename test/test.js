'use strict';

var fs = require( 'fs-extra' );
var path = require( 'path' );
var mime = require( 'mime' );
var colors = require( 'colors' );
var Promise = require( 'bluebird' );
var chai = require( 'chai' );
var expect = chai.expect;

var http = require( 'http' );
var https = require( 'https' );
var httpd = require( '../index.js' );


var PORT = 9001;
var HTTP_ROOT = path.resolve( __dirname , '../public' );
var SSL = null;


var server, testFuncs = {};

var testRoutes = [
  new TestRoute( 200 , '/' , '/index.html' ),
  new TestRoute( 302 , '/sub' , '/sub/' ),
  new TestRoute( 200 , '/sub/' , '/sub/index.html' ),
  new TestRoute( 302 , '/sub/notfound' , '/sub/notfound/' ),
  new TestRoute( 404 , '/sub/notfound/' , '/sub/notfound/index.html' ),
  new TestRoute( 404 , '/sub/notfound/asdf2/' , '/sub/notfound/asdf2/index.html' ),
  new TestRoute( 404 , '/sub/notfound/asdf3/' , '/sub/notfound/asdf3/index.html' ),
  new TestRoute( 200 , '/script.min.js' , '/script.min.js.gz' , {
    'Content-Type': 'application/javascript'
  })
];

describe( '#constructor' , function(){
  it( 'should create a new httpd instance' , function(){
    server = new httpd({
      verbose: false,
      port: PORT,
      ssl: SSL
    })
    .$when( 'error' , function( e , err ) {
      process.stdout.write( '      ' );
      console.log( err.stack.yellow );
    });
    expect( server ).to.be.an.instanceOf( httpd );
  });
});

describe( '#start' , function(){
  it( 'should start the httpd instance' , function( done ){
    process.stdout.write( '      ' );
    server.start().$once( 'connect' , function( e ) {
      done();
    });
  });
});

describe( '#dir' , function(){
  it( 'should set the http dir for a subdomain' , function(){
    server.dir( 'default' , '/public' );
    expect( server.httpRoot.default ).to.equal( '/public' );
  });
});

describe( '#use' , function(){
  it( 'should push to the _use array' , function(){
    var initLength = server._use.length;
    server.use(function( req , res , data ) {
      if (testFuncs[req.url]) {
        testFuncs[req.url].apply( null , arguments );
      }
    });
    expect( server._use.length ).to.equal( initLength + 1 );
  });
  it( 'should execute asynchronously when a promise is returned' , function(){
    var
      called,
      startTime,
      delay = 500;
    server.use(function( req , res , data ){
      if (!called) {
        called = true;
        startTime = Date.now();
        return new Promise(function( resolve ){
          setTimeout( resolve , delay );
        });
      }
    });
    return get( testRoutes[0].path ).then(function( res ) {
      expect( Date.now() - startTime ).to.be.at.least( delay );
    });
  });
});

describe( '#rewrite' , function(){
  it( 'should push to the _rewriteRules array' , function(){
    server.rewrite({
      pattern: /\.js$/i,
      preserve: true,
      handle: function( req , res , match ) {
        if (httpd.gzip( req , res )) {
          match = match.replace( /\.js$/i , '.js.gz' );
        }
        return match;
      }
    });
    expect( server._rewriteRules.default.length ).to.equal( 1 );
  });
});

describe( '#_handle' , function(){
  it( 'should handle http requests' , function(){
    var promises = testRoutes.map(function( tr ) {
      testFuncs[tr.path || '/'] = function( req , res , data ) {
        recurse( data , tr.data );
      };
      return get( tr.path ).then(function( res ) {
        expect( res.body ).to.equal( tr.body );
      });
    });
    return Promise.all( promises );
  });
});

function TestRoute( code , reqpath , respath , headers ) {

  var that = this;
  var body;

  switch (code) {

    case 200:
      body = fs.readFileSync( HTTP_ROOT + respath , {
        encoding: 'utf-8'
      });
    break;

    case 302:
      body = '302 Found\n';
    break;

    case 404:
      body = '404 Not Found\n';
    break;

    case 500:
      body = '500 Internal Server Error\n';
    break;
  }

  that.path = reqpath;
  that.data = new TestData( code , reqpath , respath , headers );
  that.body = body;
}

function TestData( code , reqpath , respath , headers ) {

  var that = this;
  var stats;
  headers = headers || {};

  Object.defineProperty( that , 'setHeaders' , {

    value: function( headers , definitions ) {
      definitions.forEach(function( definition ) {
        var key = definition.key;
        if (!headers[key]) {
          headers[key] = definition.getter();
        }
      });
    }
  });

  switch (code) {

    case 200:
      stats = fs.statSync( HTTP_ROOT + respath );
      that.setHeaders( headers , [
        {
          key: 'Content-Type',
          getter: function(){
            return mime.lookup( HTTP_ROOT + respath )
          }
        },
        {
          key: 'Content-Length',
          getter: function(){
            return stats.size;
          }
        },
        {
          key: 'Last-Modified',
          getter: function(){
            return new Date( stats.mtime ).toUTCString();
          }
        }
      ]);
    break;

    case 302:
      that.setHeaders( headers , [
        {
          key: 'Content-Type',
          getter: function(){ return 'text/plain'; }
        },
        {
          key: 'Location',
          getter: function(){ return respath; }
        },
      ]);
    break;

    case 404:
    case 500:
      that.setHeaders( headers , [
        {
          key: 'Content-Type',
          getter: function(){ return 'text/plain'; }
        }
      ]);
    break;
  }

  that.statusCode = code;
  that.requestPath = reqpath;
  that.responsePath = respath;
  that.headers = headers;
}

function get( url ) {

  return new Promise(function( resolve ) {
    resolve( server.protocol == 'https' ? https : http );
  })
  .then(function( module ) {
    return new Promise(function( resolve ) {
      var options = {
        host: 'localhost',
        port: PORT,
        path: url,
        agent: false
      };
      module.get( options , resolve );
    });
  })
  .then(function( res ) {

    return new Promise(function( resolve , reject ) {

      var body = '';

      res.setEncoding( 'utf-8' );

      res.on( 'data' , function( chunk ) {
        body += chunk;
      })
      .on( 'error' , function( err ) {
        reject( err );
      })
      .on( 'end' , function(){
        var response = Object.create( res );
        response.body = body;
        resolve( response );
      });
    });
  });
}

function recurse( actual , expected ) {
  for (var key in expected) {
    if (typeof actual[key] === 'object' && typeof expected[key] === 'object') {
      recurse( actual[key] , expected[key] );
    }
    else {
      expect( actual[key] ).to.equal( expected[key] );
    }
  }
}
