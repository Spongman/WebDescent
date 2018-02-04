/// <areference path="DataView.ts" />
/// <areference path="DataStream.ts" />

/// <reference path="webgl.ts" />
/// <reference path="Item.ts" />
/// <reference path="Sound.ts" />
/// <reference path="Pig.ts" />
"use strict";

const VCLIP_MAX_FRAMES = 30;

enum VClipFlags {
	ROD = 1,       // draw as a rod, not a blob
}
class VClip {

	play_time: number;
	num_frames: number;
	frame_time: number;
	flags: VClipFlags;
	sound_num: number;
	frames: number[];
	light_value: number;

	load(stream: DataStream) {
		this.play_time = stream.getFixed();
		this.num_frames = stream.getInt32();
		this.frame_time = stream.getFixed();
		this.flags = stream.getInt32();
		this.sound_num = stream.getInt16();
		this.frames = stream.getInt16Array(VCLIP_MAX_FRAMES);
		this.light_value = stream.getFixed();

		return this;
	}
}
enum KnownVClips {
	SMALL_EXPLOSION = 2,
	PLAYER_HIT = 1,
	MORPHING_ROBOT = 10,
	PLAYER_APPEARANCE = 61,
	POWERUP_DISAPPEARANCE = 62,
	VOLATILE_WALL_HIT = 5,
	WATER_HIT = 84,
	AFTERBURNER_BLOB = 95,
	MONITOR_STATIC = 99,
	HOSTAGE = 33,
}
enum EClipFlags {
	CRITICAL = (1 << 0),   // this doesn't get played directly (only when mine critical)
	ONE_SHOT = (1 << 1),   // this is a special that gets played once
	STOPPED = (1 << 2),   // this has been stopped
}
class EClip extends VClip {
	time_left: number;
	frame_count: number;
	changing_wall_texture: number;
	changing_object_texture: number;
	eflags: EClipFlags;
	crit_clip: number;
	dest_bm_num: number;
	dest_vclip: number;
	dest_eclip: number;
	dest_size: number;
	sound_num: number;
	segnum: number;
	sidenum: number;

	load(stream: DataStream) {
		super.load(stream);	// VClip

		this.time_left = stream.getFixed();               /*for sequencing */
		this.frame_count = stream.getInt32();             /*for sequencing */
		this.changing_wall_texture = stream.getInt16();   /*Which element of Textures array to */
		this.changing_object_texture = stream.getInt16(); /*Which element of ObjBitmapPtrs array */
		this.eflags = stream.getInt32();
		this.crit_clip = stream.getInt32();               /*use this clip instead of above one */
		this.dest_bm_num = stream.getInt32();             /*use this bitmap when monitor destroyed */
		this.dest_vclip = stream.getInt32();              /*what vclip to play when exploding */
		this.dest_eclip = stream.getInt32();              /*what eclip to play when exploding */
		this.dest_size = stream.getFixed();               /*3d size of explosion */
		this.sound_num = stream.getInt32();               /*what sound this makes */
		this.segnum = stream.getInt32();                  /*what seg & side, for one-shot clips */
		this.sidenum = stream.getInt32();

		return this;
	}
	get flagsQ() { return this.eflags; }

	update(frameTime: number) {
		if (this.eflags & EClipFlags.STOPPED) {
			return;
		}

		if (this.changing_wall_texture === -1 && this.changing_object_texture === -1) {
			return;
		}

		this.time_left -= frameTime;
		while (this.time_left < 0) {
			this.time_left += this.frame_time;

			this.frame_count++;
			if (this.frame_count >= this.num_frames) {
				if (this.eflags & EClipFlags.ONE_SHOT) {
					_level.getSide(this.segnum, this.sidenum).setTex2(this.dest_bm_num);

					this.eflags = this.eflags & ~EClipFlags.ONE_SHOT | EClipFlags.STOPPED;
					this.segnum = -1;
				}
				this.frame_count = 0;
			}
		}

		if (this.eflags & EClipFlags.CRITICAL) {
			return;
		}

		// TODO: control center destroyed

		if (this.changing_wall_texture !== -1) {
			// const asset = _pig.getAsset(this.frames[this.frame_count] + 1);
			// console.log(this.changing_wall_texture, asset.name);
			const tmi = _ham.rgTMapInfos[this.changing_wall_texture];
			tmi.textureIndex = this.frames[this.frame_count];
		}
	}
}
const MAX_CLIP_FRAMES = 50;

