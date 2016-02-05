/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />
/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />
/// <reference path="Ham.ts" />
/// <reference path="Level.ts" />
/// <reference path="Player.ts" />
/// <reference path="Controls.ts" />
"use strict";

enum ObjectTypes
{
	WALL = 0,	// A CWall... not really an CObject, but used for collisions
	FIREBALL = 1,	// a fireball, part of an explosion
	ROBOT = 2,	// an evil enemy
	HOSTAGE = 3,	// a hostage you need to rescue
	PLAYER = 4,	// the player on the console
	WEAPON = 5,	// a laser, missile, etc
	CAMERA = 6,	// a camera to slew around with
	POWERUP = 7,	// a powerup you can pick up
	DEBRIS = 8,	// a piece of robot
	CNTRLCEN = 9,	// the control center
	FLARE = 10,  // a flare
	CLUTTER = 11,  // misc objects
	GHOST = 12,  // what the player turns into when dead
	LIGHT = 13,  // a light source, & not much else
	COOP = 14,  // a cooperative player CObject.
	MARKER = 15,  // a map marker
	NONE = 255, // unused CObject
}
// misc object flags
enum ObjectFlags
{
	EXPLODING = (1 << 0),   // this object is exploding
	SHOULD_BE_DEAD = (1 << 1),   // this object should be dead, so next time we can, we should delete this object.
	DESTROYED = (1 << 2),   // this has been killed, and is showing the dead version
	SILENT = (1 << 3),   // this makes no sound when it hits a wall.  Added by MK for weapons, if you extend it to other types, do it completely!
	ATTACHED = (1 << 4),  // this object is a fireball attached to another object
	HARMLESS = (1 << 5),  // this object does no damage.  Added to make quad lasers do 1.5 damage as normal lasers.
	PLAYER_DROPPED = (1 << 6),  // this object was dropped by the player...
}
// Control types - what tells this CObject what do do
enum ControlTypes
{
	NONE = 0,	  // doesn't move (or change movement)
	AI = 1,	  // driven by AI
	EXPLOSION = 2,	  // explosion sequencer
	FLYING = 4,	  // the player is flying
	SLEW = 5,	  // slewing
	FLYTHROUGH = 6,	  // the flythrough system
	WEAPON = 9,	  // laser, etc.
	REPAIRCEN = 10,  // under the control of the repair center
	MORPH = 11,  // this CObject is being morphed
	DEBRIS = 12,  // this is a piece of debris
	POWERUP = 13,  // animating powerup blob
	LIGHT = 14,  // doesn't actually do anything
	REMOTE = 15,  // controlled by another net player
	CNTRLCEN = 16,  // the control center/main reactor
	WAYPOINT = 17,
	CAMERA = 18,
}
enum MovementTypes
{
	NONE = 0,   // doesn't move
	PHYSICS = 1,   // moves by physics
	STATIC = 2,	// completely still and immoveable
	SPINNING = 3,   // this CObject doesn't move, just sits and spins
}
enum RenderTypes
{
	NONE = 0,	// does not render
	POLYOBJ = 1,	// a polygon model
	FIREBALL = 2,	// a fireball
	LASER = 3,	// a laser
	HOSTAGE = 4,	// a hostage
	POWERUP = 5,	// a powerup
	MORPH = 6,	// a robot being morphed
	WEAPON_VCLIP = 7,	// a weapon that renders as a tVideoClip
	THRUSTER = 8,	// like afterburner, but doesn't cast light
	EXPLBLAST = 9,	// white explosion light blast
	SHRAPNELS = 10,	// smoke trails coming from explosions
	SMOKE = 11,
	LIGHTNING = 12,
	SOUND = 13,
	SHOCKWAVE = 14,	// concentric shockwave effect
}
enum PowerupTypes
{
	EXTRA_LIFE = 0,
	ENERGY = 1,
	SHIELD_BOOST = 2,
	LASER = 3,

	KEY_BLUE = 4,
	KEY_RED = 5,
	KEY_GOLD = 6,

	MISSILE_1 = 10,
	MISSILE_4 = 11,      // 4-pack MUST follow single missile

	QUAD_FIRE = 12,

	VULCAN_WEAPON = 13,
	SPREADFIRE_WEAPON = 14,
	PLASMA_WEAPON = 15,
	FUSION_WEAPON = 16,
	PROXIMITY_WEAPON = 17,
	SMARTBOMB_WEAPON = 20,
	MEGA_WEAPON = 21,
	VULCAN_AMMO = 22,
	HOMING_AMMO_1 = 18,
	HOMING_AMMO_4 = 19,      // 4-pack MUST follow single missile
	CLOAK = 23,
	TURBO = 24,
	INVULNERABILITY = 25,
	MEGAWOW = 27,

	GAUSS_WEAPON = 28,
	HELIX_WEAPON = 29,
	PHOENIX_WEAPON = 30,
	OMEGA_WEAPON = 31,

	SUPER_LASER = 32,
	FULL_MAP = 33,
	CONVERTER = 34,
	AMMO_RACK = 35,
	AFTERBURNER = 36,
	HEADLIGHT = 37,

	SMISSILE1_1 = 38,
	SMISSILE1_4 = 39,      // 4-pack MUST follow single missile
	GUIDED_MISSILE_1 = 40,
	GUIDED_MISSILE_4 = 41,      // 4-pack MUST follow single missile
	SMART_MINE = 42,
	MERCURY_MISSILE_1 = 43,
	MERCURY_MISSILE_4 = 44,      // 4-pack MUST follow single missile
	EARTHSHAKER_MISSILE = 45,

