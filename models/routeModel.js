/* jshint -W069 */

module.exports = (function() {


    var mime = require( 'mime' );
    
    
    function RouteModel( /*reqPath , code , data*/ ) {

        var args = arrayCast( arguments );
        var data = typeof last( args ) === 'object' ? args.pop() : {};
        var code = data.code || args.pop();
        var reqPath = args.pop() || {};
        
        var that = this;
        var statusCode = code;
        var headers = data.headers || {};
        var body = data.body || '';

        switch (statusCode) {

            case 200:
                headers['Content-Type'] = mime.lookup( reqPath.absolute );
            break;

            case 302:
                body = '302 Found\n';
                headers['Location'] = reqPath.full;
                headers['Content-Type'] = 'text/plain';
            break;

            case 404:
                body = '404 Not Found\n';
                headers['Content-Type'] = 'text/plain';
            break;

            case 500:
                body = '500 Internal Server Error\n';
                headers['Content-Type'] = 'text/plain';
            break;
        }

        that.statusCode = statusCode;
        that.headers = headers;
        that.body = body;
    }


    function isNumber( subject ) {
        return !isNaN( subject * 1 );
    }

    
    function last( array ) {
        return array[array.length - 1];
    }


    function arrayCast( subject ) {
        return Array.prototype.slice.call( subject , 0 );
    }


    return RouteModel;

    
}());



















