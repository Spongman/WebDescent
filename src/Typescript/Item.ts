/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />
/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />
/// <reference path="Ham.ts" />
/// <reference path="Level.ts" />
/// <reference path="Player.ts" />
/// <reference path="Controls.ts" />
/// <reference path="PowerupTypes.ts" />
"use strict";

enum ItemTypes {
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
enum ItemFlags {
	EXPLODING = (1 << 0),   // this object is exploding
	SHOULD_BE_DEAD = (1 << 1),   // this object should be dead, so next time we can, we should delete this object.
	DESTROYED = (1 << 2),   // this has been killed, and is showing the dead version
	SILENT = (1 << 3),   // this makes no sound when it hits a wall.  Added by MK for weapons, if you extend it to other types, do it completely!
	ATTACHED = (1 << 4),  // this object is a fireball attached to another object
	HARMLESS = (1 << 5),  // this object does no damage.  Added to make quad lasers do 1.5 damage as normal lasers.
	PLAYER_DROPPED = (1 << 6),  // this object was dropped by the player...
}
// Control types - what tells this CObject what do do
enum ControlTypes {
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
enum MovementTypes {
	NONE = 0,   // doesn't move
	PHYSICS = 1,   // moves by physics
	STATIC = 2,	// completely still and immoveable
	SPINNING = 3,   // this CObject doesn't move, just sits and spins
}
enum RenderTypes {
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

interface IMover {
	velocity: Vec3;

	move(obj: Item, time: number, frameTime: number): boolean;
}

class SpinnerInfo implements IMover {
	spin: Vec3;
	spinMatrix: Mat3;
	velocity: Vec3 = Vec3.Zero;

	load(view: DataStream) {
		this.spin = view.getVector();
		this.spinMatrix = Mat3.fromEuler(this.spin);
		return this;
	}
	move(obj: Item, time: number, frameTime: number): boolean {
		obj.orient = this.spinMatrix.scale(frameTime).multiply(obj.orient);
		return true;
	}
}
class PhysicsInfo implements IMover {
	velocity: Vec3 = Vec3.Zero;
	thrust: Vec3 = Vec3.Zero;

	mass = 0;
	drag = 0;
	brakes = 0;

	rotvel: Vec3 = Vec3.Zero;
	rotthrust: Vec3 = Vec3.Zero;

	turnroll = 0;
	flags = 0;