	FLAG_BLUE = 46,
	FLAG_RED = 47,

	HOARD_ORB = 7,       // use unused slot

}
interface IMover
{
	velocity: Vec3;

	move(obj: object, time: number, frameTime: number): boolean;
}

class SpinnerInfo implements IMover
{
	spin: Vec3;
	spinMatrix: Mat3;
	velocity: Vec3 = Vec3.Zero;

	load(view: DataStream)
	{
		this.spin = view.getVector();
		this.spinMatrix = Mat3.fromEuler(this.spin);
		return this;
	}
	move(obj: object, time: number, frameTime: number): boolean
	{
		obj.orient = this.spinMatrix.scale(frameTime).multiply(obj.orient);
		return true;
	}
}
class PhysicsInfo implements IMover
{
	velocity: Vec3 = Vec3.Zero;
	thrust: Vec3 = Vec3.Zero;

	mass = 0;
	drag = 0;
	brakes = 0;

	rotvel: Vec3 = Vec3.Zero;
	rotthrust: Vec3 = Vec3.Zero;

	turnroll = 0;
	flags = 0;

	load(view: DataStream)
	{
		this.velocity = view.getVector();
		this.thrust = view.getVector();

		this.mass = view.getFixed();
		this.drag = view.getFixed();
		this.brakes = view.getFixed();

		this.rotvel = view.getVector();
		this.rotthrust = view.getVector();

		this.turnroll = view.getFixed2();
		this.flags = view.getUint16();

		return this;
	}
	move(obj: object, time: number, frameTime: number)
	{
		if (this.drag)
		{
			var tau = this.mass * 2.5 * this.drag;
			var dragScale = Math.exp(-frameTime / tau);

			// linear drag equation
			this.rotvel = this.rotvel.scale(dragScale);

			if (this.flags & PhysicsFlags.USES_THRUST)
				this.rotvel = this.rotvel.addScale(this.rotthrust, tau * (1 - dragScale) / frameTime);
		}

		var orient = obj.orient;

		if (this.turnroll)
		{
			var turnmat = Mat3.fromEuler(0, 0, -this.turnroll);
			orient = orient.multiply(turnmat);
		}

		var tangles = Mat3.fromEuler(this.rotvel.scale(frameTime));
		orient = tangles.multiply(orient);

		if (this.flags & PhysicsFlags.TURNROLL)
		{
			var desired_bank = -this.rotvel.y * TURNROLL_SCALE;

			if (this.turnroll !== desired_bank)
			{
				var max_roll = frameTime * ROLL_RATE;

				var delta_ang = desired_bank - this.turnroll;

				if (Math.abs(delta_ang) < max_roll)
					max_roll = delta_ang;
				else if (delta_ang < 0)
					max_roll = -max_roll;

				this.turnroll += max_roll;
			}
		}

		if (this.turnroll)
		{
			var turnmat = Mat3.fromEuler(0, 0, this.turnroll);
			orient = orient.multiply(turnmat);
		}

		obj.orient = orient;

		if (this.drag)
		{
			var tau = this.mass * this.drag;
			var dragScale = Math.exp(-frameTime / tau);

			// linear drag equation
			this.velocity = this.velocity.scale(dragScale);
			if (this.flags & PhysicsFlags.USES_THRUST)
				this.velocity = this.velocity.addScale(this.thrust, tau * (1 - dragScale) / frameTime);
		}

		var fKill = false;

		if (this.velocity.len2() > 1e-15)
		{
			var move = this.velocity.scale(frameTime);
			//var distance = move.len2();


			if (!obj.cube)
				throw new Error("NO CUBE");

			/*
			if (!obj.cube.isPointInside(posNew))
			{
				console.log("NOT INSIDE");
				//return;
			}
			*/
			var mapCollisionHandlers = object.mapCollisionHandlers[obj.type];

			var cBounces = 3;
			var type = obj.type;
			var bounce: Bounce, sideExit: Side;

			var cube = obj.cube;
			var pos = obj.pos;
			var posNew = pos.add(move);

			do
			{
				var line = new LineSegment(pos, posNew);

				//if (!(obj.type === ObjectTypes.PLAYER /*&& _cubeDebug*/))
				bounce = cube.bounce(line, obj.size + 0.01);

				var closestOther: object = null;
				var distanceToClosest = line.length; //Number.POSITIVE_INFINITY;

				if (mapCollisionHandlers)
				{
					var rgObjects = cube._rgObjects;
					for (var iOther = rgObjects.length; iOther--;)
					{
						var other: object = rgObjects[iOther];
						var otherType = other.type;
						if (otherType === type)
						{
							if (iOther >= obj.cubeIndex)
								continue;

							if (other === obj)
								continue;
						}

						var collisionHandler = mapCollisionHandlers[otherType];
						if (collisionHandler)
						{
							var distanceToOther = line.distanceToSphere(other.pos, other.size + obj.size);
							if (distanceToClosest > distanceToOther)
							{
								distanceToClosest = distanceToOther;
								closestOther = other;
							}
						}
					}
				}

				if (closestOther && (!bounce || distanceToClosest < bounce.distance))
				{
					var collisionPoint = new LineSegment(line.proceed(distanceToClosest), closestOther.pos).proceed(obj.size);

					//console.log(distanceToClosest);
					var objRemove = mapCollisionHandlers[closestOther.type].call(obj, time, collisionPoint, closestOther);
					if (objRemove)
					{
						if (objRemove === obj)
							fKill = true;
						else
							objRemove.link(null);
					}
				}
				else if (bounce)
				{
					var side = bounce.side;
					var wall = side.wall;

					if (!side.isSolid())
					{
						if (wall && wall.trigger)
							wall.trigger.trigger(obj, time, false);

						cube = side.neighbor;
						pos = bounce.anchor;
					}
					else
					{
						switch (type)
						{
							case ObjectTypes.WEAPON:

								var uv: Vec2 = null;

								var tmi1 = side.tmi1;
								if (side.neighbor && tmi1.isTransparent())
								{
									if (!uv)
										uv = bounce.getTextureCoords();
									var color = side.getPixel(uv.x, uv.y);
									if (color === 255)
									{
										cube = side.neighbor;
										pos = bounce.anchor;
										break;
									}
								}

								var wi = obj.weaponInfo;

								if (this.flags & PhysicsFlags.BOUNCE &&
									(!(this.flags & PhysicsFlags.BOUNCES_TWICE) || !(this.flags & PhysicsFlags.BOUNCED_ONCE)))
								{
									this.flags |= PhysicsFlags.BOUNCED_ONCE;
									var normalVelocity = this.velocity.projectOnTo(bounce.normal);
									this.velocity = this.velocity.addScale(normalVelocity, -2);

									obj.orient = Mat3.createLook(this.velocity, obj.orient._[1]);

									pos = bounce.anchor;
									posNew = bounce.reflectPoint(posNew);
								}
								else
								{
									fKill = true;
									posNew = bounce.anchor;

									cube.createExplosion(time, posNew.addScale(side.normal, .1), wi.impact_size, wi.wall_hit_vclip);

									if (!wall && wi.wall_hit_sound >= 0)
										_ham.playSound(wi.wall_hit_sound, posNew);
								}

								var tmi2 = side.tmi2;
								if (tmi2)
								{
									var ec = tmi2.eclip_num;

									var fBlow = false;
									var effect: EClip = (ec >= 0) ? _ham.rgEClips[ec] : null;
									if (effect)
										fBlow = (effect.dest_bm_num >= 0 && !(effect.eflags & EClipFlags.ONE_SHOT));
									else
										fBlow = (tmi2.destroyed !== -1);

									if (fBlow)
									{
										if (!uv)
											uv = bounce.getTextureCoords();

										var color = side.getPixel2(uv.x, uv.y);
										if (color !== 255)
										{
											side.setDeltaLight(0);

											if (effect)
											{
												if (effect.sound_num >= 0)
													_ham.playSound(effect.sound_num, posNew);

												cube.createExplosion(time, posNew.addScale(side.normal, .1), effect.dest_size, effect.dest_vclip);

												if (effect.dest_eclip >= 0)
												{
													var new_ec = _ham.rgEClips[effect.dest_eclip];
													new_ec.time_left = new_ec.frame_time;
													new_ec.frame_count = 0;
													new_ec.segnum = cube.index;
													new_ec.sidenum = side.index;
													new_ec.eflags |= EClipFlags.ONE_SHOT;
													new_ec.dest_bm_num = effect.dest_bm_num;

													side.setTex2(new_ec.changing_wall_texture);		//replace with destoyed
												}
												else
												{
													side.setTex2(effect.dest_bm_num);
												}
											}
											else
											{
												cube.createExplosion(time, posNew.addScale(side.normal, .1), 20, 3);
												side.setTex2(tmi2.destroyed);
												_ham.playSound(SoundFile_Sounds.LIGHT_BLOWNUP, posNew);
											}

											if (wall && wall.trigger)
												wall.trigger.trigger(obj.parent, time, true);
										}
									}
								}

								if (wall)
								{
									switch (wall.type)
									{
										case WallTypes.BLASTABLE:
											wall.damage(time, obj.shields);
											if (wi.wall_hit_sound >= 0)
												_ham.playSound(SoundFile_Sounds.WEAPON_HIT_BLASTABLE, posNew);
											break;
										case WallTypes.DOOR:
											if (obj.parent && obj.parent.type === ObjectTypes.PLAYER)
											{
												if (_player.hasKeys(wall.keys) && !(wall.flags & WallFlags.DOOR_LOCKED))
												{
													if (wall.state !== DoorStates.OPENING)
														wall.openDoor();
												}
												else
												{
													_ham.playSound(SoundFile_Sounds.WEAPON_HIT_DOOR, posNew);
												}
											}
											break;
										default:
											if (wi.wall_hit_sound >= 0)
												_ham.playSound(wi.wall_hit_sound, posNew);
											break;
									}
								}
								break;



							default:
								var normalVelocity = this.velocity.projectOnTo(bounce.normal);
								this.velocity = this.velocity.sub(normalVelocity);
								pos = bounce.anchor;
								posNew = bounce.reflectPoint(posNew);
								break;
						}
					}
				}
			}
			while (cBounces-- > 0 && (bounce || sideExit));

			if (!cube.isPointInside(posNew))
			{
				cube.isPointInside(posNew);
				cube.bounce(new LineSegment(pos, posNew), 0);
				// find closest point
				var lineFix = new LineSegment(cube.center, posNew);
				var bounceFix = cube.bounce(lineFix, obj.size);
				if (bounceFix)
					posNew = bounceFix.anchor;
				else
					posNew = null;	// last resort, don't move
			}

			if (posNew)
			{
				obj.pos = posNew;
				obj.link(cube);
			}
		}
		return !fKill;	// stay alive
	}
}
enum PhysicsFlags
{
	TURNROLL = (1 << 0),	// roll when turning
	LEVELLING = (1 << 1),	// level object with closest side
	BOUNCE = (1 << 2),	// bounce (not slide) when hit will
	WIGGLE = (1 << 3),	// wiggle while flying
	STICK = (1 << 4),	// object sticks (stops moving) when hits wall
	PERSISTENT = (1 << 5),	// object keeps going even after it hits another object (eg, fusion cannon)
	USES_THRUST = (1 << 6),	// this object uses its thrust
	BOUNCED_ONCE = (1 << 7),	// Weapon has bounced once.
	FREE_SPINNING = (1 << 8),	// Drag does not apply to rotation of this object
	BOUNCES_TWICE = (1 << 9),	// This weapon bounces twice, then dies
}
interface IObjectRenderer
{
	render(obj: object, time: number): void;
}
class PolygonRenderInfo implements IObjectRenderer
{
	rgAnimAngles: Vec3[];
	subobj_flags = 0;
	alt_textures = 0;
	tmap_override = 0;

