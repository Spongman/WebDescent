/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />

/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />
"use strict";

var MAX_ENERGY = 200;
var MAX_SHIELDS = 200;

var VULCAN_AMMO_MAX = (392 * 4);
var VULCAN_WEAPON_AMMO_AMOUNT = 196;
var VULCAN_AMMO_AMOUNT = (49 * 2);
var GAUSS_WEAPON_AMMO_AMOUNT = 392;

var _difficultyLevel = 0;


enum PlayerFlags
{
	INVULNERABLE = (1<<0),	// Player is invincible
	BLUE_KEY     = (1<<1),	// Player has blue key
	RED_KEY      = (1<<2),	// Player has red key
	GOLD_KEY     = (1<<3),	// Player has gold key
	FLAG         = (1<<4),	// Player has his team's flag
	UNUSED       = (1<<5),	//
	MAP_ALL      = (1<<6),	// Player can see unvisited areas on map
	AMMO_RACK    = (1<<7),	// Player has ammo rack
	CONVERTER    = (1<<8),	// Player has energy->shield converter
	QUAD_LASERS  = (1<<9),	// Player shoots 4 at once
	CLOAKED      = (1<<10),	// Player is cloaked for awhile
	AFTERBURNER  = (1<<11),	// Player's afterburner is engaged
	HEADLIGHT    = (1<<12),	// Player has headlight boost
	HEADLIGHT_ON = (1<<13),	// is headlight on or off?
}
class Player
{
	score:number;
	lives:number;
	level:number;
	keys:number;
	shields:number;
	energy:number;
	laser_level:number;
	flags:PlayerFlags;

	primary_weapon:number;
	primary_weapon_flags:number;
	primary_ammo:number[];

	vulcan_ammo:number;

	secondary_weapon:number;
	secondary_weapon_flags:number;
	secondary_ammo:number[];

