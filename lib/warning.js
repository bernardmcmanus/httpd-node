module.exports = (function() {

  function Warning( err ) {
    var that = this;
    that.message = err.message;
  }

  return Warning;

}());