	constructor(public model_num?: number)
	{
	}

	load(view: DataStream)
	{
		this.model_num = view.getUint32();
		this.rgAnimAngles = view.getVector2Array(MAX_SUBMODELS);
		this.subobj_flags = view.getUint32();
		this.tmap_override = view.getInt32();

		return this;
	}
	render(obj: object, time: number)
	{
		var pos = obj.pos;
		var orient = obj.orient;

		var lightValue = obj.cube.static_light;
		var light = new Vec3(lightValue, lightValue, lightValue);

		var model = _ham.rgPolygonModels[this.model_num];

		pushOrientMatrix(orient, pos);

		var flags = this.subobj_flags;
		if (flags)
		{
			for (var i = 0; flags; flags >>= 1, ++i)
			{
				if (flags & 1)
				{
					var ofs = model.submodel_mins[i].add(model.submodel_maxs[i]).scale(.5);
					// push matrix

					model.render(light, this.rgAnimAngles);

					// pop matrix
				}
			}
		}
		else
		{
			model.render(light, this.rgAnimAngles);
		}

		popMatrix();
	}
}
class VClipRenderInfo implements IObjectRenderer
{
	vclip: VClip;
	vclip_num: number;

	render(obj: object, time: number) { }

	renderFrame(obj: object, iBitmap: number)
	{
		var vclip = this.getVClip();

		var program: WebGLProgram;
		if (vclip.flags & VClipFlags.ROD)
			program = programBillboardX;
		else
			program = programBillboard;

		useProgram(program);

		var tex = _pig.loadBitmap(iBitmap, 1);
		if (!tex)
			return;
		bindTexture(1, tex.tex);

		var bmp = tex.bmp;
		gl.uniform3f(program['pos'], obj.pos.x, obj.pos.y, obj.pos.z);
		gl.uniform2f(program['sizeTexture'], bmp.width, bmp.height);
		gl.uniform1f(program['scale'], obj.size / Math.max(bmp.width, bmp.height));

		loadAttribBuffer(program['aVertexPosition'], program['bufferVertexPosition']);

		gl.drawArrays(gl.TRIANGLE_FAN, 0, program['bufferVertexPosition'].numItems);
	}
	getVClip()
	{
		var vclip = this.vclip;
		if (!vclip)
			this.vclip = vclip = _ham.rgVClips[this.vclip_num];
		return vclip;
	}
}
class OneShotVClipRenderInfo extends VClipRenderInfo
{
	vclip_num: number;