	load(view: DataStream) {
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
	move(obj: Item, time: number, frameTime: number) {
		if (this.drag) {
			const tau = this.mass * 2.5 * this.drag;
			const dragScale = Math.exp(-frameTime / tau);

			// linear drag equation
			this.rotvel = this.rotvel.scale(dragScale);

			if (this.flags & PhysicsFlags.USES_THRUST) {
				this.rotvel = this.rotvel.addScale(this.rotthrust, tau * (1 - dragScale) / frameTime);
			}
		}

		let orient = obj.orient;

		if (this.turnroll) {
			const turnmat = Mat3.fromEuler(0, 0, -this.turnroll);
			orient = orient.multiply(turnmat);
		}

		const tangles = Mat3.fromEuler(this.rotvel.scale(frameTime));
		orient = tangles.multiply(orient);

		if (this.flags & PhysicsFlags.TURNROLL) {
			const desired_bank = -this.rotvel.y * TURNROLL_SCALE;

			if (this.turnroll !== desired_bank) {
				let max_roll = frameTime * ROLL_RATE;

				const delta_ang = desired_bank - this.turnroll;

				if (Math.abs(delta_ang) < max_roll) {
					max_roll = delta_ang;
				} else if (delta_ang < 0) {
					max_roll = -max_roll;
									}

				this.turnroll += max_roll;
			}
		}

		if (this.turnroll) {
			const turnmat = Mat3.fromEuler(0, 0, this.turnroll);
			orient = orient.multiply(turnmat);
		}

		obj.orient = orient;

		if (this.drag) {
			const tau = this.mass * this.drag;
			const dragScale = Math.exp(-frameTime / tau);

			// linear drag equation
			this.velocity = this.velocity.scale(dragScale);
			if (this.flags & PhysicsFlags.USES_THRUST) {
				this.velocity = this.velocity.addScale(this.thrust, tau * (1 - dragScale) / frameTime);
			}
		}

		let fKill = false;

		if (this.velocity.len2() > 1e-15) {
			const move = this.velocity.scale(frameTime);
			// const distance = move.len2();

			assert(obj.iCube >= 0);

			/*
			if (!obj.cube.isPointInside(posNew))
			{
				console.log("NOT INSIDE");
				// return;
			}
			*/
			const mapCollisionHandlers = Item.mapCollisionHandlers[obj.type];

			let cBounces = 3;
			const type = obj.type;
			let bounce: Bounce | null;
			const sideExit: Side | null = null;

			let cube = obj.cube;
			let pos = obj.pos;
			let posNew = pos.add(move);

			do {
				const line = new LineSegment(pos, posNew);

				// if (!(obj.type === ObjectTypes.PLAYER /*&& _cubeDebug*/))
				bounce = cube.bounce(line, obj.size + 0.01);

				let closestOther: Item | null = null;
				let distanceToClosest = line.length; // Number.POSITIVE_INFINITY;

				if (mapCollisionHandlers) {
					const rgObjects = cube._rgObjects;
					for (let iOther = rgObjects.length; iOther--;) {
						const other: Item = rgObjects[iOther];
						assert(other.cubeIndex >= 0);
						const otherType = other.type;
						if (otherType === type) {
							if (iOther >= obj.cubeIndex) {
								continue;
							}

							if (other === obj) {
								continue;
							}
						}

						const collisionHandler = mapCollisionHandlers[otherType];
						if (collisionHandler) {
							const distanceToOther = line.distanceToSphere(other.pos, other.size + obj.size);
							if (distanceToClosest > distanceToOther) {
								distanceToClosest = distanceToOther;
								closestOther = other;
							}
						}
					}
				}

				if (closestOther && (!bounce || distanceToClosest < bounce.distance)) {
					const collisionPoint = new LineSegment(line.proceed(distanceToClosest), closestOther.pos).proceed(obj.size);

					// console.log(distanceToClosest);
					const objRemove = mapCollisionHandlers[closestOther.type].call(obj, time, collisionPoint, closestOther);
					if (objRemove) {
						if (objRemove === obj) {
							fKill = true;
						} else {
							objRemove.link(null);
						}
					}
				} else if (bounce) {
					const side = bounce.side;
					const wall = side.wall;

					if (!side.isSolid()) {
						if (wall && wall.trigger) {
							wall.trigger.trigger(obj, time, false);
						}

						cube = side.neighbor;
						pos = bounce.anchor;
					} else {
						switch (type) {
							case ItemTypes.WEAPON:

							let uv: Vec2 | null = null;

							const tmi1 = side.tmi1;
							if (side.neighbor && tmi1.isTransparent()) {
									if (!uv) {
										uv = bounce.getTextureCoords();
									}
									const color = side.getPixel(uv.x, uv.y);
									if (color === 255) {
										cube = side.neighbor;
										pos = bounce.anchor;
										break;
									}
								}

							const wi = obj.weaponInfo;

							if (this.flags & PhysicsFlags.BOUNCE &&
									(!(this.flags & PhysicsFlags.BOUNCES_TWICE) || !(this.flags & PhysicsFlags.BOUNCED_ONCE))) {
									this.flags |= PhysicsFlags.BOUNCED_ONCE;
									const normalVelocity = this.velocity.projectOnTo(bounce.normal);
									this.velocity = this.velocity.addScale(normalVelocity, -2);

									obj.orient = Mat3.createLook(this.velocity, obj.orient._[1]);

									pos = bounce.anchor;
									posNew = bounce.reflectPoint(posNew);
								} else {
									fKill = true;
									posNew = bounce.anchor;

									cube.createExplosion(time, posNew.addScale(side.normal, .1), wi.impact_size, wi.wall_hit_vclip);

									if (!wall && wi.wall_hit_sound >= 0) {
										_ham.playSound(wi.wall_hit_sound, posNew);
									}
								}

							const tmi2 = side.tmi2;
							if (tmi2) {
									const ec = tmi2.eclip_num;

									let fBlow = false;
									const effect: EClip | null = (ec >= 0) ? _ham.rgEClips[ec] : null;
									if (effect) {
										fBlow = (effect.dest_bm_num >= 0 && !(effect.eflags & EClipFlags.ONE_SHOT));
									} else {
										fBlow = (tmi2.destroyed !== -1);
									}

									if (fBlow) {
										if (!uv) {
											uv = bounce.getTextureCoords();
										}

										const color = side.getPixel2(uv.x, uv.y);
										if (color !== 255) {
											side.setDeltaLight(0);

											if (effect) {
												if (effect.sound_num >= 0) {
													_ham.playSound(effect.sound_num, posNew);
												}

												cube.createExplosion(time, posNew.addScale(side.normal, .1), effect.dest_size, effect.dest_vclip);

												if (effect.dest_eclip >= 0) {
													const new_ec = _ham.rgEClips[effect.dest_eclip];
													new_ec.time_left = new_ec.frame_time;
													new_ec.frame_count = 0;
													new_ec.segnum = cube.index;
													new_ec.sidenum = side.index;
													new_ec.eflags |= EClipFlags.ONE_SHOT;
													new_ec.dest_bm_num = effect.dest_bm_num;

													side.setTex2(new_ec.changing_wall_texture);		// replace with destoyed
												} else {
													side.setTex2(effect.dest_bm_num);
												}
											} else {
												cube.createExplosion(time, posNew.addScale(side.normal, .1), 20, 3);
												side.setTex2(tmi2.destroyed);
												_ham.playSound(SoundFile_Sounds.LIGHT_BLOWNUP, posNew);
											}

											if (wall && wall.trigger) {
												wall.trigger.trigger(obj.parent, time, true);
											}
										}
									}
								}

							if (wall) {
									switch (wall.type) {
										case WallTypes.BLASTABLE:
											wall.damage(time, obj.shields);
											if (wi.wall_hit_sound >= 0) {
												_ham.playSound(SoundFile_Sounds.WEAPON_HIT_BLASTABLE, posNew);
											}
											break;
										case WallTypes.DOOR:
											if (obj.parent && obj.parent.type === ItemTypes.PLAYER) {
												if (_player.hasKeys(wall.keys) && !(wall.flags & WallFlags.DOOR_LOCKED)) {
													if (wall.state !== DoorStates.OPENING) {
														wall.openDoor();
													}
												} else {
													_ham.playSound(SoundFile_Sounds.WEAPON_HIT_DOOR, posNew);
												}
											}
											break;
										default:
											if (wi.wall_hit_sound >= 0) {
												_ham.playSound(wi.wall_hit_sound, posNew);
											}
											break;
									}
								}
							break;

							default:
								const normalVelocity = this.velocity.projectOnTo(bounce.normal);
								this.velocity = this.velocity.sub(normalVelocity);
								pos = bounce.anchor;
								posNew = bounce.reflectPoint(posNew);
								break;
						}
					}
				}
			}
			while (cBounces-- > 0 && (bounce || sideExit));

			if (!cube.isPointInside(posNew)) {
				cube.isPointInside(posNew);
				cube.bounce(new LineSegment(pos, posNew), 0);
				// find closest point
				const lineFix = new LineSegment(cube.center, posNew);
				const bounceFix = cube.bounce(lineFix, obj.size);
				if (bounceFix) {
					posNew = bounceFix.anchor;
				} else {
					posNew = null!;
				}	// last resort, don't move
			}

			if (posNew) {
				obj.pos = posNew;
				obj.link(cube);
			}
		}
		return !fKill;	// stay alive
	}
}
enum PhysicsFlags {
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
interface IObjectRenderer {
	render(obj: Item, time: number): void;
}
class PolygonRenderInfo implements IObjectRenderer {
	rgAnimAngles: Vec3[];
	subobj_flags = 0;
	alt_textures = 0;
	tmap_override = 0;

