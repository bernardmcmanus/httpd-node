module.exports = (function() {

  function Codes() {

    var that = this;

    that.default = {
      body: null,
      headers: {}
    };

    that[302] = {
      body: '302 Found\n',
      headers: {
        'Content-Type': 'text/plain'
      }
    };

    that[403] = {
      body: '403 Forbidden\n',
      headers: {
        'Content-Type': 'text/plain'
      }
    };

    that[404] = {
      body: '404 Not Found\n',
      headers: {
        'Content-Type': 'text/plain'
      }
    };

    that[500] = {
      body: '500 Internal Server Error\n',
      headers: {
        'Content-Type': 'text/plain'
      }
    };
  }

  Codes.prototype = {

    _getCode: function( code ) {
      var that = this;
      return that[code] || that.default;
    },

    headers: function( code ) {
      var that = this;
      return that._getCode( code ).headers;
    },

    body: function( code ) {
      var that = this;
      return that._getCode( code ).body;
    }
  };

  return new Codes();

}());



