	constructor(vclip_num: number)
	{
		super();
		this.vclip_num = vclip_num;
	}
	render(obj: object, time: number)
	{
		var vclip = this.getVClip();

		// odd objects go backwards?
		var iFrame = Math.floor(vclip.num_frames * (time - obj.creationTime) / (vclip.play_time));
		if (iFrame >= vclip.num_frames)
			iFrame = vclip.num_frames - 1;

		var iBitmap = vclip.frames[iFrame];

		this.renderFrame(obj, iBitmap);
	}
}
class LoopingVClipRenderInfo extends VClipRenderInfo
{
	frametime: number;
	framenum: number;

	load(view: DataStream)
	{
		this.vclip_num = view.getUint32();
		this.frametime = view.getFixed();
		this.framenum = view.getUint8();

		return this;
	}
	render(obj: object, time: number)
	{
		var vclip = this.getVClip();

		var num = Number(obj._unique);
		// odd objects go backwards?
		var iFrame = Math.floor((time / this.frametime) + this.framenum + num) % vclip.num_frames;
		var iBitmap = (num & 1) ? vclip.frames[iFrame] : vclip.frames[vclip.num_frames - 1 - iFrame];

		this.renderFrame(obj, iBitmap);
	}
}
var MAX_AI_FLAGS = 11;          // This MUST cause word (4 bytes) alignment in ai_static, allowing for one byte mode

var TURNROLL_SCALE = fix(0x4ec4 / 2);
var ROLL_RATE = fix(0x2000);
var HEADLIGHT_SCALE = 10;

class object
{
	_unique: string;

	info: any;
	parent: object;

	mapCollisionHandlers: Object;

	controlType: ControlTypes;
	movementType: MovementTypes;
	renderType: RenderTypes;
	flags: ObjectFlags;

	iCube: number;
	attachedObj: number;

	cube: Cube;
	cubeIndex: number;
	pos: Vec3;
	orient: Mat3;

	get direction() { return this.orient._[2]; }

	size: number;
	shields: number;

	lastPos: Vec3;

	containsType: number;
	containsId: number;
	containsCount: number;
	mover: IMover;
	control: any;
	renderInfo: IObjectRenderer;
	weaponInfo: WeaponInfo;
	multiplier: number;