enum WClipFlags {
	EXPLODES = (1 << 0),	// door explodes when opening
	BLASTABLE = (1 << 1),	// this is a blastable wall
	TMAP1 = (1 << 2),	// this uses primary tmap, not tmap2
	HIDDEN = (1 << 3),	// this uses primary tmap, not tmap2
}
class WClip {
	play_time: number;
	num_frames: number;
	frames: number[];
	open_sound: number;
	close_sound: number;
	flags: WClipFlags;
	filename: string;

	load(stream: DataStream) {
		this.play_time = stream.getFixed();
		this.num_frames = stream.getInt16();
		this.frames = stream.getInt16Array(MAX_CLIP_FRAMES);
		this.open_sound = stream.getInt16();
		this.close_sound = stream.getInt16();
		this.flags = stream.getInt16();
		this.filename = stream.getTerminatedString(["\0", "\n"], 13);
		stream.position++;

		return this;
	}
	apply(side: Side, iFrame: number) {
		/*
		const cFrames = this.num_frames;
		const iFrame = Math.floor (cFrames * time / this.play_time);
		if (iFrame >= cFrames)
			iFrame = cFrames - 1;
		*/

		const tex = this.frames[iFrame];
		const otherSide = side.otherSide;

		if (this.flags & WClipFlags.TMAP1) {
			side.setTex1(tex);
			if (otherSide) {
				otherSide.setTex1(tex);
			}
		} else {
			side.setTex2(tex, false);
			if (otherSide) {
				otherSide.setTex2(tex, false);
			}
		}
	}
}
class JointList {
	n_joints: number;
	offset: number;

	load(stream: DataStream) {
		this.n_joints = stream.getInt16();
		this.offset = stream.getInt16();

		return this;
	}
}
const MAX_GUNS = 8;
const NDL = 5;	// # difficulty levels
const N_ANIM_STATES = 5;	// # difficulty levels

class RobotType {
	model_num: number;

	gun_points: Vec3[];
	gun_submodels: number[];

	exp1_vclip_num: number;
	exp1_sound_num: number;

	exp2_vclip_num: number;
	exp2_sound_num: number;

	weapon_type: number;
	weapon_type2: number;
	n_guns: number;
	contains_id: number;

	contains_count: number;
	contains_prob: number;
	contains_type: number;
	kamikaze: number;

	score_value: number;
	badass: number;
	energy_drain: number;

	lighting: number;
	strength: number;

	mass: number;
	drag: number;

	field_of_view: number[];
	firing_wait: number[];
	firing_wait2: number[];
	turn_time: number[];
	max_speed: number[];
	circle_distance: number[];

	rapidfire_count: number[];
	evade_speed: number[];

	cloak_type: number;
	attack_type: number;

	see_sound: number;
	attack_sound: number;
	claw_sound: number;
	taunt_sound: number;

	boss_flag: number;
	companion: number;
	smart_blobs: number;
	energy_blobs: number;

	thief: number;
	pursuit: number;
	lightcast: number;
	death_roll: number;

	flags: number;

	deathroll_sound: number;
	glow: number;
	behavior: number;
	aim: number;

	anim_states: JointList[];

