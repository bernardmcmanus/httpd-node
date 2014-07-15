module.exports = (function() {


	var Codes = [];


	Codes[200] = function( response , content , data ) {
		response.writeHead( 200 , {
			'Content-Type': data.mime,
			'Content-Length': data.size,
			'Last-Modified': data.modified
		});
		response.end( content );
	};


	Codes[302] = function( response , location ) {
		response.writeHead( 302 , {
			'Location': location
		});
		response.end();
	};


	Codes[401] = function( response ) {
		response.writeHead( 401 , {
			'Content-Type': 'text/plain'
		});
		response.end( '401 Unauthorized\n' );
	};


	Codes[404] = function( response ) {
		response.writeHead( 404 , {
			'Content-Type': 'text/plain'
		});
		response.end( '404 Not Found\n' );
	};


	Codes[500] = function( response ) {
		response.writeHead( 500 , {
			'Content-Type': 'text/plain'
		});
		response.end( '500 Internal Server Error\n' );
	};

	
	return Codes;


}());



