	creationTime: number;
	deathTime: number;

	controls: KeysType;

	constructor(public type: ObjectTypes, public id: number)
	{
		this._unique = (__unique++).toString();

		//console.log("type: " + type);

		if (type < 0 || type > 15)
			throw new Error("unknown ObjectType: " + type);

		this.mapCollisionHandlers = object.mapCollisionHandlers[type];

		switch (type)
		{
			case ObjectTypes.ROBOT:
				this.info = _ham.rgRobotTypes[id];
				break;

			case ObjectTypes.FIREBALL:
				this.info = _ham.rgVClips[id];
				break;

			case ObjectTypes.POWERUP:
				this.info = _ham.rgPowerupInfos[id];
				break;

			case ObjectTypes.WEAPON:
				this.info = _ham.rgWeaponInfos[id];
				break;

			default:
				return;
		}

		//if (!this.info)
		//	throw new Error ("object info not found");
	}
	load(view: DataStream)
	{
		this.controlType = view.getUint8();
		this.movementType = view.getUint8();
		this.renderType = view.getUint8();
		this.flags = view.getUint8();

		this.iCube = view.getUint16();
		this.attachedObj = -1;

		this.pos = view.getVector();
		this.orient = view.getMatrix();

		this.size = view.getFixed();
		this.shields = view.getFixed();

		this.lastPos = view.getVector();

		this.containsType = view.getUint8();
		this.containsId = view.getUint8();
		this.containsCount = view.getUint8();

		switch (this.movementType)
		{
			case MovementTypes.PHYSICS:
				this.mover = new PhysicsInfo().load(view);
				break;

			case MovementTypes.SPINNING:
				this.mover = new SpinnerInfo().load(view);
				break;

			case MovementTypes.NONE:
				break;

			default:
				throw new Error("unknown MovementType: " + this.movementType);
		}

		switch (this.controlType)
		{
			case ControlTypes.NONE:		// 0,	  // doesn't move (or change movement)
			case ControlTypes.FLYING:	// 4,	  // the player is flying
			case ControlTypes.SLEW:		// 5,	  // slewing
			case ControlTypes.DEBRIS:	// 12,	  // this is a piece of debris
			case ControlTypes.CNTRLCEN:	// 16,	  // the control center/main reactor
				break;

			case ControlTypes.AI:		// 1,	  // driven by AI

				this.control = {
					behavior: view.getUint8(),
					flags: view.getUint8Array(MAX_AI_FLAGS),
					hide_segment: view.getUint16(),
					hide_index: view.getUint16(),
					path_length: view.getUint16(),
					cur_path_index: view.getUint16(),
				}
				if (view['gameVersion'] <= 25)
				{
					view.getUint16();	// follow_path_start_seg
					view.getUint16();	// follow_path_end_seg
				}
				break;

			case ControlTypes.POWERUP:	// 13,	  // animating powerup blob

				var count = 1;
				if (view['gameVersion'] >= 25)
					count = view.getUint32();

				switch (this.id)
				{
					case PowerupTypes.VULCAN_WEAPON:
					case PowerupTypes.GAUSS_WEAPON:
						count = VULCAN_WEAPON_AMMO_AMOUNT;
						break;
					//case PowerupTypes.OMEGA_WEAPON:
					//	count = 1;
					//	break;
				}

				this.control = { count: count };
				break;

			case ControlTypes.WEAPON:
				this.control =
				{
					parent_type: view.getInt16(),
					parent_num: view.getInt16(),
					parent_signature: view.getUint32(),
				}
				break;

			//case ControlTypes.WEAPON:		// 9,	  // laser, etc.
			//case ControlTypes.EXPLOSION:	// 2,	  // explosion sequencer
			//case ControlTypes.FLYTHROUGH:	// 6,	  // the flythrough system
			//case ControlTypes.REPAIRCEN:	// 10,	  // under the control of the repair center
			//case ControlTypes.MORPH:		// 11,	  // this CObject is being morphed
			//case ControlTypes.LIGHT:		// 14,	  // doesn't actually do anything
			//case ControlTypes.REMOTE:		// 15,	  // controlled by another net player
			//case ControlTypes.WAYPOINT:	// 17,
			//case ControlTypes.CAMERA:		// 18,

			default:
				throw new Error("unknown ControlType: " + this.controlType);
		}

		switch (this.renderType)
		{
			default:
				throw new Error("unknown RenderType: " + this.renderType);

			case RenderTypes.NONE:			//0,	// does not render
			case RenderTypes.LASER:			//3,	// a laser
				break;

			case RenderTypes.POLYOBJ:		//1,	// a polygon model
			case RenderTypes.MORPH:			//6,	// a robot being morphed
				this.renderInfo = new PolygonRenderInfo().load(view);
				break;

			case RenderTypes.HOSTAGE:		//4,	// a hostage
			case RenderTypes.POWERUP:		//5,	// a powerup
			case RenderTypes.WEAPON_VCLIP:	//7,	// a weapon that renders as a tVideoClip
				//case RenderTypes.FIREBALL:		//2,	// a fireball
				this.renderInfo = new LoopingVClipRenderInfo().load(view);
				break;


			//case RenderTypes.THRUSTER:	//8,	// like afterburner, but doesn't cast light
			//case RenderTypes.EXPLBLAST:	//9,	// white explosion light blast
			//case RenderTypes.SHRAPNELS:	//10,	// smoke trails coming from explosions
			//case RenderTypes.SMOKE:		//11,
			//case RenderTypes.LIGHTNING:	//12,
			//case RenderTypes.SOUND:		//13,
			//case RenderTypes.SHOCKWAVE:	//14,	// concentric shockwave effect
		}

		return this;
	}
	isValid()
	{
		if (this.type === ObjectTypes.NONE)
			return false;

		if (this.flags & ObjectFlags.SHOULD_BE_DEAD)
			return false;

		return true;
	}
	link(cube: Cube)
	{
		var cubeOld = this.cube;
		if (cubeOld === cube)
			return;

		if (cubeOld)
		{
			var index = this.cubeIndex;
			var objectOther = cubeOld._rgObjects.pop();
			if (objectOther.cubeIndex !== cubeOld._rgObjects.length)
				throw new Error("wrong cube");
			if (this !== objectOther)
			{
				cubeOld._rgObjects[index] = objectOther;
				objectOther.cubeIndex = index;
			}
		}

		this.cube = cube;

		if (cube)
		{
			this.iCube = cube.index;
			this.cubeIndex = cube._rgObjects.length;
			cube._rgObjects.push(this);
		}
		else
		{
			this.iCube = -1;
			this.cubeIndex = -1;
		}
	}
	getEmittedLight(time: number): Vec3
	{
		var intensity = 0;
		switch (this.type)
		{
			case ObjectTypes.PLAYER:
				if (_player.flags & PlayerFlags.HEADLIGHT_ON)
					intensity = HEADLIGHT_SCALE;
				else
				{
					var pi = <PhysicsInfo> this.mover;
					var k = pi.mass * pi.drag / (1 - pi.drag);
					intensity = Math.max(pi.velocity.len() * k / 4, 2) + 0.5;
				}
				break;

			case ObjectTypes.FIREBALL:
				if (this.id < 0)
					return;

				var vclip: VClip = this.info;
				intensity = vclip.light_value;

				var timeleft = this.deathTime - time;
				if (timeleft < 4)
					intensity *= timeleft / vclip.play_time;
				break;

			case ObjectTypes.ROBOT:
				var rt: RobotType = this.info;
				intensity = rt.lightcast;
				break;

			case ObjectTypes.WEAPON:
				var wi: WeaponInfo = this.info;
				intensity = wi.light;
				//if (this.id == WeaponTypes.FLARE)// TODO: flicker flares
				break;

			case ObjectTypes.POWERUP:
				var powerupInfo: PowerupInfo = this.info;
				intensity = powerupInfo.light;
				break;

			case ObjectTypes.MARKER:
			case ObjectTypes.DEBRIS:
			case ObjectTypes.LIGHT:
				break;

			//default:
			//	throw new Error("unhandled type: " + this.type);
		}

		if (intensity <= 0)
			return null;

		if (intensity > 1)
			intensity = 1;

		return Vec3.One.scale(intensity);
	}
	update(time: number, frameTime: number)
	{
		if (this.flags & ObjectFlags.SHOULD_BE_DEAD)
			return false;

		switch (this.controlType)
		{
			case ControlTypes.FLYING:

				var ship = _ham.ship;

				var pi = <PhysicsInfo>this.mover;
				if (this.controls)
				{
					pi.thrust = this.orient.multiply(this.controls.thrust).scale(ship.max_thrust / frameTime);
					pi.rotthrust = this.controls.rot.scale(ship.max_rotthrust / frameTime);
				}

				if (pi.flags & PhysicsFlags.WIGGLE)
				{
					var wiggle = Math.sin(time * Math.PI * 2) * ship.wiggle;
					pi.velocity = pi.velocity.addScale(this.orient._[1], wiggle);
				}

				break;

			case ControlTypes.POWERUP:
				break;

			case ControlTypes.AI:
				this.doAI(time, frameTime);
				break;

			case ControlTypes.EXPLOSION:
				this.doExplosion(time, frameTime);
				break;
		}

		if (time >= this.deathTime || (this.flags & ObjectFlags.SHOULD_BE_DEAD))
		{
			switch (this.controlType)
			{
				case ControlTypes.POWERUP:
					// create explosion
					break;
			}

			return false;
		}

		if (this.mover)
			return this.mover.move(this, time, frameTime);

		return true;
	}
	doAI(time: number, frameTime: number)
	{

	}
	render(time: number)
	{
		if (this.type === ObjectTypes.PLAYER)
			return;

		if (this.renderInfo)
			this.renderInfo.render(this, time);
	}
	fireLaser(iWeapon: number, laser_level: number, cFires: number, fQuad: boolean)
	{
		switch (iWeapon)
		{
			case PrimaryWeaponIndex.LASER:

				// Laser_offset?

				var weaponNum: number;
				if (laser_level <= MAX_LASER_LEVEL)
					weaponNum = WeaponTypes.LASER + laser_level;
				else
					weaponNum = WeaponTypes.SUPER_LASER + laser_level - (MAX_LASER_LEVEL + 1);

				this.fireWeapon(weaponNum, 0, 0, 0, 0, true);
				this.fireWeapon(weaponNum, 1);

				if (fQuad)
				{
					this.fireWeapon(weaponNum, 2);
					this.fireWeapon(weaponNum, 3);
				}

				break;
		}
	}
	fireWeapon(laser_type: number, gun_num: number, spreadr?: number, spreadu?: number, delay?: number, make_sound = false, harmless: boolean = false)
	{
		var wi = _ham.rgWeaponInfos[laser_type];

		var ship = _ham.ship;
		var pos = this.orient.transpose().rotate(ship.gun_points[gun_num]).add(this.pos);
		var dir = this.direction;

		//if (delay)
		//	pos = pos.sub(dir.scale(delay * wi.speed[_difficultyLevel]));

		if (spreadr)
			dir = dir.addScale(this.orient._[0], spreadr);

		if (spreadu)
			dir = dir.addScale(this.orient._[0], spreadu);

		var obj = wi.createObject(this, pos, this.cube, dir);
		obj.multiplier = 1;

		if (this.type === ObjectTypes.PLAYER)
		{
			if (laser_type >= WeaponTypes.LASER && laser_type <= MAX_SUPER_LASER_LEVEL)
				obj.multiplier = 3 / 4;
		}

		_level.rgObjects.push(obj);

		if (make_sound && wi.flash_sound >= 0)
		{
			if (this.type === ObjectTypes.PLAYER)
				this.playSound(wi.flash_sound);
			else
				_ham.playSound(wi.flash_sound, pos);
		}
	}
	createFireball(time: number, delay: number)
	{
		var obj = this.cube.createExplosion(time, this.pos, 0, -1, delay);
		obj.control = {
			delete_obj: this,
			spawn: true,
		}
		return obj;
	}
	doExplosion(time: number, frameTime: number)
	{
		var control = this.control;
		if (control)
		{
			if (time >= this.deathTime)
			{
				var del_obj: object = control.delete_obj;
				if (control.spawn)
				{
					var vclip = del_obj.getExplosionVClip(1);
					var expl_obj = del_obj.cube.createExplosion(time, del_obj.pos, del_obj.size * (5 / 2), vclip);

					if (expl_obj && !(expl_obj.flags & ObjectFlags.SHOULD_BE_DEAD))
					{
						expl_obj.control = {
							delete_time: (time + control.death_time) / 2,
							delete_obj: del_obj,
						}
					}
					else
					{
						del_obj.flags |= ObjectFlags.SHOULD_BE_DEAD;
					}

					// TODO: drop stuff

					var rt: RobotType = del_obj.info;
					if (rt.exp2_sound_num >= 0)
						_ham.playSound(rt.exp2_sound_num, del_obj.pos);

					// TODO: debris
				}

				if (control.delete_obj)
				{
					del_obj.flags |= ObjectFlags.SHOULD_BE_DEAD;
				}
			}
		}
	}
	getExplosionVClip(stage: number): number
	{
		switch (this.type)
		{
			case ObjectTypes.PLAYER:
				var rt: RobotType = this.info;
				if (stage == 0 && rt.exp1_vclip_num >= 0)
					return rt.exp1_vclip_num;
				if (stage == 1 && rt.exp2_vclip_num >= 0)
					return rt.exp2_vclip_num;
				break;
			case ObjectTypes.ROBOT:
				if (_ham.ship.expl_vclip_num >= 0)
					return _ham.ship.expl_vclip_num;
				break;
		}

		return KnownVClips.SMALL_EXPLOSION;
	}
	playSound(iSound: SoundFile_Sounds)
	{
		_ham.playObjectSound(iSound, this);
	}
	/*
	collide(other: object)
	{
		var mapCollisionHandlers = this.mapCollisionHandlers;
		if (!mapCollisionHandlers)
			return;

		var otherType = other.type;
		var collisionHandler = mapCollisionHandlers[<any>otherType];
		if (!collisionHandler)
			return;

		return collisionHandler(other);
	}
	*/

