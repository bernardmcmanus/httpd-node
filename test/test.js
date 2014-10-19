(function() {


    'use strict';


    var fs = require( 'fs-extra' );
    var path = require( 'path' );
    var util = require( 'util' );
    var mime = require( 'mime' );
    var Promise = require( 'wee-promise' );
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
        new TestRoute( 302 , '/sub' , '/sub/' ),
        new TestRoute( 200 , '/sub/' , '/sub/index.html' ),
        new TestRoute( 302 , '/sub/notfound' , '/sub/notfound/' ),
        new TestRoute( 404 , '/sub/notfound/' , '/sub/notfound/index.html' ),
        new TestRoute( 404 , '/sub/notfound/asdf2/' , '/sub/notfound/asdf2/index.html' ),
        new TestRoute( 404 , '/sub/notfound/asdf3/' , '/sub/notfound/asdf3/index.html' ),
        new TestRoute( 200 , '/hx.min.js' , '/hx.min.js.gz' , {
            'Content-Type': 'application/javascript'
        })
    ];
    
    describe( '#constructor' , function() {
        it( 'should create a new httpd instance' , function( done ) {
            server = new httpd({
                verbose: false,
                port: PORT,
                ssl: SSL
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
            server.use(function( req , res , data ) {
                testFuncs[req.url].apply( null , arguments );
            });
            expect( server._use.length ).to.equal( 1 );
            done();
        });
    });

    describe( '#rewrite' , function() {

        it( 'should push to the _rewriteRules array' , function( done ) {
            server.rewrite( /\.js$/i ,
                /*[
                    'Content-Type'
                ],*/
                function( req , res , match ) {
                    if (httpd.gzip( req , res )) {
                        match = match.replace( /\.js$/i , '.js.gz' );
                    }
                    return match;
                }
            );
            expect( server._rewriteRules.default.length ).to.equal( 1 );
            done();
        });
    });

    describe( '#start' , function() {
        it( 'should start the httpd instance' , function( done ) {
            util.print( '      ' );
            server.start();
            assert.ok( true );
            done();
        });
    });

    describe( '#_handle' , function() {

        it( 'should handle http requests' , function( done ) {

            var promises = testRoutes.map(function( tr ) {
                testFuncs[tr.path || '/'] = function( req , res , data ) {
                    trycatch( done , function() {
                        recurse( data , tr.data );
                    });
                };
                return get( tr.path ).then(function( res ) {
                    //trycatch( done , function() {
                        expect( res.body ).to.equal( tr.body );
                    //});
                });
            });

            Promise.all( promises ).then(function() {
                done();
            })
            .catch(function( err ) {
                done( err );
            });
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

    /*TestData.prototype = {
        setHeaders: function( headers , definitions ) {
            definitions.forEach(function( definition ) {
                var key = definition.key;
                if (!headers[key]) {
                    headers[key] = definition.getter();
                }
            });
            httpd.log(headers);
        }
    };*/

    function get( url ) {
        return new Promise(function( resolve , reject ) {
            (server.protocol === 'https' ? https : http)
            .get({
                host: 'localhost',
                port: PORT,
                path: url,
                agent: false
            }, function( res ) {

                var body = '';

                res.setEncoding( 'utf-8' );

                res.on( 'data' , function( chunk ) {
                    body += chunk;
                })
                .on( 'end' , function() {
                    var resp = Object.create( res );
                    resp.body = body;
                    resolve( resp );
                });
            })
            .on( 'error' , reject );
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

    function trycatch( done , func ) {
        try {
            func();
        }
        catch( err ) {
            done( err );
        }
    }

}());



