	load(stream: DataStream) {
		this.model_num = stream.getInt32();

		this.gun_points = stream.getVectorArray(MAX_GUNS);
		this.gun_submodels = stream.getUint8Array(MAX_GUNS);

		this.exp1_vclip_num = stream.getInt16();
		this.exp1_sound_num = stream.getInt16();

		// if (this.exp1_vclip_num !== -1)
		// 	$this.rgVClips.checkIndex(this.exp1_vclip_num);
		// console.assert(this.exp1_sound_num === -1 || this.exp1_sound_num >= 0 && this.exp1_sound_num < $this.cSounds);

		this.exp2_vclip_num = stream.getInt16();
		this.exp2_sound_num = stream.getInt16();

		// if (this.exp2_vclip_num !== -1)
		// 	$this.rgVClips.checkIndex(this.exp2_vclip_num);
		// console.assert(this.exp2_sound_num === -1 || this.exp2_sound_num >= 0 && this.exp2_sound_num < $this.cSounds);

		this.weapon_type = stream.getUint8();
		this.weapon_type2 = stream.getUint8();
		this.n_guns = stream.getUint8();
		this.contains_id = stream.getUint8();

		this.contains_count = stream.getUint8();
		this.contains_prob = stream.getUint8();
		this.contains_type = stream.getUint8();
		this.kamikaze = stream.getUint8();

		this.score_value = stream.getInt16();
		this.badass = stream.getUint8();
		this.energy_drain = stream.getUint8();

		this.lighting = stream.getFixed();
		this.strength = stream.getFixed();

		this.mass = stream.getFixed();
		this.drag = stream.getFixed();

		this.field_of_view = stream.getFixedArray(NDL);
		this.firing_wait = stream.getFixedArray(NDL);
		this.firing_wait2 = stream.getFixedArray(NDL);
		this.turn_time = stream.getFixedArray(NDL);
		this.max_speed = stream.getFixedArray(NDL);
		this.circle_distance = stream.getFixedArray(NDL);

		this.rapidfire_count = stream.getUint8Array(NDL);
		this.evade_speed = stream.getUint8Array(NDL);

		this.cloak_type = stream.getUint8();
		this.attack_type = stream.getUint8();

		this.see_sound = stream.getUint8();
		this.attack_sound = stream.getUint8();
		this.claw_sound = stream.getUint8();
		this.taunt_sound = stream.getUint8();

		this.boss_flag = stream.getUint8();
		this.companion = stream.getUint8();
		this.smart_blobs = stream.getUint8();
		this.energy_blobs = stream.getUint8();

		this.thief = stream.getUint8();
		this.pursuit = stream.getUint8();
		this.lightcast = stream.getUint8();
		this.death_roll = stream.getUint8();

		this.flags = stream.getUint8();
		stream.position += 3;

		this.deathroll_sound = stream.getUint8();
		this.glow = stream.getUint8();
		this.behavior = stream.getUint8();
		this.aim = stream.getUint8();

		this.anim_states = Array_iterate(MAX_GUNS + 1, () => {
			return Array_iterate(N_ANIM_STATES, () => new JointList().load(stream));
		});

		const always_0xabcd = stream.getUint32();
		// if (always_0xabcd !== 0xabcd)
		// 	throw new Error("corrupted file");

		return this;
	}
}
class RobotJoint {
	jointnum: number;
	angles: Vec3;

	load(stream: DataStream) {
		this.jointnum = stream.getInt16();
		this.angles = stream.getVector2();

		return this;
	}
}
class Ham {
	rgTMapInfos: TMapInfo[];
	rgSounds: number[];
	rgVClips: VClip[];
	rgEClips: EClip[];
	rgWClips: WClip[];
	rgWeaponInfos: WeaponInfo[];
	rgPowerupInfos: PowerupInfo[];
	rgPolygonModels: PolygonModel[];
	rgRobotTypes: RobotType[];

	rgObjBitmaps: number[];
	rgObjBitmapPtrs: number[];
	textureIndices: number[];
	rgSoundFiles: SoundFile[];

	ship: PlayerShip;

