(function() {


  'use strict';


  var fs = require( 'fs-extra' );
  var path = require( 'path' );
  var util = require( 'util' );
  var mime = require( 'mime' );
  var colors = require( 'colors' );
  var Promise = require( 'es6-promise' ).Promise;
  var chai = require( 'chai' );
  var assert = chai.assert;
  var expect = chai.expect;

  var http = require( 'http' );
  var https = require( 'https' );
  var httpd = require( '../index.js' );


  var PORT = 8880;
  var HTTP_ROOT = path.resolve( __dirname , '../public' );
  var SSL = null;


  var server, testFuncs = {};

  var testRoutes = [
    new TestRoute( 200 , '/' , '/index.html' ),
    // new TestRoute( 403 , '/forbidden' , '/forbidden' ),
    // new TestRoute( 302 , '/sub' , '/sub/' ),
    /*new TestRoute( 200 , '/sub/' , '/sub/index.html' ),
    new TestRoute( 302 , '/sub/notfound' , '/sub/notfound/' ),
    new TestRoute( 404 , '/sub/notfound/' , '/sub/notfound/index.html' ),
    new TestRoute( 404 , '/sub/notfound/asdf2/' , '/sub/notfound/asdf2/index.html' ),
    new TestRoute( 404 , '/sub/notfound/asdf3/' , '/sub/notfound/asdf3/index.html' ),
    new TestRoute( 200 , '/script.min.js' , '/script.min.js.gz' , {
      'Content-Type': 'application/javascript'
    }),*/
    // new TestRoute( 200 , '/large-file/' , '/large-file' )
  ];
  
  describe( 'httpd-node' , function() {

    describe( '#get' , function() {
      
      it( 'should initialize' , function( done ) {

        server = new httpd({
          port: PORT,
          ssl: SSL
        })
        .env( 'profile' , 'dev' )
        .dir( 'default' , '/public' )
        .rewrite({
          pattern: /\.js$/i,
          /*replacement: function( match ) {
            return match.replace( /\.js$/i , '.js.gz' );
          }*/
          replacement: '{{match}}.gz'
        })
        .gzip({
          pattern: /^\/large-file(?=.txt)/,
          replacement: '{{match}}.gz'
        })
        .use(function( $req , $res ) {
          //httpd.log( data );
        })
        .$when( 'error' , function( e , err ) {
          util.print( '      ' );
          console.log( err.stack.yellow );
        })
        .$once( 'connect' , function( e ) {
          done();
        })
        .start();

      });

      it( 'should handle get requests that respond with a string body' , function( done ) {

        get( 'http://localhost:3000/forbidden' ).then(function() {
          done();
        })
        .catch(function( err ) {
          httpd.log( err );
          done();
        });
      });

      it( 'should handle get requests that respond with a readable stream' , function( done ) {

        get( 'http://localhost:3000' ).then(function() {
          done();
        })
        .catch(function( err ) {
          httpd.log( err );
          done();
        });
      });

      it( 'should handle large files' , function( done ) {

        get( 'http://localhost:3000/large-file.txt?gnarly=rad' ).then(function() {
          done();
        })
        .catch(function( err ) {
          httpd.log( err );
          done();
        });
      });

      it( 'should handle 302' , function( done ) {

        get( 'http://localhost:3000/sub' ).then(function() {
          done();
        })
        .catch(function( err ) {
          httpd.log( err );
          done();
        });
      });
    });

    return;

    describe( '#constructor' , function() {
      it( 'should create a new httpd instance' , function( done ) {
        server = new httpd({
          //verbose: false,
          port: PORT,
          ssl: SSL
        })
        .env( 'profile' , 'dev' )
        .use(function( req , res , data ) {
          httpd.log( data );
        })
        .$when( 'error' , function( e , err ) {
          util.print( '      ' );
          console.log( err.stack.yellow );
        });
        assert.instanceOf( server , httpd );
        done();
      });
    });

    describe( '#dir' , function() {
      it( 'should set the http dir for a subdomain' , function( done ) {
        server.dir( 'default' , '/public' );
        expect( server.httpRoot.default ).to.equal( '/public' );
        done();
      });
    });

    describe( '#use' , function() {
      it( 'should push to the _use array' , function( done ) {
        //var initLength = server._use.length;
        var initLength = server.handlers.use.length;
        server.use(function( req , res , data ) {
          testFuncs[req.url].apply( null , arguments );
        });
        //expect( server._use.length ).to.equal( initLength + 1 );
        expect( server.handlers.use.length ).to.equal( initLength + 1 );
        done();
      });
    });

    describe( '#rewrite' , function() {

      it( 'should push to the _rewriteRules array' , function( done ) {
        server.rewrite({
          pattern: /\.js$/i,
          preserve: true,
          /*handle: function( req , res , match ) {
            if (httpd.gzip( req , res )) {
              match = match.replace( /\.js$/i , '.js.gz' );
            }
            return match;
          }*/
          handle: function( match ) {
            return match.replace( /\.js$/i , '.js.gz' );
          }
        });
        expect( server._rewriteRules.default.length ).to.equal( 1 );
        done();
      });
    });

    describe( '#start' , function() {
      it( 'should start the httpd instance' , function( done ) {
        util.print( '      ' );
        server.start().$once( 'connect' , function( e ) {
          assert.ok( true );
          done();
        });
      });
    });

    describe( '#_handle' , function() {

      it( 'should handle http requests' , function( done ) {

        var promises = testRoutes.map(function( tr ) {
          testFuncs[tr.path || '/'] = function( req , res , data ) {
            recurse( data , tr.data );
          };
          return get( tr.path ).then(function( res ) {
            expect( res.body ).to.equal( tr.body );
          });
        });

        Promise.all( promises ).then(function() {
          done();
        })
        .catch( done );
      });
    });

    after(function() {
      server.stop();
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
            getter: function() {
              return mime.lookup( HTTP_ROOT + respath )
            }
          },
          {
            key: 'Content-Length',
            getter: function() {
              return stats.size;
            }
          },
          {
            key: 'Last-Modified',
            getter: function() {
              return new Date( stats.mtime ).toUTCString();
            }
          }
        ]);
      break;

      case 302:
        that.setHeaders( headers , [
          {
            key: 'Content-Type',
            getter: function() { return 'text/plain'; }
          },
          {
            key: 'Location',
            getter: function() { return respath; }
          },
        ]);
      break;

      case 404:
      case 500:
        that.setHeaders( headers , [
          {
            key: 'Content-Type',
            getter: function() { return 'text/plain'; }
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
        .on( 'end' , function() {
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

}());



















