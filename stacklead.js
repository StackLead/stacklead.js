StackLead = function(config) {
  var
    EMAIL_MATCH = new RegExp("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"),
    PHONE_MATCH = /^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/,
    BIND_INPUTS_INTERVAL = 100,
    FIELD_ATTR ='sl-field',
    CAPTURE_ENDPOINT = 'https://stacklead.com/api/client/leads';

  // Utility functions

  /**
   * Cross Browser version of XMLHTTPRequest();
   * @return {Object} - xmlHttp object
   */
  function getXmlHttpObject() {
    if(window.XMLHttpRequest) {
      return new XMLHttpRequest(); // IE7+, Firefox, Chrome, Opera, Safrai
    } else {
      return new ActiveXObject('Microsoft.XMLHTTP'); // IE5 & IE6
    }
  }

  function extractVal(element) {
    var postfieldvalue = null;
    switch (element.type) {
      case 'select-multiple':
        var selectedvalues = [];
        for(var i = 0; i < element.options.length; i++)
          if(element.options[i].selected)
            selectedvalues.push(element.options[i].value);
        postfieldvalue = selectedvalues.tostring();
        break;
      case 'radio':
        var radiobuttons = document.getElementsByName(element.name);
        for(var i = 0; i < radiobuttons.length; i++)
          if(radiobuttons[i].checked)
            postfieldvalue = radiobuttons[i].value;
        break;
      case 'checkbox':
        var checkboxes = document.getElementsByName(element.name);
        if(checkboxes.length > 1) {
          var values = [];
          for(var i = 0; i < checkboxes.length; i++)
            if(checkboxes[i].checked)
              values.push(checkboxes[i].value);

          postfieldvalue = values.tostring();
        } else {
          postfieldvalue = (element.checked ? true : false);
        }
        break;
      default:
        postfieldvalue = element.value;
    }

    return postfieldvalue;
  }

  // Public

  function StackLead(options) {
    if (!(this instanceof StackLead)) return new StackLead(options);
    if (!options || !options.client_key) {
      console.warn('StackLead client key not configured');
      return;
    }
    this.clientKey = options.client_key;
    this.automatic = typeof options.automatic === 'undefined' ? true : options.automatic;
    this.person = {};
    this.init();
  }

  StackLead.prototype.init = function init() {
    var self = this;
    // Wrap in anonymous function to ensure `this` is correct
    setInterval(function(){self._bindInputs();}, BIND_INPUTS_INTERVAL);
  };

  // API calls

  StackLead.prototype.capture = function capture(person, successCallback) {
    var self = this;
    if (typeof person === 'undefined') {
      person = self.person;
    } else if (typeof person === 'function') {
      successCallback = person;
      person = self.person;
    } else if (typeof(person) === 'string') {
      // Assume the string is an email
      person = {email: person};
    }
    if (!person.email) {
      // Email is required
      return;
    }
    var xmlhttp = getXmlHttpObject();
    xmlhttp.onreadystatechange = function() {
      if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
        if(typeof(successCallback) === 'function') {
          successCallback();
        }
      }
    };

    xmlhttp.open('POST', CAPTURE_ENDPOINT, true);
    xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xmlhttp.send('client_key=' + encodeURIComponent(this.clientKey) + '&person=' + encodeURIComponent(JSON.stringify(person)));

    // Clear person
    self.person = {};
  };

  // Private calls

  StackLead.prototype._bindInputs = function bindInputs() {
    var self = this;
    if (!this.automatic) {
      return;
    }

    // go through all input types and bind them to person

    // Attach to all inputs and listen for email and phone
    // var inputs = document.getElementsByTagName('input');
    var inputs = [];
    var nodeLists = [
      document.getElementsByTagName('input'),
      document.getElementsByTagName('select'),
      document.getElementsByTagName('textarea')
    ];
    nodeLists.forEach(function(n) {
      for (var i = 0; i < n.length; i++) {
        inputs.push(n[i]);
      }
    });

    var getTrackInputFn = function (original) {
      return function slTrackInputFn(event) {
        if (event instanceof KeyboardEvent && event.keyCode !== 13) return;
        var name = this.getAttribute(FIELD_ATTR) || this.name;
        var value = extractVal(this);
        if(EMAIL_MATCH.test(value)) {
          self.person.email = value;
        } else if (PHONE_MATCH.test(value)) {
          self.person.phone = value;
        } else {
          self.person[name] = value;
        }

        // For now, send to StackLead if we have an email
        if (self.person.email) {
          self.capture(function(err) {
            if (typeof original === 'function') {
              return original(event);
            }
          });
        }
      };
    };

    var setTrackInputFn = function (el, event, original) {
      if (typeof el[event] === 'function') {
        if (el[event].name !== 'slTrackInputFn') {
          // Preserve the original
          el[event] = getTrackInputFn(el[event]);
        }
      } else {
        // Note: Other code could clobber the track input function we set
        el[event] = getTrackInputFn();
      }
    };

    for (var i = 0; i < inputs.length; i++) {
      // Skip password inputs
      var el = inputs[i];
      if(el.type === 'password' || el.slBound) {
        continue;
      }

      var elementType = (el.getAttribute('type') || 'text').toLowerCase();

      // Note: this could could be made simpler by just doing addEventListener
      /* requires ie9 support
      if (elementType === 'radio' || elementType === 'checkbox') {
        this.addEventListener('change', slTrackInputFn, false);
      } else {
        this.addEventListener('blur', slTrackInputFn, false);
      }
      */

      if (elementType === 'radio' || elementType === 'checkbox') {
        setTrackInputFn(el, 'onchange');
      } else {
        setTrackInputFn(el, 'onblur');
        setTrackInputFn(el, 'onkeypress');
      }
      el.slBound = true;
    }
  };

  return new StackLead(config);

}(window.StackLeadConfig);