	collidePlayerHostage(time: number, pos: Vec3, other: object)
	{
		// TODO: flags
		// TODO: increment hostage count

		_ham.playSound(SoundFile_Sounds.HOSTAGE_RESCUED);
		return other;
	}
	collidePlayerMarker(time: number, pos: Vec3, other: object) { }
	collidePlayerClutter(time: number, pos: Vec3, other: object) { }
	collidePlayerControlCenter(time: number, pos: Vec3, other: object) { }
	collidePlayerPlayer(time: number, pos: Vec3, other: object) { }
	collidePlayerPowerup(time: number, pos: Vec3, other: object)
	{
		if (_player.pickUpPowerup(other.id))
		{
			var pi: PowerupInfo = other.info;
			if (pi && pi.hit_sound)
				_ham.playSound(pi.hit_sound);

			return other;
		}
	}
	collidePlayerWeapon(time: number, pos: Vec3, other: object) { }
	collidePlayerRobot(time: number, pos: Vec3, other: object)
	{
		var pi = <PhysicsInfo>this.mover;
		var piOther = <PhysicsInfo>other.mover;

		var vel = pi.velocity;
		var velOther = piOther.velocity;


		var mass = pi.mass;
		var massOther = piOther.mass;

		var force = vel.addScale(velOther, -2 * mass * massOther / (mass + massOther));

		piOther.velocity = velOther.addScale(force, 1 / piOther.mass);

		pi.velocity = vel.addScale(force, -1 / pi.mass);
	}
	collideRobotControlCenter(time: number, pos: Vec3, other: object) { }
	collideRobotRobot(time: number, pos: Vec3, other: object) { }
	collideRobotWeapon(time: number, pos: Vec3, weapon: object)
	{
		var rt: RobotType = this.info;
		if (rt.exp1_vclip_num >= 0)
			weapon.cube.createExplosion(time, pos, this.size * 3 / 8, rt.exp1_vclip_num);

		if (rt.exp1_sound_num >= 0)
			_ham.playSound(rt.exp1_sound_num, pos);

		if (!(weapon.flags & ObjectFlags.HARMLESS))
		{
			var damage = weapon.shields * weapon.multiplier;
			this.damage(time, damage);
		}

		return weapon;
	}
	damage(time: number, damage: number): boolean
	{
		if (this.flags & ObjectFlags.EXPLODING || this.shields < 0)
			return false;

		this.shields -= damage;

		if (this.shields < 0)
		{
			if (this.type == ObjectTypes.PLAYER)
			{
			}
			else
			{
				var rt: RobotType = this.info;
				var delay = (rt.kamikaze) ? .01 : .25;
				this.createFireball(time, delay);
			}
		}

		return false;
	}
	collideWeaponClutter(time: number, pos: Vec3, other: object) { }
	collideWeaponControlCenter(time: number, pos: Vec3, other: object) { }
	collideWeaponDebris(time: number, pos: Vec3, other: object) { }
	collideWeaponWeapon(time: number, pos: Vec3, other: object) { }