	constructor ()
	{
		this.reset();
	}
	reset ()
	{
		this.score = 0;
		this.lives = 3;
		this.level = 1;
		this.keys = 0;
		this.shields = 100;
		this.energy = 100;
		this.laser_level = 0;
		this.flags = 0;

		this.primary_weapon = 0;
		this.primary_weapon_flags = 0;
		this.primary_ammo = [];

		this.vulcan_ammo = 0;

		this.secondary_weapon = 0;
		this.secondary_weapon_flags = 0;
		this.secondary_ammo = [];
	}
	pickUpPowerup (idPowerupType:PowerupTypes)
	{
		var fAlreadyHave = false;

		if (PowerupPrimaryFlags[idPowerupType])
			fAlreadyHave = !!(this.primary_weapon_flags & PowerupPrimaryFlags[idPowerupType]);
		else if (PowerupSecondaryFlags[idPowerupType])
			fAlreadyHave = !!(this.secondary_weapon_flags & PowerupSecondaryFlags[idPowerupType]);
		else if (PowerupPlayerFlags[idPowerupType])
			fAlreadyHave = !!(this.flags & PowerupPlayerFlags[idPowerupType]);

		switch (idPowerupType)
		{
			case PowerupTypes.EXTRA_LIFE:
				this.lives++;
				return true;

			case PowerupTypes.ENERGY:
				return this.pickUpEnergy();

			case PowerupTypes.SHIELD_BOOST:
				return this.pickUpShields();

			case PowerupTypes.LASER:
				if (this.laser_level < MAX_LASER_LEVEL)
				{
					this.laser_level++;
					return true;
				}
				break;

			//case PowerupTypes.SUPER_LASER:


			case PowerupTypes.SPREADFIRE_WEAPON:
			case PowerupTypes.PLASMA_WEAPON:
			case PowerupTypes.FUSION_WEAPON:
			case PowerupTypes.HELIX_WEAPON:
			case PowerupTypes.PHOENIX_WEAPON:
				return this.pickUpPrimary(idPowerupType);

			case PowerupTypes.VULCAN_WEAPON:
				return this.pickUpVulcan();

			case PowerupTypes.VULCAN_AMMO:
				return this.pickUpVulcanAmmo();

			case PowerupTypes.GAUSS_WEAPON:
				return this.pickUpGauss();

			case PowerupTypes.KEY_BLUE:
			case PowerupTypes.KEY_RED:
			case PowerupTypes.KEY_GOLD:
				if (!fAlreadyHave)
				{
					this.flags |= PowerupPlayerFlags[idPowerupType];
					return true;
				}
				break;

			case PowerupTypes.MISSILE_1:
			case PowerupTypes.SMARTBOMB_WEAPON:
			case PowerupTypes.MEGA_WEAPON:
			case PowerupTypes.SMISSILE1_1:
			case PowerupTypes.GUIDED_MISSILE_1:
			case PowerupTypes.MERCURY_MISSILE_1:
			case PowerupTypes.HOMING_AMMO_1:
			case PowerupTypes.EARTHSHAKER_MISSILE:
				return this.pickUpSecondary(idPowerupType, 1);

			case PowerupTypes.MISSILE_4:
			case PowerupTypes.PROXIMITY_WEAPON:
			case PowerupTypes.SMISSILE1_4:
			case PowerupTypes.GUIDED_MISSILE_4:
			case PowerupTypes.SMART_MINE:
			case PowerupTypes.MERCURY_MISSILE_4:
			case PowerupTypes.HOMING_AMMO_4:
				return this.pickUpSecondary(idPowerupType, 4);

			case PowerupTypes.QUAD_FIRE:
			case PowerupTypes.AMMO_RACK:
			case PowerupTypes.FULL_MAP:
			case PowerupTypes.CONVERTER:
			case PowerupTypes.HEADLIGHT:
			case PowerupTypes.AFTERBURNER:
			case PowerupTypes.INVULNERABILITY:
			case PowerupTypes.CLOAK:
				if (fAlreadyHave)
					return this.pickUpEnergy();
				this.flags |= PowerupPlayerFlags[idPowerupType];
				return true;

			case PowerupTypes.OMEGA_WEAPON:
			case PowerupTypes.TURBO:
			case PowerupTypes.MEGAWOW:
				/* network
				case PowerupTypes.FLAG_BLUE:
				case PowerupTypes.FLAG_RED:
				case PowerupTypes.HOARD_ORB:
				*/
				break;
		}

		return false;
	}
	pickUpEnergy ()
	{
		if (this.energy >= MAX_ENERGY)
			return false;

		var boost = 3 * (NDL - _difficultyLevel + 1);
		if (_difficultyLevel === 0)
			boost += boost / 2;
		this.energy = Math.min(this.energy + boost, MAX_ENERGY);
		return true;
	}
	pickUpShields ()
	{
		if (this.shields >= MAX_SHIELDS)
			return false;

		var boost = 3 + 3 * (NDL - _difficultyLevel);
		if (_difficultyLevel === 0)
			boost += boost/2;
		this.shields = Math.min(this.shields + boost, MAX_SHIELDS);
		return true;
	}
	pickUpPrimary (idPowerupType:PowerupTypes)
	{
		var iPrimary = PowerupPrimaryFlags[idPowerupType];
		if (this.primary_weapon_flags & (1 << iPrimary))
			return this.pickUpEnergy();

		this.primary_weapon_flags |= (1 << iPrimary);
		return true;
	}
	pickUpSecondary (idPowerupType:PowerupTypes, count:number)
	{
		var iSecondary = PowerupPrimaryFlags[idPowerupType];
		if (this.secondary_weapon_flags & (1 << iSecondary))
		{
			var max = Player.secondary_ammo_max[iSecondary];
			if (this.flags & PlayerFlags.AMMO_RACK)
				max *= 2;

			if (this.secondary_ammo[iSecondary] >= max)
				return false;

			this.secondary_ammo[iSecondary] = Math.min (max, this.secondary_ammo[iSecondary] + count);
		}
		else
		{
			this.secondary_weapon_flags |= (1 << iSecondary);
			this.secondary_ammo[iSecondary] = 0;
		}
		return true;
	}
	pickUpVulcan ()
	{
		_player.primary_weapon_flags |= (1 << PrimaryWeaponIndex.VULCAN);
		return this.pickUpVulcanAmmo(VULCAN_WEAPON_AMMO_AMOUNT);
	}
	pickUpGauss ()
	{
		_player.primary_weapon_flags |= (1 << PrimaryWeaponIndex.GAUSS);
		return this.pickUpVulcanAmmo(GAUSS_WEAPON_AMMO_AMOUNT);
	}
	pickUpVulcanAmmo (count = VULCAN_AMMO_AMOUNT)
	{
		if (this.vulcan_ammo >= VULCAN_AMMO_MAX)
			return false;

		this.vulcan_ammo = Math.min(this.vulcan_ammo + count, VULCAN_AMMO_MAX);
		return true;
	}
	hasKeys (doorKeys:DoorKeys)
	{
		var flags = this.flags;

		if ((doorKeys & DoorKeys.BLUE) && !(flags & PlayerFlags.BLUE_KEY))
			return false;

		if ((doorKeys & DoorKeys.RED) && !(flags & PlayerFlags.RED_KEY))
			return false;

		if ((doorKeys & DoorKeys.GOLD) && !(flags & PlayerFlags.GOLD_KEY))
			return false;

		return true;
	}
	static secondary_ammo_max = [20, 10, 10, 5, 5, 20, 20, 15, 10, 10];

}
var _player = new Player();