	constructor(public model_num?: number) {
	}

	load(view: DataStream) {
		this.model_num = view.getUint32();
		this.rgAnimAngles = view.getVector2Array(MAX_SUBMODELS);
		this.subobj_flags = view.getUint32();
		this.tmap_override = view.getInt32();

		return this;
	}
	render(obj: Item, time: number) {
		const pos = obj.pos;
		const orient = obj.orient;

		const lightValue = obj.cube.static_light;
		const light = new Vec3(lightValue, lightValue, lightValue);

		const model = _ham.rgPolygonModels[this.model_num!];

		pushOrientMatrix(orient, pos);

		let flags = this.subobj_flags;
		if (flags) {
			for (let i = 0; flags; flags >>= 1, ++i) {
				if (flags & 1) {
					const ofs = model.submodel_mins[i].add(model.submodel_maxs[i]).scale(.5);
					// push matrix

					model.render(light, this.rgAnimAngles);

					// pop matrix
				}
			}
		} else {
			model.render(light, this.rgAnimAngles);
		}

		popMatrix();
	}
}
class VClipRenderInfo implements IObjectRenderer {
	vclip: VClip;
	vclip_num: number;

	render(obj: Item, time: number) {
		// do nothing
	}

	renderFrame(obj: Item, iBitmap: number) {
		const vclip = this.getVClip();

		let program: WebGLProgram;
		if (vclip.flags & VClipFlags.ROD) {
			program = programBillboardX;
		} else {
			program = programBillboard;
		}

		useProgram(program);

		const tex = _pig.loadBitmap(iBitmap, 1);
		if (!tex) {
			return;
		}
		bindTexture(1, tex.tex);

		const bmp = tex.bmp;
		gl.uniform3f(program.pos, obj.pos.x, obj.pos.y, obj.pos.z);
		gl.uniform2f(program.sizeTexture, bmp.width, bmp.height);
		gl.uniform1f(program.scale, obj.size / Math.max(bmp.width, bmp.height));

		loadAttribBuffer(program.aVertexPosition, program.bufferVertexPosition);

		gl.drawArrays(gl.TRIANGLE_FAN, 0, program.bufferVertexPosition.numItems);
	}
	getVClip() {
		let vclip = this.vclip;
		if (!vclip) {
			this.vclip = vclip = _ham.rgVClips[this.vclip_num];
		}
		return vclip;
	}
}
class OneShotVClipRenderInfo extends VClipRenderInfo {
	vclip_num: number;