	isDead(): boolean
	{
		return false;
	}


	static load(view: DataStream)
	{
		var type = view.getUint8();
		var id = view.getInt8();

		switch (type)
		{
			case ObjectTypes.PLAYER: //4,		// the player on the console
			case ObjectTypes.POWERUP: //7,		// a powerup you can pick up
			case ObjectTypes.ROBOT: //2,		// an evil enemy
			case ObjectTypes.COOP: //14,	// a cooperative player CObject.
			case ObjectTypes.CNTRLCEN: //9,		// the control center
			case ObjectTypes.HOSTAGE: //3,		// a hostage you need to rescue
			case ObjectTypes.WEAPON: //5,		// a laser, missile, etc
				return new object(type, id).load(view);

			//case ObjectTypes.WALL			: //0,		// A CWall... not really an CObject, but used for collisions
			//case ObjectTypes.FIREBALL		: //1,		// a fireball, part of an explosion
			//case ObjectTypes.CAMERA		: //6,		// a camera to slew around with
			//case ObjectTypes.DEBRIS		: //8,		// a piece of robot
			//case ObjectTypes.FLARE		: //10,	// a flare
			//case ObjectTypes.CLUTTER		: //11,	// misc objects
			//case ObjectTypes.GHOST		: //12,	// what the player turns into when dead
			//case ObjectTypes.LIGHT		: //13,	// a light source, & not much else
			//case ObjectTypes.MARKER		: //15,	// a map marker
			//case ObjectTypes.CAMBOT		: //16,	// a camera
			//case ObjectTypes.MONSTERBALL	: //17,	// a monsterball
			//case ObjectTypes.SMOKE		: //18,	// static smoke
			//case ObjectTypes.EXPLOSION	: //19,	// static explosion particleEmitters
			//case ObjectTypes.EFFECT		: //20,	// lightnings


			default:
				throw new Error("unknown object type: " + type);
		}
	}