	load(view: DataView) {
		const stream = new DataStream(view);

		const sig = stream.getString(4);
		if (sig !== "HAM!") {
			throw new Error("invalid HAM signature: " + sig);
		}

		const version = stream.getUint32();
		if (version < 1 || version > 2) {
			throw new Error("unsupported HAM version: " + version);
		}

		let sound_offset = 0;
		if (version < 3) {
			sound_offset = stream.getUint32();
		}

		const cTextures = stream.getUint32();
		const textureIndices = this.textureIndices = stream.getInt16Array(cTextures);
		this.rgTMapInfos = Array_iterate(cTextures, (iTexture) => {
			const tmi = new TMapInfo().load(stream);
			tmi.textureIndex = textureIndices[iTexture];
			return tmi;
		});

		/*
		const rgTMapInfos = [];
		this.textureIndices.forEach((i) => { rgTMapInfos[i] = new TMapInfo().load(stream); });
		this.rgTMapInfos = rgTMapInfos;
		*/

		const cSounds = stream.getUint32();
		this.rgSounds = stream.getUint8Array(cSounds);
		const rgAltSounds = stream.getUint8Array(cSounds);

		const $this = this;

		const cVClips = stream.getUint32();
		this.rgVClips = Array_iterate(cVClips, () => new VClip().load(stream));

		this.rgVClips[KnownVClips.HOSTAGE].flags |= VClipFlags.ROD;

		const cEClips = stream.getUint32();
		this.rgEClips = Array_iterate(cEClips, () => new EClip().load(stream));

		const cWClips = stream.getUint32();
		this.rgWClips = Array_iterate(cWClips, () => new WClip().load(stream));

		const cRobotTypes = stream.getUint32();
		this.rgRobotTypes = Array_iterate(cRobotTypes, () => new RobotType().load(stream));

		const cRobotJoints = stream.getUint32();
		const rgRobotJoints = Array_iterate(cRobotJoints, () => new RobotJoint().load(stream));

		const cWeaponInfos = stream.getUint32();
		this.rgWeaponInfos = Array_iterate(cWeaponInfos, (iWeapon) => new WeaponInfo().load(stream, version, iWeapon));

		const cPowerupInfos = stream.getUint32();
		this.rgPowerupInfos = Array_iterate(cPowerupInfos, () => new PowerupInfo().load(stream));

		const cPolygonModels = stream.getUint32();
		this.rgPolygonModels = Array_iterate(cPolygonModels, () => new PolygonModel().load(stream));

		for (let iPolygonModel = 0; iPolygonModel < cPolygonModels; ++iPolygonModel) {
			this.rgPolygonModels[iPolygonModel].loadData(stream);
		}

		for (let iPolygonModel = 0; iPolygonModel < cPolygonModels; ++iPolygonModel) {
			this.rgPolygonModels[iPolygonModel].Dying_modelnum = stream.getInt32();
		}

		for (let iPolygonModel = 0; iPolygonModel < cPolygonModels; ++iPolygonModel) {
			this.rgPolygonModels[iPolygonModel].Dead_modelnum = stream.getInt32();
		}

		const cGuages = stream.getInt32();
		const rgGuages = stream.getInt16Array(cGuages);
		const rgGuagesHiRes = stream.getInt16Array(cGuages);

		const cObjBitmaps = stream.getInt32();
		this.rgObjBitmaps = stream.getInt16Array(cObjBitmaps);
		this.rgObjBitmapPtrs = stream.getInt16Array(cObjBitmaps);

		this.ship = new PlayerShip().load(stream);

		// cockpits
		// reactors
		// exit model

		if (version < 3) {
			stream.position = sound_offset;

			const cSounds = stream.getUint32();

			this.rgSoundFiles = Array_iterate(cSounds, () => new SoundFile().load(stream));

			const sound_start = stream.position;
			for (let iSound = this.rgSoundFiles.length; iSound--;) {
				const sf = this.rgSoundFiles[iSound];
				sf.index = iSound;
				const ibStart = sound_start + sf.offset;
				sf.data = new Uint8Array(view, ibStart, sf.length);
			}
		}

		return this;
	}
	playObjectSound(iSound: SoundFile_Sounds, obj: Item) {
		const iSoundFile = this.rgSounds[iSound];
		const sf = this.rgSoundFiles[iSoundFile];
		if (sf) {
			return sf.playObjectSound(obj);
		}
	}
	playSound(iSound: SoundFile_Sounds, pos?: Vec3) {
		const iSoundFile = this.rgSounds[iSound];
		const sf = this.rgSoundFiles[iSoundFile];
		if (sf) {
			return sf.playSound(pos);
		}
	}
	updateEffects(frameTime: number) {
		const rgEffects = this.rgEClips;
		for (let iEffect = rgEffects.length; iEffect--;) {
			const effect = rgEffects[iEffect];
			effect.update(frameTime);
		}
	}
}
const MAX_LASER_LEVEL = 3;   // Note, laser levels are numbered from 0.
const MAX_SUPER_LASER_LEVEL = 5;   // Note, laser levels are numbered from 0.

enum WeaponTypes {
	LASER = 0,	  // 0..3 are lasers
	CONCUSSION = 8,
	FLARE = 9,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	VULCAN = 11,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	SPREADFIRE = 12,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	PLASMA = 13,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	FUSION = 14,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	HOMING = 15,
	PROXIMITY = 16,
	SMART = 17,
	MEGA = 18,