	constructor(vclip_num: number) {
		super();
		this.vclip_num = vclip_num;
	}
	render(obj: Item, time: number) {
		const vclip = this.getVClip();

		// odd objects go backwards?
		let iFrame = Math.floor(vclip.num_frames * (time - obj.creationTime) / (vclip.play_time));
		if (iFrame >= vclip.num_frames) {
			iFrame = vclip.num_frames - 1;
		}

		const iBitmap = vclip.frames[iFrame];

		this.renderFrame(obj, iBitmap);
	}
}
class LoopingVClipRenderInfo extends VClipRenderInfo {
	frametime: number;
	framenum: number;

	load(view: DataStream) {
		this.vclip_num = view.getUint32();
		this.frametime = view.getFixed();
		this.framenum = view.getUint8();

		return this;
	}
	render(obj: Item, time: number) {
		const vclip = this.getVClip();

		const num = Number(obj._unique);
		// odd objects go backwards?
		const iFrame = Math.floor((time / this.frametime) + this.framenum + num) % vclip.num_frames;
		const iBitmap = (num & 1) ? vclip.frames[iFrame] : vclip.frames[vclip.num_frames - 1 - iFrame];

		this.renderFrame(obj, iBitmap);
	}
}
const MAX_AI_FLAGS = 11;          // This MUST cause word (4 bytes) alignment in ai_static, allowing for one byte mode

const TURNROLL_SCALE = fix(0x4ec4 / 2);
const ROLL_RATE = fix(0x2000);
const HEADLIGHT_SCALE = 10;

class Item {
	static mapCollisionHandlers = [] as Array<Array<(time: number, pos: Vec3, other: Item) => Item|null>>;

	static load(view: DataStream) {
		const type = view.getUint8();
		const id = view.getInt8();

		switch (type) {
			case ItemTypes.PLAYER: // 4,		// the player on the console
			case ItemTypes.POWERUP: // 7,		// a powerup you can pick up
			case ItemTypes.ROBOT: // 2,		// an evil enemy
			case ItemTypes.COOP: // 14,	// a cooperative player CObject.
			case ItemTypes.CNTRLCEN: // 9,		// the control center
			case ItemTypes.HOSTAGE: // 3,		// a hostage you need to rescue
			case ItemTypes.WEAPON: // 5,		// a laser, missile, etc
				return new Item(type, id).load(view);

			// case ObjectTypes.WALL			: // 0,		// A CWall... not really an CObject, but used for collisions
			// case ObjectTypes.FIREBALL		: // 1,		// a fireball, part of an explosion
			// case ObjectTypes.CAMERA		: // 6,		// a camera to slew around with
			// case ObjectTypes.DEBRIS		: // 8,		// a piece of robot
			// case ObjectTypes.FLARE		: // 10,	// a flare
			// case ObjectTypes.CLUTTER		: // 11,	// misc objects
			// case ObjectTypes.GHOST		: // 12,	// what the player turns into when dead
			// case ObjectTypes.LIGHT		: // 13,	// a light source, & not much else
			// case ObjectTypes.MARKER		: // 15,	// a map marker
			// case ObjectTypes.CAMBOT		: // 16,	// a camera
			// case ObjectTypes.MONSTERBALL	: // 17,	// a monsterball
			// case ObjectTypes.SMOKE		: // 18,	// static smoke
			// case ObjectTypes.EXPLOSION	: // 19,	// static explosion particleEmitters
			// case ObjectTypes.EFFECT		: // 20,	// lightnings

			default:
				throw new Error("unknown object type: " + type);
		}
	}

