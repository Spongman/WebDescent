/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype

var freeze;
if (navigator.appVersion.indexOf("Chrome/") >= 0)
	freeze = Object;
else
	freeze = Object.freeze;

/*
var _divDebug;
var _timerDebug;
var _strDebug = "";
console.log = function ()
{
	if (!_divDebug)
	{
		_divDebug = document.getElementById("divDebug");
	}
	var str = "";
	for (var i = 0; i < arguments.length; i++)
	{
		var value = arguments[i];
		if (value == null)
			value = "(null)";
		else if (value == undefined)
			value = "(undefined)";
		else
			value = value.toString();

		str += value + " ";
	}

	_strDebug += str + "\n";

	if (!_timerDebug)
	{
		_timerDebug = setTimeout(function () {
			_timerDebug = null;
			_divDebug.innerHTML += _strDebug;
			_strDebug = "";

		}, 100);
	}
};
*/


var Class = (function ()
{
	var fnTest = /xyz/.test((function () { var xyz; }).toString()) ? /\b_super\b/ : /.*/;

	// The base Class implementation (does nothing)
	var Class = function () { };

	// the fakeInit is constructor-less
	// it is used for constructing derived class prototypes
	Class.fakeInit = Class;

	// Create a new Class that inherits from this class
	Class.extend = function (prop)
	{
		var _super = this.prototype;

		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		var prototype = new this.fakeInit();

		// Copy the properties over onto the new prototype
		for (var name in prop)
		{
			// Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] === "function" && typeof _super[name] === "function" && fnTest.test(prop[name]) ?
	        (function (name, fn)
			{
        		return function ()
        		{
        			var tmp = this._super;

        			// Add a new ._super() method that is the same method
        			// but on the super-class
        			this._super = _super[name];

        			// The method only need to be bound temporarily, so we
        			// remove it when we're done executing
        			var ret = fn.apply(this, arguments);
        			this._super = tmp;

        			return ret;
        		};
			})(name, prop[name]) :
			prop[name];
		}

		// The dummy class constructor
		var fakeInit = function () { };

		// check for initializer method

		// Use the init method as our constructor, or use fakeInit as the constructor
		var Derived = prototype.init || fakeInit;

		// Populate our constructed prototype object
		Derived.prototype = prototype;

		// Enforce the constructor to be what we expect
		/*Derived.*/prototype.constructor = Derived;

		// And make this class extendable
		Derived.extend = arguments.callee;

		// Remember this so derived classes can construct
		// their prototypes without initialization
		Derived.fakeInit = fakeInit;

		return Derived;
	};

	return Class;

})();

var __unique = 0;

function Enum(values)
{
	return values;
}