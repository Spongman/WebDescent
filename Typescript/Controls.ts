/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />
/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />
/// <reference path="Object.ts" />
"use strict";

enum KeyActions
{
	Forward,
	Backward,
	
	StrafeLeft,
	StrafeRight,
	
	StrafeUp,
	StrafeDown,
	
	PitchUp,
	PitchDown,
	
	TurnLeft,
	TurnRight,
	
	BankLeft,
	BankRight,
	
	FirePrimary,
	FireSecondary,
	FireFlare,
	
	Debug,
	
	
	TriUp,
	TriDown,
	
	StepNext,
	StepBack,
	
	stepUp,
	stepDown,
	
	wireframe,
	
	lockDebug,
	
	PrimaryLaser,
	PrimaryVulcan,
	PrimarySpreadFire,
	PrimaryPlasma,
	PrimaryFusion,

	SecondaryConcussion,
	SecondaryHoming,
	SecondaryProximity,
	SecondarySmart,
	SecondaryMega,
}

class KeyBinding
{
	pressed = false;

	constructor (public name: string, public keyCode: number, public debounce = false)
	{
	}
}
var MOUSE_SENSITIVITY = 2;

class KeysType
{
	bindings: KeyBinding[];
	mapBindings: { [index: string]: KeyBinding };
	thrust: Vec3;
	rot: Vec3;

	
	firePrimary: boolean;
	lockDebug: boolean;
	stepUp: boolean;
	stepDown: boolean;
	afterburner: boolean;
	wireframe: boolean;

	_mouseDeltaX:number = 0;
	_mouseDeltaY:number = 0;


	constructor ()
	{
		this.bindings =
		[
			new KeyBinding("forward", -1),
			new KeyBinding("backward", -3),

			new KeyBinding("strafe left", 83),
			new KeyBinding("strafe right", 68),

			new KeyBinding("strafe up", 32),
			new KeyBinding("strafe down", 18),

			new KeyBinding("pitch up", 0),
			new KeyBinding("pitch down", 0),

			new KeyBinding("turn left", 90),
			new KeyBinding("turn right", 88),

			new KeyBinding("bank left", 69),
			new KeyBinding("bank right", 87),

			new KeyBinding("fire primary", 65),
			new KeyBinding("fire secondary", 20),
			new KeyBinding("fire flare", 81),

			//new KeyBinding("afterburner", 16),

			new KeyBinding("debug", 66),


			new KeyBinding("tri up", 33, true),
			new KeyBinding("tri down", 34, true),

			new KeyBinding("step next", 39, true),
			new KeyBinding("step back", 37, true),

			new KeyBinding("step up", 38, true),
			new KeyBinding("step down", 40, true),

			new KeyBinding("wireframe", 9, true),

			new KeyBinding("lock debug", 16, true),

			new KeyBinding("(SUPER)LASER CANNON",       0x31, true),
			new KeyBinding("VULCAN/GAUSS CANNON",		0x32, true),
			new KeyBinding("SPREADFIRE/HELIX CANNON", 	0x33, true),
			new KeyBinding("PLASMA/PHOENIX CANNON",		0x34, true),
			new KeyBinding("FUSION/OMEGA CANNON",		0x35, true),
			new KeyBinding("CONCUSSION/FLASH MISSILE",	0x36, true),
			new KeyBinding("HOMING/GUIDED MISSILE",		0x37, true),
			new KeyBinding("PROXIMITY BOMB/SMART MINE",	0x38, true),
			new KeyBinding("SMART/MERCURY MISSILE",		0x39, true),
			new KeyBinding("MEGA/EARTHSHAKER MISSILE",	0x30, true),
		];

		this.mapBindings = {};
		for (var iBinding = this.bindings.length; iBinding--;)
		{
			var binding = this.bindings[iBinding];
			this.mapBindings[binding.keyCode.toString()] = binding;
			this.mapBindings[binding.name] = binding;
		}

		this.thrust = Vec3.Zero;
		this.rot = Vec3.Zero;
	}
	reset()
	{
		for (var iBinding = this.bindings.length; iBinding--;)
			this.bindings[iBinding].pressed = false;
	}
	keyDown(code:any)
	{
		var binding = this.mapBindings[code];
		if (binding)
		{
			if (!binding.pressed)
			{
				//console.log("DOWN: " + binding.name);
				binding.pressed = true;
			}
			return true;
		}
		else
		{
			console.log("DOWN: " + code);
			return false;
		}
	}
	keyUp(code:any)
	{
		var binding = this.mapBindings[code];
		if (binding)
		{
			if (binding.pressed)
			{
				//console.log("UP: " + binding.name);
				binding.pressed = false;
			}
		}
	}
	updateControls(frameTime:number)
	{
		var forwardThrust = 0;
		var sidewaysThrust = 0;
		var verticalThrust = 0;

		var pitchTime = 0;
		var headingTime = 0;
		var bankTime = 0;

		this.firePrimary = false;
		this.lockDebug = false;
		this.stepUp = false;
		this.stepDown = false;

		for (var iBinding = this.bindings.length; iBinding--;)
		{
			var binding = this.bindings[iBinding];
			if (!binding.pressed)
				continue;

			switch (binding.name)
			{
				case "strafe right":
					sidewaysThrust = frameTime;
					break;
				case "strafe left":
					sidewaysThrust = -frameTime;
					break;

				case "strafe up":
					verticalThrust = frameTime;
					break;
				case "strafe down":
					verticalThrust = -frameTime;
					break;

				case "forward":
					forwardThrust = frameTime;
					break;
				case "backward":
					forwardThrust = -frameTime;
					break;

				case "afterburner":
					this.afterburner = true;
					break;

				case "fire primary":
					this.firePrimary = true;
					break;

				case "pitch up":
					pitchTime = frameTime;
					break;
				case "pitch down":
					pitchTime = -frameTime;
					break;

				case "turn right":
					headingTime = frameTime;
					break;
				case "turn left":
					headingTime = -frameTime;
					break;

				case "bank right":
					bankTime = frameTime;
					break;
				case "bank left":
					bankTime = -frameTime;
					break;

				/*
				case "tri up":
					if (_iTriView < 5)
					{
						_iTriView++;
						_iStep = 0;
					}
					break;
				case "tri down":
					if (_iTriView > 0)
					{
						_iTriView--;
						_iStep = 0;
					}
					break;

				case "step next":
					_iStep++;
					break;
				case "step back":
					if (_iStep > 0)
						_iStep--;
					break;
				*/


				case "step up":
					this.stepUp = true;
					break;
				case "step down":
					this.stepDown = true;
					break;

				case "wireframe":
					this.wireframe = !this.wireframe;
					break;

				case "lock debug":
					this.lockDebug = true;
					break;
			}

			if (binding.debounce)
				binding.pressed = false;
		}

		headingTime += this._mouseDeltaX * frameTime * MOUSE_SENSITIVITY / 8;
		pitchTime -= this._mouseDeltaY * frameTime * MOUSE_SENSITIVITY / 8;

		if (headingTime > frameTime)
			headingTime = frameTime;
		else if (headingTime < -frameTime)
			headingTime = -frameTime;

		if (pitchTime > frameTime)
			pitchTime = frameTime;
		else if (pitchTime < -frameTime)
			pitchTime = -frameTime;

		this.thrust = new Vec3(sidewaysThrust, verticalThrust, forwardThrust);
		this.rot = new Vec3(pitchTime, headingTime, bankTime);

		this._mouseDeltaX = this._mouseDeltaY = 0;
	}
}
var Keys = new KeysType();