	info: any;
	parent: Item;

	mapCollisionHandlers: ((time: number, pos: Vec3, other: Item) => Item|null)[];

	controlType: ControlTypes;
	movementType: MovementTypes;
	renderType: RenderTypes;
	flags: ItemFlags;

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

	_unique: string;

	constructor(public type: ItemTypes, public id: number) {
		this._unique = (__unique++).toString();

		// console.log("type: " + type);

		if (type < 0 || type > 15) {
			throw new Error("unknown ObjectType: " + type);
		}

		this.mapCollisionHandlers = Item.mapCollisionHandlers[type];

		switch (type) {
			case ItemTypes.ROBOT:
				this.info = _ham.rgRobotTypes[id];
				break;

			case ItemTypes.FIREBALL:
				this.info = _ham.rgVClips[id];
				break;

			case ItemTypes.POWERUP:
				this.info = _ham.rgPowerupInfos[id];
				break;

			case ItemTypes.WEAPON:
				this.info = _ham.rgWeaponInfos[id];
				break;

			default:
				return;
		}

		// if (!this.info)
		// 	throw new Error ("object info not found");
	}
	load(view: DataStream) {
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

		switch (this.movementType) {
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

		switch (this.controlType) {
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
				};
				if (view.gameVersion <= 25) {
					view.getUint16();	// follow_path_start_seg
					view.getUint16();	// follow_path_end_seg
				}
				break;

			case ControlTypes.POWERUP:	// 13,	  // animating powerup blob

			let count = 1;
			if (view.gameVersion >= 25) {
					count = view.getUint32();
			}

			switch (this.id) {
					case PowerupTypes.VULCAN_WEAPON:
					case PowerupTypes.GAUSS_WEAPON:
						count = VULCAN_WEAPON_AMMO_AMOUNT;
						break;
					// case PowerupTypes.OMEGA_WEAPON:
					// 	count = 1;
					// 	break;
				}

			this.control = { count };
			break;

			case ControlTypes.WEAPON:
				this.control = {
						parent_type: view.getInt16(),
						parent_num: view.getInt16(),
						parent_signature: view.getUint32(),
					};
				break;

			// case ControlTypes.WEAPON:		// 9,	  // laser, etc.
			// case ControlTypes.EXPLOSION:	// 2,	  // explosion sequencer
			// case ControlTypes.FLYTHROUGH:	// 6,	  // the flythrough system
			// case ControlTypes.REPAIRCEN:	// 10,	  // under the control of the repair center
			// case ControlTypes.MORPH:		// 11,	  // this CObject is being morphed
			// case ControlTypes.LIGHT:		// 14,	  // doesn't actually do anything
			// case ControlTypes.REMOTE:		// 15,	  // controlled by another net player
			// case ControlTypes.WAYPOINT:	// 17,
			// case ControlTypes.CAMERA:		// 18,

			default:
				throw new Error("unknown ControlType: " + this.controlType);
		}

		switch (this.renderType) {
			default:
				throw new Error("unknown RenderType: " + this.renderType);

			case RenderTypes.NONE:			// 0,	// does not render
			case RenderTypes.LASER:			// 3,	// a laser
				break;

			case RenderTypes.POLYOBJ:		// 1,	// a polygon model
			case RenderTypes.MORPH:			// 6,	// a robot being morphed
				this.renderInfo = new PolygonRenderInfo().load(view);
				break;

			case RenderTypes.HOSTAGE:		// 4,	// a hostage
			case RenderTypes.POWERUP:		// 5,	// a powerup
			case RenderTypes.WEAPON_VCLIP:	// 7,	// a weapon that renders as a tVideoClip
				// case RenderTypes.FIREBALL:		// 2,	// a fireball
				this.renderInfo = new LoopingVClipRenderInfo().load(view);
				break;

			// case RenderTypes.THRUSTER:	// 8,	// like afterburner, but doesn't cast light
			// case RenderTypes.EXPLBLAST:	// 9,	// white explosion light blast
			// case RenderTypes.SHRAPNELS:	// 10,	// smoke trails coming from explosions
			// case RenderTypes.SMOKE:		// 11,
			// case RenderTypes.LIGHTNING:	// 12,
			// case RenderTypes.SOUND:		// 13,
			// case RenderTypes.SHOCKWAVE:	// 14,	// concentric shockwave effect
		}

		return this;
	}
	isValid() {
		if (this.type === ItemTypes.NONE) {
			return false;
		}

		if (this.flags & ItemFlags.SHOULD_BE_DEAD) {
			return false;
		}

		return true;
	}
	link(cube: Cube | null) {
		const cubeOld = this.cube;
		if (cubeOld === cube) {
			return;
		}

		if (cubeOld) {
			assert(this.cubeIndex >= 0);
			
			const index = this.cubeIndex;
			const objectOther = cubeOld._rgObjects.pop();
			if (!objectOther) {
				throw new Error();
			}
			if (objectOther.cubeIndex !== cubeOld._rgObjects.length) {
				throw new Error("wrong cube");
			}
			if (this !== objectOther) {
				cubeOld._rgObjects[index] = objectOther;
				objectOther.cubeIndex = index;
			}
		}

		if (cube) {
			this.cube = cube;
			this.iCube = cube.index;
			this.cubeIndex = cube._rgObjects.length;
			cube._rgObjects.push(this);
		} else {
			this.iCube = -1;
			this.cubeIndex = -1;
		}
	}
	getEmittedLight(time: number): Vec3 | null {
		let intensity = 0;
		switch (this.type) {
			case ItemTypes.PLAYER:
				if (_player.flags & PlayerFlags.HEADLIGHT_ON) {
					intensity = HEADLIGHT_SCALE;
				} else {
					const pi = this.mover as PhysicsInfo;
					const k = pi.mass * pi.drag / (1 - pi.drag);
					intensity = Math.max(pi.velocity.len() * k / 4, 2) + 0.5;
				}
				break;

			case ItemTypes.FIREBALL:
				if (this.id < 0) {
					return null;
				}

				const vclip: VClip = this.info;
				intensity = vclip.light_value;

				const timeleft = this.deathTime - time;
				if (timeleft < 4) {
					intensity *= timeleft / vclip.play_time;
				}
				break;

			case ItemTypes.ROBOT:
				const rt: RobotType = this.info;
				intensity = rt.lightcast;
				break;

			case ItemTypes.WEAPON:
				const wi: WeaponInfo = this.info;
				intensity = wi.light;
				// if (this.id === WeaponTypes.FLARE)// TODO: flicker flares
				break;

			case ItemTypes.POWERUP:
				const powerupInfo: PowerupInfo = this.info;
				intensity = powerupInfo.light;
				break;

			case ItemTypes.MARKER:
			case ItemTypes.DEBRIS:
			case ItemTypes.LIGHT:
				break;

			// default:
			// 	throw new Error("unhandled type: " + this.type);
		}

		if (intensity <= 0) {
			return null;
		}

		if (intensity > 1) {
			intensity = 1;
		}

		return Vec3.One.scale(intensity);
	}
	update(time: number, frameTime: number) {
		if (this.flags & ItemFlags.SHOULD_BE_DEAD) {
			return false;
		}

		switch (this.controlType) {
			case ControlTypes.FLYING:

				const ship = _ham.ship;

				const pi = this.mover as PhysicsInfo;
				if (this.controls) {
					pi.thrust = this.orient.multiply(this.controls.thrust).scale(ship.max_thrust / frameTime);
					pi.rotthrust = this.controls.rot.scale(ship.max_rotthrust / frameTime);
				}

				if (pi.flags & PhysicsFlags.WIGGLE) {
					const wiggle = Math.sin(time * Math.PI * 2) * ship.wiggle;
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

		if (time >= this.deathTime || (this.flags & ItemFlags.SHOULD_BE_DEAD)) {
			switch (this.controlType) {
				case ControlTypes.POWERUP:
					// create explosion
					break;
			}

			return false;
		}

		if (this.mover) {
			return this.mover.move(this, time, frameTime);
		}

		return true;
	}
	doAI(time: number, frameTime: number) {
		// do nothing
	}
	render(time: number) {
		if (this.type === ItemTypes.PLAYER) {
			return;
		}

		if (this.renderInfo) {
			this.renderInfo.render(this, time);
		}
	}
	fireLaser(iWeapon: number, laser_level: number, cFires: number, fQuad: boolean) {
		switch (iWeapon) {
			case PrimaryWeaponIndex.LASER:

				// Laser_offset?

				let weaponNum: number;
				if (laser_level <= MAX_LASER_LEVEL) {
					weaponNum = WeaponTypes.LASER + laser_level;
				} else {
					weaponNum = WeaponTypes.SUPER_LASER + laser_level - (MAX_LASER_LEVEL + 1);
				}

				this.fireWeapon(weaponNum, 0, 0, 0, 0, true);
				this.fireWeapon(weaponNum, 1);

				if (fQuad) {
					this.fireWeapon(weaponNum, 2);
					this.fireWeapon(weaponNum, 3);
				}

				break;
		}
	}
	fireWeapon(laser_type: number, gun_num: number, spreadr?: number, spreadu?: number, delay?: number, make_sound = false, harmless: boolean = false) {
		const wi = _ham.rgWeaponInfos[laser_type];

		const ship = _ham.ship;
		const pos = this.orient.transpose().rotate(ship.gun_points[gun_num]).add(this.pos);
		let dir = this.direction;

		// if (delay)
		// 	pos = pos.sub(dir.scale(delay * wi.speed[_difficultyLevel]));

		if (spreadr) {
			dir = dir.addScale(this.orient._[0], spreadr);
		}

		if (spreadu) {
			dir = dir.addScale(this.orient._[0], spreadu);
		}

		const obj = wi.createObject(this, pos, this.cube, dir);
		obj.multiplier = 1;

		if (this.type === ItemTypes.PLAYER) {
			if (laser_type >= WeaponTypes.LASER && laser_type <= MAX_SUPER_LASER_LEVEL) {
				obj.multiplier = 3 / 4;
			}
		}

		_level.rgObjects.push(obj);

		if (make_sound && wi.flash_sound >= 0) {
			if (this.type === ItemTypes.PLAYER) {
				this.playSound(wi.flash_sound);
			} else {
				_ham.playSound(wi.flash_sound, pos);
			}
		}
	}
	createFireball(time: number, delay: number) {
		const obj = this.cube.createExplosion(time, this.pos, 0, -1, delay);
		obj.control = {
			delete_obj: this,
			spawn: true,
		};
		return obj;
	}
	doExplosion(time: number, frameTime: number) {
		const control = this.control;
		if (control) {
			if (time >= this.deathTime) {
				const del_obj: Item = control.delete_obj;
				if (control.spawn) {
					const vclip = del_obj.getExplosionVClip(1);
					const expl_obj = del_obj.cube.createExplosion(time, del_obj.pos, del_obj.size * (5 / 2), vclip);

					if (expl_obj && !(expl_obj.flags & ItemFlags.SHOULD_BE_DEAD)) {
						expl_obj.control = {
							delete_time: (time + control.death_time) / 2,
							delete_obj: del_obj,
						};
					} else {
						del_obj.flags |= ItemFlags.SHOULD_BE_DEAD;
					}

					// TODO: drop stuff

					const rt: RobotType = del_obj.info;
					if (rt.exp2_sound_num >= 0) {
						_ham.playSound(rt.exp2_sound_num, del_obj.pos);
					}

					// TODO: debris
				}

				if (control.delete_obj) {
					del_obj.flags |= ItemFlags.SHOULD_BE_DEAD;
				}
			}
		}
	}
	getExplosionVClip(stage: number): number {
		switch (this.type) {
			case ItemTypes.PLAYER:
				const rt: RobotType = this.info;
				if (stage === 0 && rt.exp1_vclip_num >= 0) {
					return rt.exp1_vclip_num;
				}
				if (stage === 1 && rt.exp2_vclip_num >= 0) {
					return rt.exp2_vclip_num;
				}
				break;
			case ItemTypes.ROBOT:
				if (_ham.ship.expl_vclip_num >= 0) {
					return _ham.ship.expl_vclip_num;
				}
				break;
		}

		return KnownVClips.SMALL_EXPLOSION;
	}
	playSound(iSound: SoundFile_Sounds) {
		_ham.playObjectSound(iSound, this);
	}
	/*
	collide(other: item)
	{
		const mapCollisionHandlers = this.mapCollisionHandlers;
		if (!mapCollisionHandlers)
			return;

		const otherType = other.type;
		const collisionHandler = mapCollisionHandlers[<any>otherType];
		if (!collisionHandler)
			return;

		return collisionHandler(other);
	}
	*/

	collidePlayerHostage(time: number, pos: Vec3, other: Item): Item|null {
		// TODO: flags
		// TODO: increment hostage count

		_ham.playSound(SoundFile_Sounds.HOSTAGE_RESCUED);
		return other;
	}
	collidePlayerMarker(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collidePlayerClutter(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collidePlayerControlCenter(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collidePlayerPlayer(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collidePlayerPowerup(time: number, pos: Vec3, other: Item) {
		if (!_player.pickUpPowerup(other.id)) {
			return null;
		}

		const pi: PowerupInfo = other.info;
		if (pi && pi.hit_sound) {
			_ham.playSound(pi.hit_sound);
		}

		return other;
	}
	collidePlayerWeapon(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collidePlayerRobot(time: number, pos: Vec3, other: Item): Item|null {
		const pi = this.mover as PhysicsInfo;
		const piOther = other.mover as PhysicsInfo;

		const vel = pi.velocity;
		const velOther = piOther.velocity;

		const mass = pi.mass;
		const massOther = piOther.mass;

		const force = vel.addScale(velOther, -2 * mass * massOther / (mass + massOther));

		piOther.velocity = velOther.addScale(force, 1 / piOther.mass);

		pi.velocity = vel.addScale(force, -1 / pi.mass);

		return null;
	}
	collideRobotControlCenter(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collideRobotRobot(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collideRobotWeapon(time: number, pos: Vec3, weapon: Item) {
		const rt: RobotType = this.info;
		if (rt.exp1_vclip_num >= 0) {
			weapon.cube.createExplosion(time, pos, this.size * 3 / 8, rt.exp1_vclip_num);
		}

		if (rt.exp1_sound_num >= 0) {
			_ham.playSound(rt.exp1_sound_num, pos);
		}

		if (!(weapon.flags & ItemFlags.HARMLESS)) {
			const damage = weapon.shields * weapon.multiplier;
			this.damage(time, damage);
		}

		return weapon;
	}
	damage(time: number, damage: number): boolean {
		if (this.flags & ItemFlags.EXPLODING || this.shields < 0) {
			return false;
		}

		this.shields -= damage;

		if (this.shields < 0) {
			if (this.type === ItemTypes.PLAYER) {
				// do nothing
			} else {
				const rt: RobotType = this.info;
				const delay = (rt.kamikaze) ? .01 : .25;
				this.createFireball(time, delay);
			}
		}

		return false;
	}
	collideWeaponClutter(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collideWeaponControlCenter(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collideWeaponDebris(time: number, pos: Vec3, other: Item): Item|null { return null; }
	collideWeaponWeapon(time: number, pos: Vec3, other: Item): Item|null { return null; }

	isDead(): boolean {
		return false;
	}

}

(() => {
	Item.mapCollisionHandlers[ItemTypes.HOSTAGE] = [];
	Item.mapCollisionHandlers[ItemTypes.MARKER] = [];
	Item.mapCollisionHandlers[ItemTypes.PLAYER] = [];
	Item.mapCollisionHandlers[ItemTypes.ROBOT] = [];
	Item.mapCollisionHandlers[ItemTypes.WEAPON] = [];

	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.HOSTAGE] = Item.prototype.collidePlayerHostage;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.MARKER] = Item.prototype.collidePlayerMarker;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.CLUTTER] = Item.prototype.collidePlayerClutter;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.CNTRLCEN] = Item.prototype.collidePlayerControlCenter;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.PLAYER] = Item.prototype.collidePlayerPlayer;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.POWERUP] = Item.prototype.collidePlayerPowerup;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.WEAPON] = Item.prototype.collidePlayerWeapon;
	Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.ROBOT] = Item.prototype.collidePlayerRobot;
	Item.mapCollisionHandlers[ItemTypes.ROBOT][ItemTypes.CNTRLCEN] = Item.prototype.collideRobotControlCenter;
	Item.mapCollisionHandlers[ItemTypes.ROBOT][ItemTypes.ROBOT] = Item.prototype.collideRobotRobot;
	Item.mapCollisionHandlers[ItemTypes.ROBOT][ItemTypes.WEAPON] = Item.prototype.collideRobotWeapon;
	Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.CLUTTER] = Item.prototype.collideWeaponClutter;
	Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.CNTRLCEN] = Item.prototype.collideWeaponControlCenter;
	Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.DEBRIS] = Item.prototype.collideWeaponDebris;
	Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.WEAPON] = Item.prototype.collideWeaponWeapon;

	for (const i in Item.mapCollisionHandlers) {
		if (!Item.mapCollisionHandlers.hasOwnProperty(i)) {
			continue;
		}

		const mapCollisionHandlers = Item.mapCollisionHandlers[i];
		for (const j in mapCollisionHandlers) {
			if (!mapCollisionHandlers.hasOwnProperty(j)) {
			continue;
			}

			let mapReversed = Item.mapCollisionHandlers[j];
			if (!mapReversed) {
				mapReversed = Item.mapCollisionHandlers[j] = [];
			}
			if (!mapReversed[i]) {
				mapReversed[i] = ((fn: (time: number, pos: Vec3, other: Item) => Item|null) => {
					return function(this: Item, time: number, pos: Vec3, other: Item): Item|null {
						return fn.call(other, time, pos, this);
					};
				})(Item.mapCollisionHandlers[i][j]);
			}
		}
	}

})();
