//// <reference path="WebAudio.d.ts" />

/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />
/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />
/// <reference path="Item.ts" />
"use strict";

let _audio: AudioContext;
let _mainAudio: AudioNode;

class SoundFile {
	index: number;
	name: string;
	length: number;
	data_length: number;
	offset: number;

	data: Uint8Array;
	buffer: AudioBuffer;

	load(stream: DataStream) {
		this.name = stream.getString(8);
		this.length = stream.getUint32();
		this.data_length = stream.getUint32();	// ?
		this.offset = stream.getUint32();
		return this;
	}
	getBuffer() {
		let buffer = this.buffer;
		if (!buffer) {
			buffer = this.buffer = _audio.createBuffer(1, this.length, 22050 / 2);
			// buffer.gain.value = 1;
			const rgSamples = buffer.getChannelData(0);
			const data = this.data;
			for (let iSample = this.length; iSample--;) {
				// rgSamples[iSample] = data[iSample] * 2 / 255 - 1;
				rgSamples[iSample] = data[iSample] / 255 - .5;
			}
		}
		return buffer;
	}
	playObjectSound(obj: Item) {
		if (!_audio) {
			return;
		}
		const buffer = this.getBuffer();
		const playingSound = new ItemSound(buffer, obj);
		PlayingSound.play(playingSound);
	}
	playSound(pos?: Vec3) {
		if (!_audio) {
			return;
		}
		const buffer = this.getBuffer();
		const playingSound = pos ? new PositionalSound(buffer, pos) : new PlayingSound(buffer);
		PlayingSound.play(playingSound);
	}
}
enum SoundFile_Sounds {
	LASER_FIRED = 10,

	WEAPON_HIT_DOOR = 27,
	WEAPON_HIT_BLASTABLE = 11,
	BADASS_EXPLOSION = 11, // need something different for this if possible

	ROBOT_HIT_PLAYER = 17,

	ROBOT_HIT = 20,
	ROBOT_DESTROYED = 21,
	VOLATILE_WALL_HIT = 21,
	LASER_HIT_WATER = 232,
	MISSILE_HIT_WATER = 233,

	LASER_HIT_CLUTTER = 30,
	CONTROL_CENTER_HIT = 30,
	EXPLODING_WALL = 31,  // one long sound
	CONTROL_CENTER_DESTROYED = 31,

	CONTROL_CENTER_WARNING_SIREN = 32,
	MINE_BLEW_UP = 33,

	FUSION_WARMUP = 34,
	DROP_WEAPON = 39,

	FORCEFIELD_BOUNCE_PLAYER = 40,
	FORCEFIELD_BOUNCE_WEAPON = 41,
	FORCEFIELD_HUM = 42,
	FORCEFIELD_OFF = 43,

	MARKER_HIT = 50,
	BUDDY_MET_GOAL = 51,

	REFUEL_STATION_GIVING_FUEL = 62,

	PLAYER_HIT_WALL = 70,
	PLAYER_GOT_HIT = 71,

	HOSTAGE_RESCUED = 91,

	BRIEFING_HUM = 94,
	BRIEFING_PRINTING = 95,

	COUNTDOWN_0_SECS = 100, // countdown 100..114
	COUNTDOWN_13_SECS = 113,
	COUNTDOWN_29_SECS = 114,

	HUD_MESSAGE = 117,
	HUD_KILL = 118,

	HOMING_WARNING = 122, // Warning beep= You are being tracked by a missile! Borrowed from old repair center sounds.

	HUD_JOIN_REQUEST = 123,
	HUD_BLUE_GOT_FLAG = 124,
	HUD_RED_GOT_FLAG = 125,
	HUD_YOU_GOT_FLAG = 126,
	HUD_BLUE_GOT_GOAL = 127,
	HUD_RED_GOT_GOAL = 128,
	HUD_YOU_GOT_GOAL = 129,

	LAVAFALL_HISS = 150, // under a lavafall
	VOLATILE_WALL_HISS = 151, // need a hiss sound here.
	SHIP_IN_WATER = 152, // sitting (or moving though) water
	SHIP_IN_WATERFALL = 158, // under a waterfall

	GOOD_SELECTION_PRIMARY = 153,
	BAD_SELECTION = 156,

	GOOD_SELECTION_SECONDARY = 154, // Adam= New sound number here! MK, 01/30/95
	ALREADY_SELECTED = 155, // Adam= New sound number here! MK, 01/30/95