	PLAYER_SMART_HOMING = 19,
	SUPER_MECH_MISS = 21,
	REGULAR_MECH_MISS = 22,
	SILENT_SPREADFIRE = 23,
	ROBOT_SMART_HOMING = 29,
	EARTHSHAKER_MEGA = 54,

	SUPER_LASER = 30,	  // 30,31 are super lasers (level 5,6)

	GAUSS = 32,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	HELIX = 33,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	PHOENIX = 34,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.
	OMEGA = 35,	  //  NOTE                            This MUST correspond to the ID generated at bitmaps.tbl read time.

	FLASH = 36,
	GUIDEDMISS = 37,
	SUPERPROX = 38,
	MERCURY = 39,
	EARTHSHAKER = 40,

	SMART_MINE_HOMING = 47,
	ROBOT_SMART_MINE_HOMING = 49,
	ROBOT_SUPERPROX = 53,
	ROBOT_EARTHSHAKER = 58,

	PMINE = 51,	// the mine that the designers can place
}
enum WeaponRenderTypes {
	NONE = -1,
	LASER = 0,
	BLOB = 1,
	POLYMODEL = 2,
	VCLIP = 3,
}
class WeaponInfo {
	index: WeaponTypes;

	render_type: WeaponRenderTypes;
	persistent: number;
	model_num: number;
	model_num_inner: number;

	flash_vclip: number;
	robot_hit_vclip: number;
	flash_sound: number;

	wall_hit_vclip: number;
	fire_count: number;
	robot_hit_sound: number;

	ammo_usage: number;
	weapon_vclip: number;
	wall_hit_sound: number;

	destroyable: number;
	matter: number;
	bounce: number;
	homing_flag: number;

	speedvar: number;
	flags: number;
	flash: number;
	afterburner_size: number;

	energy_usage: number;
	fire_wait: number;

	multi_damage_scale: number;

	bitmap: number;

	blob_size: number;
	flash_size: number;
	impact_size: number;
	strength: number[];
	speed: number[];
	mass: number;
	drag: number;
	thrust: number;
	po_len_to_width_ratio: number;
	light: number;
	lifetime: number;
	damage_radius: number;
	picture: number;
	hires_picture: number;

	children: number;

	load(stream: DataStream, file_version: number, iWeapon: number) {
		this.index = iWeapon;

		this.render_type = stream.getUint8();
		this.persistent = stream.getUint8();
		this.model_num = stream.getInt16();
		this.model_num_inner = stream.getInt16();

		this.flash_vclip = stream.getUint8();
		this.robot_hit_vclip = stream.getUint8();
		this.flash_sound = stream.getInt16();

		this.wall_hit_vclip = stream.getUint8();
		this.fire_count = stream.getUint8();
		this.robot_hit_sound = stream.getInt16();

		this.ammo_usage = stream.getUint8();
		this.weapon_vclip = stream.getUint8();
		this.wall_hit_sound = stream.getInt16();

		this.destroyable = stream.getUint8();
		this.matter = stream.getUint8();
		this.bounce = stream.getUint8();
		this.homing_flag = stream.getUint8();

		this.speedvar = stream.getUint8();
		this.flags = stream.getUint8();
		this.flash = stream.getUint8();
		this.afterburner_size = stream.getUint8();

		if (file_version >= 3) {
			this.children = stream.getUint8();
		} else {
			switch (iWeapon) {
				case WeaponTypes.SMART:
					this.children = WeaponTypes.PLAYER_SMART_HOMING;
					break;
				case WeaponTypes.SUPERPROX:
					this.children = WeaponTypes.SMART_MINE_HOMING;
					break;
				default:
					this.children = -1;
					break;
			}
		}

		this.energy_usage = stream.getFixed();
		this.fire_wait = stream.getFixed();

		if (file_version >= 3) {
			this.multi_damage_scale = stream.getFixed();
		} else {
			this.multi_damage_scale = 1;
		}

		this.bitmap = stream.getInt16();

		this.blob_size = stream.getFixed();
		this.flash_size = stream.getFixed();
		this.impact_size = stream.getFixed();
		this.strength = stream.getFixedArray(NDL);
		this.speed = stream.getFixedArray(NDL);
		this.mass = stream.getFixed();
		this.drag = stream.getFixed();
		this.thrust = stream.getFixed();
		this.po_len_to_width_ratio = stream.getFixed();
		this.light = stream.getFixed();
		this.lifetime = stream.getFixed();
		this.damage_radius = stream.getFixed();
		this.picture = stream.getInt16();

		if (file_version >= 3) {
			this.hires_picture = stream.getInt16();
		} else {
			this.hires_picture = this.picture;
		}

		return this;
	}