	static mapCollisionHandlers: { [index: number]: any } = {};

}
(function ()
{
	object.mapCollisionHandlers[ObjectTypes.HOSTAGE] = {};
	object.mapCollisionHandlers[ObjectTypes.MARKER] = {};
	object.mapCollisionHandlers[ObjectTypes.PLAYER] = {};
	object.mapCollisionHandlers[ObjectTypes.ROBOT] = {};
	object.mapCollisionHandlers[ObjectTypes.WEAPON] = {};

	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.HOSTAGE] = object.prototype.collidePlayerHostage;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.MARKER] = object.prototype.collidePlayerMarker;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.CLUTTER] = object.prototype.collidePlayerClutter;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.CNTRLCEN] = object.prototype.collidePlayerControlCenter;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.PLAYER] = object.prototype.collidePlayerPlayer;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.POWERUP] = object.prototype.collidePlayerPowerup;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.WEAPON] = object.prototype.collidePlayerWeapon;
	object.mapCollisionHandlers[ObjectTypes.PLAYER][ObjectTypes.ROBOT] = object.prototype.collidePlayerRobot;
	object.mapCollisionHandlers[ObjectTypes.ROBOT][ObjectTypes.CNTRLCEN] = object.prototype.collideRobotControlCenter;
	object.mapCollisionHandlers[ObjectTypes.ROBOT][ObjectTypes.ROBOT] = object.prototype.collideRobotRobot;
	object.mapCollisionHandlers[ObjectTypes.ROBOT][ObjectTypes.WEAPON] = object.prototype.collideRobotWeapon;
	object.mapCollisionHandlers[ObjectTypes.WEAPON][ObjectTypes.CLUTTER] = object.prototype.collideWeaponClutter;
	object.mapCollisionHandlers[ObjectTypes.WEAPON][ObjectTypes.CNTRLCEN] = object.prototype.collideWeaponControlCenter;
	object.mapCollisionHandlers[ObjectTypes.WEAPON][ObjectTypes.DEBRIS] = object.prototype.collideWeaponDebris;
	object.mapCollisionHandlers[ObjectTypes.WEAPON][ObjectTypes.WEAPON] = object.prototype.collideWeaponWeapon;

	for (var i in object.mapCollisionHandlers)
	{
		var mapCollisionHandlers = object.mapCollisionHandlers[i];
		for (var j in mapCollisionHandlers)
		{
			var mapReversed = object.mapCollisionHandlers[j];
			if (!mapReversed)
				mapReversed = object.mapCollisionHandlers[j] = {};
			if (!mapReversed[i])
			{
				mapReversed[i] = (function (fn: (time: number, pos: Vec3, other: object) => object)
				{
					return function (time: number, pos: Vec3, other: object): object
					{
						return fn.call(other, time, pos, this);
					}
				})(object.mapCollisionHandlers[i][j]);
			}
		}
	}

})();
