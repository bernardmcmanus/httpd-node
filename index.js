module.exports = (function() {


	var util = require( 'util' );
	var http = require( 'http' );
	var Url = require( 'url' );
	var fs = require( 'fs' );
	var mime = require( 'mime' );
	var Codes = require( './lib/codes' );
	var RequestPath = require( './lib/RequestPath' );


	var Environ = {
		dirname: __dirname
	};


	var Config = {
		protocol: 'http',
		port: 8888,
		httpRoot: {
			default: function( dirname ) {
				return dirname + '/www'
			},
			www: function( dirname ) {
				return dirname + '/www'
			}
		},
		index: 'index.html',
		verbose: true
	};


	function HTTPD() {

		var that = this;
		var options = (typeof arguments[0] === 'object' ? pop( arguments ) : {});
		var callback = (typeof arguments[0] === 'function' ? pop( arguments ) : function() {});

		function pop( subject ) {
			return Array.prototype.pop.call( subject );
		}

		var keys = Object.keys( Config );

		keys.forEach(function( key ) {
			that[key] = (options[key] !== undefined ? options[key] : Config[key]);
		});

		Codes.forEach(function( handler , code ) {
			that[code] = handler;
		});

		var toUse = [];

		Object.defineProperty( that , 'toUse' , {
			get: function() {
				return toUse;
			}
		});

		var validIndexes = {};

		Object.defineProperty( that , 'validIndexes' , {
			get: function() {
				return validIndexes;
			}
		});
	}


	HTTPD.Environ = function( key , value ) {
		Environ[key] = value;
	};


	HTTPD.prototype = {

		start: function() {
			
			var that = this;
			
			http.createServer(function() {
				that._handle.apply( that , arguments );
			}).listen( that.port );

			util.puts( 'server running at ' + that.protocol + '://localhost:' + ( that.port ) + '/' );
		},

		use: function( handler ) {
			this.toUse.push( handler );
		},

		getHttpRoot: function( subdomain ) {

			if (typeof this.httpRoot === 'string') {
				return Environ.dirname + this.httpRoot;
			}
			
			var getter = (this.httpRoot[subdomain] || this.httpRoot.default);

			return typeof getter === 'function' ? getter( Environ.dirname ) : __dirname;
		},

		_handle: function( request , response ) {

			var that = this;
			var subdomain = that._getSubdomain( request );
			var httpRoot = that.getHttpRoot( subdomain );
			var path = that._getPath( request.url , httpRoot );

			var data = {
				subdomain: subdomain,
				httpRoot: httpRoot,
				path: path.relative
			};

			that.toUse.forEach(function( handler ) {
				handler( request , response , data );
			});

			that._serve( path , function( code , args ) {

				if (that.verbose) {
					util.puts( code + ' -> ' + path.original );
				}

				args = ([ response ]).concat( args || [] );

				try {
					that[ code ].apply( null , args );
				}
				catch (err) {
					util.puts( err );
					that[ 500 ]( response );
				}
			});
		},

		_serve: function( path , callback ) {

			var that = this;

			if (pointsToDirectory( path.relative )) {
				path.append( '/' );
				return callback( 302 , [ path.relative ]);
			}

			if (pointsToIndex( path.relative )) {
				path.modify(
					that._getIndex( path )
				);
			}

			if (!fs.existsSync( path.absolute )) {
				return callback( 404 );
			}

			var stats = fs.statSync( path.absolute );

			if (stats.isDirectory()) {
				return callback( 401 );
			}

			fs.readFile( path.absolute , function ( err , content ) {

				if (err) {
					callback( 500 );
				}
				else {

					var data = {
						size: stats.size,
						mime: mime.lookup( path.absolute ),
						modified: new Date( stats.mtime ).toUTCString()
					};

					callback( 200 , [ content , data ]);
				}
			});
		},

		_getPath: function( url , httpRoot ) {
			var relative = Url.parse( url ).pathname;
			return new RequestPath( relative , httpRoot );
		},

		_getSubdomain: function( request ) {
			var arr = request.headers.host.split( '.' );
			return (arr.length < 2 ? '' : arr[0]);
		},

		_getIndex: function( path ) {

			var that = this;
			var relative = path.relative;
			var absolute = path.absolute;

			if (that.validIndexes[absolute]) {
				return relative + that.index;
			}
			
			if (that.index && fs.existsSync( absolute + that.index )) {
				that.validIndexes[absolute] = that.index;
				return relative + that.index;
			}

			return relative;
		}
	};


	function pointsToDirectory( path ) {
		return (/(\/$)|(\.[0-9a-z]+$)/i).test( path ) === false;
	}


	function pointsToIndex( path ) {
		return (/\/$/).test( path );
	}


	return HTTPD;


}());



