enum PrimaryWeaponIndex
{
	LASER       = 0,
	VULCAN      = 1,
	SPREADFIRE  = 2,
	PLASMA      = 3,
	FUSION      = 4,
	SUPER_LASER = 5,
	GAUSS       = 6,
	HELIX       = 7,
	PHOENIX     = 8,
	OMEGA       = 9,
}
var PowerupPrimaryFlags: { [index: number]: PrimaryWeaponIndex } = (function ()
{
	var rg: { [index: number]: PrimaryWeaponIndex } = {};

	rg[PowerupTypes.LASER] = PrimaryWeaponIndex.LASER;
	rg[PowerupTypes.VULCAN_WEAPON] = PrimaryWeaponIndex.VULCAN;
	rg[PowerupTypes.SPREADFIRE_WEAPON] = PrimaryWeaponIndex.SPREADFIRE;
	rg[PowerupTypes.PLASMA_WEAPON] = PrimaryWeaponIndex.PLASMA;
	rg[PowerupTypes.FUSION_WEAPON] = PrimaryWeaponIndex.FUSION;
	rg[PowerupTypes.SUPER_LASER] = PrimaryWeaponIndex.SUPER_LASER;
	rg[PowerupTypes.GAUSS_WEAPON] = PrimaryWeaponIndex.GAUSS;
	rg[PowerupTypes.HELIX_WEAPON] = PrimaryWeaponIndex.HELIX;
	rg[PowerupTypes.PHOENIX_WEAPON] = PrimaryWeaponIndex.PHOENIX;
	rg[PowerupTypes.OMEGA_WEAPON] = PrimaryWeaponIndex.OMEGA;

	return rg;

})();


enum SecondaryWeaponIndex
{
	CONCUSSION  = 0,
	HOMING      = 1,
	PROXIMITY   = 2,
	SMART       = 3,
	MEGA        = 4,
	SMISSILE1   = 5,
	GUIDED      = 6,
	SMART_MINE  = 7,
	SMISSILE4   = 8,
	SMISSILE5   = 9,
}
var PowerupSecondaryFlags: { [index: number]: SecondaryWeaponIndex } = (function ()
{
	var rg: { [index: number]: SecondaryWeaponIndex } = {};

	rg[PowerupTypes.MISSILE_1] = SecondaryWeaponIndex.CONCUSSION;
	rg[PowerupTypes.MISSILE_4] = SecondaryWeaponIndex.CONCUSSION;
	rg[PowerupTypes.HOMING_AMMO_1] = SecondaryWeaponIndex.HOMING;
	rg[PowerupTypes.HOMING_AMMO_4] = SecondaryWeaponIndex.HOMING;
	rg[PowerupTypes.PROXIMITY_WEAPON] = SecondaryWeaponIndex.PROXIMITY;
	rg[PowerupTypes.SMARTBOMB_WEAPON] = SecondaryWeaponIndex.SMART;
	rg[PowerupTypes.MEGA_WEAPON] = SecondaryWeaponIndex.MEGA;
	rg[PowerupTypes.SMISSILE1_1] = SecondaryWeaponIndex.SMISSILE1;
	rg[PowerupTypes.SMISSILE1_4] = SecondaryWeaponIndex.SMISSILE1;
	rg[PowerupTypes.GUIDED_MISSILE_1] = SecondaryWeaponIndex.GUIDED;
	rg[PowerupTypes.GUIDED_MISSILE_4] = SecondaryWeaponIndex.GUIDED;
	rg[PowerupTypes.SMART_MINE] = SecondaryWeaponIndex.SMART_MINE;
	rg[PowerupTypes.MERCURY_MISSILE_1] = SecondaryWeaponIndex.SMISSILE4;
	rg[PowerupTypes.MERCURY_MISSILE_4] = SecondaryWeaponIndex.SMISSILE4;
	rg[PowerupTypes.EARTHSHAKER_MISSILE] = SecondaryWeaponIndex.SMISSILE5;

	return rg;
})();

var PowerupPlayerFlags: { [index: number]: PlayerFlags } = (function ()
{
	var rg: { [index: number]: PlayerFlags } = {};

	rg[PowerupTypes.INVULNERABILITY] = PlayerFlags.INVULNERABLE;
	rg[PowerupTypes.KEY_BLUE] = PlayerFlags.BLUE_KEY;
	rg[PowerupTypes.KEY_RED] = PlayerFlags.RED_KEY;
	rg[PowerupTypes.KEY_GOLD] = PlayerFlags.GOLD_KEY;
	//rg[PowerupTypes.] = PlayerFlags.FLAG;
	//rg[PowerupTypes.] = PlayerFlags.UNUSED;
	rg[PowerupTypes.FULL_MAP] = PlayerFlags.MAP_ALL;
	rg[PowerupTypes.AMMO_RACK] = PlayerFlags.AMMO_RACK;
	rg[PowerupTypes.CONVERTER] = PlayerFlags.CONVERTER;
	rg[PowerupTypes.QUAD_FIRE] = PlayerFlags.QUAD_LASERS;
	rg[PowerupTypes.CLOAK] = PlayerFlags.CLOAKED;
	rg[PowerupTypes.AFTERBURNER] = PlayerFlags.AFTERBURNER;
	rg[PowerupTypes.HEADLIGHT] = PlayerFlags.HEADLIGHT;

	return rg;
})();