	CLOAK_ON = 160, // USED FOR WALL CLOAK
	CLOAK_OFF = 161, // sound when cloak goes away
	INVULNERABILITY_OFF = 163, // sound when invulnerability goes away

	BOSS_SHARE_SEE = 183,
	BOSS_SHARE_DIE = 185,

	SEE_SOUND_DEFAULT = 170,
	ATTACK_SOUND_DEFAULT = 171,
	CLAW_SOUND_DEFAULT = 190,

	DROP_BOMB = 26,

	CHEATER = 200,

	AMBIENT_LAVA = 222,
	AMBIENT_WATER = 223,

	CONVERT_ENERGY = 241,
	WEAPON_STOLEN = 244,

	LIGHT_BLOWNUP = 157,

	WALL_REMOVED = 246, // Wall removed, probably due to a wall switch.
	AFTERBURNER_IGNITE = 247,
	AFTERBURNER_PLAY = 248,

	SECRET_EXIT = 249,

	SEISMIC_DISTURBANCE_START = 251,

	YOU_GOT_ORB = 84,
	FRIEND_GOT_ORB = 85,
	OPPONENT_GOT_ORB = 86,
	OPPONENT_HAS_SCORED = 87,

	BIG_ENDLEVEL_EXPLOSION = EXPLODING_WALL,
	TUNNEL_EXPLOSION = EXPLODING_WALL,
	ROBOT_SUCKED_PLAYER = ROBOT_HIT_PLAYER, // Robot sucked energy from player.
	WALL_CLOAK_ON = CLOAK_ON,
	WALL_CLOAK_OFF = CLOAK_OFF,
}
// SoundFile_Sounds = freeze(SoundFile_Sounds);

class PlayingSound {
	static rgPlayingSounds: PlayingSound[] = [];

	static play(sound: PlayingSound) {
		PlayingSound.rgPlayingSounds.push(sound);
		sound.play();
	}
	static update() {
		const rgPlayingSounds = PlayingSound.rgPlayingSounds;
		for (let iPlayingSound = rgPlayingSounds.length; iPlayingSound--;) {
			const playingSound = rgPlayingSounds[iPlayingSound];
			if (!playingSound.update()) {
				rgPlayingSounds.swapOut(iPlayingSound);
			}
		}
	}

	sourceNode: any;

	constructor(public buffer: AudioBuffer) {
	}

	play() {
		this.createSourceNode(this.buffer);
		this.update();
		this.sourceNode.start(0);
	}

	createSourceNode(buffer: AudioBuffer) {
		const sourceNode = this.sourceNode = _audio.createBufferSource();
		sourceNode.buffer = buffer;
		// sourceNode.playbackRate.value = .5;
		sourceNode.connect(_mainAudio);
	}

	update() {
		// do nothing
	}
}

class PannerSound extends PlayingSound {
	pannerNode: PannerNode;

	createSourceNode(buffer: AudioBuffer) {
		const sourceNode = this.sourceNode = _audio.createBufferSource();
		sourceNode.buffer = buffer;
		// sourceNode.playbackRate.value = .5;

		const pannerNode = this.pannerNode = _audio.createPanner();
		pannerNode.panningModel = "equalpower";
		pannerNode.distanceModel = "inverse";
		pannerNode.refDistance = 2;
		pannerNode.rolloffFactor = .5;

		sourceNode.connect(pannerNode);
		pannerNode.connect(_mainAudio);
	}
}
class PositionalSound extends PannerSound {
	constructor(buffer: AudioBuffer, public pos: Vec3) {
		super(buffer);
		notNull(this.pos);
	}

	update() {
		const pos = this.pos;
		this.pannerNode.setPosition(pos.x, pos.y, pos.z);
		return this.sourceNode.playbackState !== this.sourceNode.FINISHED_STATE;
	}
}
class ItemSound extends PannerSound {
	constructor(buffer: AudioBuffer, public obj: Item) {
		super(buffer);
		notNull(this.obj);
	}

	update() {
		const obj = this.obj;

		const pos = obj.pos;
		this.pannerNode.setPosition(pos.x, pos.y, pos.z);

		/*
		const pi = obj.mover;
		if (pi) {
			const vel = pi.velocity;
			// this.pannerNode.setVelocity(vel.x, vel.y, vel.z);
			this.pannerNode.setVelocity(0, 0, 0);
		}
		*/

		return this.sourceNode.playbackState !== this.sourceNode.FINISHED_STATE;
	}
}