	createObject(parent: Item, pos: Vec3, cube: Cube, dir: Vec3) {
		const obj = new Item(ItemTypes.WEAPON, this.index);

		// const parent = _level.rgObjects[0];
		// orient = Mat3.createLook(parent.orient._[2], parent.orient._[1]);

		obj.link(cube);

		obj.pos = pos;
		obj.size = this.blob_size || 1;
		obj.flags = 0;
		obj.parent = parent;
		if (parent) {
			obj.orient = Mat3.createLook(dir, parent.orient._[1]);
		} else {
			throw new Error("asdasd");
		}// obj.orient = Mat3.I;

		obj.controlType = ControlTypes.WEAPON;
		obj.movementType = MovementTypes.PHYSICS;

		const pi = new PhysicsInfo();
		pi.mass = this.mass;
		pi.drag = this.drag;

		if (this.bounce) {
			pi.flags |= PhysicsFlags.BOUNCE;
			if (this.bounce === 2) {
				pi.flags |= PhysicsFlags.BOUNCES_TWICE;
			}
		}

		let speed = this.speed[_difficultyLevel];
		if (this.speedvar !== 128) {
			speed *= (1 - (this.speedvar * Math.random() / 64));
		}

		if (this.thrust !== 0) {
			speed /= 2;
		}

		pi.velocity = dir.scale(speed);

		let size = this.blob_size;
		let rtype: RenderTypes;
		switch (this.render_type) {
			case WeaponRenderTypes.BLOB:
				rtype = RenderTypes.LASER;
				break;
			case WeaponRenderTypes.POLYMODEL:
				rtype = RenderTypes.POLYOBJ;
				obj.renderInfo = new PolygonRenderInfo(this.model_num);
				size = _ham.rgPolygonModels[this.model_num].rad / this.po_len_to_width_ratio;
				break;
			case WeaponRenderTypes.NONE:
				rtype = RenderTypes.NONE;
				size = 1;
				break;
			case WeaponRenderTypes.VCLIP:
				rtype = RenderTypes.WEAPON_VCLIP;
				break;
			default:
				throw new Error("invalid weapon render type");
		}

		obj.renderType = rtype;
		obj.size = size;
		obj.shields = this.strength[_difficultyLevel];
		obj.multiplier = 1;
		obj.weaponInfo = this;
		obj.mover = pi;

		return obj;
	}

}
class PowerupInfo {
	vclip_num: number;
	hit_sound: number;
	size: number;
	light: number;

	load(stream: DataStream) {
		this.vclip_num = stream.getInt32();
		this.hit_sound = stream.getInt32();
		this.size = stream.getFixed();
		this.light = stream.getFixed();

		return this;
	}
}
const MAX_SUBMODELS = 10;

enum OpCodes {
	EOF = 0,   // eof
	DEFPOINTS = 1,   // defpoints
	FLATPOLY = 2,   // flat-shaded polygon
	TMAPPOLY = 3,   // texture-mapped polygon
	SORTNORM = 4,   // sort by normal
	RODBM = 5,   // rod bitmap
	SUBCALL = 6,   // call a subobject
	DEFP_START = 7,   // defpoints with start
	GLOW = 8,   // glow value for next poly
}
class PolygonModel {
	n_models: number;
	model_data_size: number;

	submodel_ptrs: number[];
	submodel_offsets: Vec3[];
	submodel_norms: Vec3[];
	submodel_pnts: Vec3[];
	submodel_rads: number[];
	submodel_parents: number[];
	submodel_mins: Vec3[];
	submodel_maxs: Vec3[];

	mins: Vec3;
	maxs: Vec3;

	rad: number;
	n_textures: number;
	first_texture: number;
	simpler_model: number;

	model_data: DataStream;

	rgInstructions: Array<(light: any, anim_angles: any) => void>;

