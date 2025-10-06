(function () {
  var orig = EventTarget.prototype.addEventListener;
  var PASSIVE = { touchstart: true, wheel: true }; // safe set to quiet Chrome

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    // Only adjust for events we care about
    if (PASSIVE[type]) {
      // Normalize options -> object
      var opts = (typeof options === 'boolean') ? { capture: options } : (options || {});
      // Respect explicit passive choice if caller provided it
      if (opts.passive === undefined) {
        // Exempt obvious drag/resizer targets and any touchmove (not in PASSIVE anyway)
        var id  = this && this.id;
        var cls = (this && typeof this.className === 'string') ? this.className : '';
        var exempt = (id === 'splitbar') || (id === 'side-nav') || /resiz|drag|handle/i.test(cls);
        if (!exempt) {
          opts.passive = true;
        }
      }
      try { return orig.call(this, type, listener, opts); } catch (_) {}
    }
    return orig.call(this, type, listener, options);
  };
})();