	bufferFlatVertexPosition: WebGLBuffer;
	bufferFlatVertexColor: WebGLBuffer;
	bufferVertexPosition: WebGLBuffer;
	bufferVertexTextureCoord: WebGLBuffer;

	Dying_modelnum: number;
	Dead_modelnum: number;

	load(stream: DataStream) {
		this.n_models = stream.getInt32();
		if (this.n_models < 0) {
			throw new Error("invalid count");
		}

		this.model_data_size = stream.getInt32();
		if (this.model_data_size < 0) {
			throw new Error("invalid size");
		}

		stream.getInt32();	// bogus model_data

		this.submodel_ptrs = stream.getInt32Array(MAX_SUBMODELS);
		this.submodel_offsets = stream.getVectorArray(MAX_SUBMODELS);
		this.submodel_norms = stream.getVectorArray(MAX_SUBMODELS);
		this.submodel_pnts = stream.getVectorArray(MAX_SUBMODELS);
		this.submodel_rads = stream.getFixedArray(MAX_SUBMODELS);
		this.submodel_parents = stream.getUint8Array(MAX_SUBMODELS);
		this.submodel_mins = stream.getVectorArray(MAX_SUBMODELS);
		this.submodel_maxs = stream.getVectorArray(MAX_SUBMODELS);

		this.mins = stream.getVector();
		this.maxs = stream.getVector();

		this.rad = stream.getFixed();
		this.n_textures = stream.getUint8();
		this.first_texture = stream.getInt16();
		this.simpler_model = stream.getUint8();

		return this;
	}
	loadData(stream: DataStream) {
		this.model_data = new DataStream(stream.view.slice(stream.position, this.model_data_size));
		stream.position += this.model_data_size;
	}
	render(light: Vec3, anim_angles: Vec3[]) {
		if (!this.rgInstructions) {
			const compile = (position: number) => {
				let rgInstructions: Array<(light: Vec3, anim_angles: Vec3[]) => void> = [];

				const oldPos = data.position;
				data.position = position;

				while (true) {
					const pc = data.position;
					let op: number;
					switch (op = data.getUint16()) {
						case OpCodes.EOF:
							// case OpCodes.GLOW:
							data.position = oldPos;
							return rgInstructions;

						case OpCodes.DEFP_START:
							let n = data.getUint16();
							let s = data.getUint16();
							data.position += 2;
							while (n-- > 0) {
								rgPoints[s++] = data.getVector();
							}
							break;

						case OpCodes.SORTNORM:
							{
								data.position += 2;
								const plane = new Plane3(data.getVector(), data.getVector());
								const addr1 = data.getInt16();
								const addr2 = data.getInt16();

								const sub1 = compile(pc + addr1);
								const sub2 = compile(pc + addr2);

								rgInstructions = rgInstructions.concat(sub1);
								rgInstructions = rgInstructions.concat(sub2);
								break;
							}

						case OpCodes.SUBCALL:
							{

								const iAngle = data.getUint16();

								const pos = data.getVector();

								const addr = data.getInt16();
								const sub = compile(pc + addr);

								rgInstructions.push(((iAngle: number, pos: Vec3, rgInstructions: Array<(light: Vec3, anim_angles: Vec3[]) => void>) => {
									return (light: Vec3, anim_angles: Vec3[]) => {
										const angles = anim_angles ? anim_angles[iAngle] : null;
										const mat = createAngleMatrix(angles, pos);

										if (mat) {
											pushInstanceMatrix(mat);
										}

										const cInstructions = rgInstructions.length;
										for (let i = 0; i < cInstructions; ++i) {
											rgInstructions[i](light, anim_angles);
										}

										if (mat) {
											popMatrix();
										}
									};
								})(iAngle, pos, sub));

								break;
							}
						case OpCodes.TMAPPOLY:
							{
								const nv = data.getUint16();
								const plane = new Plane3(data.getVector(), data.getVector());

								data.position = pc + 28;

								const objBitmap = _ham.rgObjBitmaps[_ham.rgObjBitmapPtrs[$this.first_texture + data.getUint16()]];

								const offset = rgVertexPosition.length / 3;

								for (let i = 0; i < nv; ++i) {
									const pos = rgPoints[data.getUint16()];
									rgVertexPosition.push(pos.x, pos.y, pos.z);
								}

								data.position = pc + 30 + ((nv & ~1) + 1) * 2;

								for (let i = 0; i < nv; ++i) {
									const uvl = data.getVector();
									rgVertexTextureCoord.push(uvl.x, uvl.y);
								}

								data.position = ((data.position - 1) & ~3) + 4;

								data.position = pc + 30 + ((nv & ~1) + 1) * 2 + nv * 12;

								rgInstructions.push(((plane: Plane3, objBitmap: number, offset: number, nv: number) => {
									const tex = _pig.loadBitmap(objBitmap, 1).tex;

									return (light: Vec3, anim_angles: Vec3[]) => {
										// TODO check normal

										useProgram(programLit);
										loadAttribBuffer(programLit.aVertexPosition, this.bufferVertexPosition);
										loadAttribBuffer(programLit.aVertexTextureCoord, this.bufferVertexTextureCoord);

										bindTexture(1, tex);
										gl.drawArrays(gl.TRIANGLE_FAN, offset, nv);
									};
								})(plane, objBitmap, offset, nv));

								break;
							}

						case OpCodes.FLATPOLY:
							{
								const nv = data.getUint16();
								const plane = new Plane3(data.getVector(), data.getVector());

								data.position = pc + 28;

								const color = data.getColor15();

								const offset = rgFlatVertexPosition.length / 3;

								for (let i = 0; i < nv; ++i) {
									const pos = rgPoints[data.getUint16()];
									pos.pushTo(rgFlatVertexPosition);
									color.pushTo(rgFlatVertexColor);
								}

								data.position = pc + 30 + ((nv & ~1) + 1) * 2;

								rgInstructions.push(((plane: Plane3, offset: number, nv: number) => {
									return (light: Vec3, anim_angles: Vec3[]): void => {
										// TODO check normal

										useProgram(programFlat);
										loadAttribBuffer(programFlat.aVertexPosition, this.bufferFlatVertexPosition);
										loadAttribBuffer(programFlat.aVertexColor, this.bufferFlatVertexColor);

										gl.drawArrays(gl.TRIANGLE_FAN, offset, nv);
									};
								})(plane, offset, nv));

								break;
							}

						default:
							throw new Error("unknown OpCode: " + op);
					}
				}
			};
			const data = this.model_data;
			const rgPoints: Vec3[] = [];
			const rgFlatVertexPosition: number[] = [];
			const rgFlatVertexColor: number[] = [];

			const rgVertexPosition: number[] = [];
			const rgVertexTextureCoord: number[] = [];

			const $this = this;
			this.rgInstructions = compile(0);

			if (rgFlatVertexPosition.length) {
				this.bufferFlatVertexPosition = createBuffer(rgFlatVertexPosition, 3);
				this.bufferFlatVertexColor = createBuffer(rgFlatVertexColor, 3);
			}

			if (rgVertexPosition.length) {
				this.bufferVertexPosition = createBuffer(rgVertexPosition, 3);
				this.bufferVertexTextureCoord = createBuffer(rgVertexTextureCoord, 2);
			}
		}

		useProgram(programLit);
		gl.uniform3f(programLit.light, light.x, light.y, light.z);
		useProgram(programFlat);
		gl.uniform3f(programFlat.light, light.x, light.y, light.z);

		const rgInstructions = this.rgInstructions;
		const cInstructions = rgInstructions.length;
		for (let i = 0; i < cInstructions; ++i) {
			rgInstructions[i](light, anim_angles);
		}
	}
}
const N_PLAYER_GUNS = 8;

class PlayerShip {
	model_num: number;
	expl_vclip_num: number;
	mass: number;
	drag: number;
	max_thrust: number;
	reverse_thrust: number;
	brakes: number;
	wiggle: number;
	max_rotthrust: number;
	gun_points: Vec3[];

	load(stream: DataStream) {
		this.model_num = stream.getInt32();
		this.expl_vclip_num = stream.getInt32();
		this.mass = stream.getFixed();
		this.drag = stream.getFixed();
		this.max_thrust = stream.getFixed();
		this.reverse_thrust = stream.getFixed();
		this.brakes = stream.getFixed();
		this.wiggle = stream.getFixed();
		this.max_rotthrust = stream.getFixed();
		this.gun_points = stream.getVectorArray(N_PLAYER_GUNS);

		return this;
	}
}
let _ham: Ham;
