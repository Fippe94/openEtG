"use strict";
var MersenneTwister = require("./MersenneTwister");
var Actives = require("./Actives");
var Effect = require("./Effect");
var ui = require("./uiutil");
var etgutil = require("./etgutil");
var Cards = require("./Cards");
function Game(seed, flip){
	this.rng = new MersenneTwister(seed);
	this.phase = MulliganPhase1;
	this.ply = 0;
	this.player1 = new Player(this);
	this.player2 = new Player(this);
	this.player1.foe = this.player2;
	this.player2.foe = this.player1;
	this.turn = (seed < etgutil.MAX_INT/2) === !flip ? this.player1 : this.player2;
	this.expectedDamage = [0, 0];
	this.time = Date.now();
}
var statuscache = {};
var activecache = {};
var activecastcache = {};
function parseActive(name){
	if (name in Actives){
		return Actives[name];
	}else{
		var spidx = name.indexOf(" ");
		if (~spidx){
			Actives[name] = Actives[name.slice(0, spidx)](name.slice(spidx+1));
			Actives[name].activename = [name];
			return Actives[name];
		}
	}
	console.log("Unknown active", name);
}
function Card(type, info){
	this.type = type;
	this.element = parseInt(info.E);
	this.name = info.Name;
	this.code = info.Code;
	if ((parseInt(this.code, 32)&0x3FFF) > 6999){
		this.upped = true;
	}
	if (info.Attack){
		this.attack = parseInt(info.Attack);
	}
	if (info.Health){
		this.health = parseInt(info.Health);
	}
	if (info.Cost){
		this.readCost("cost", info.Cost);
	}
	if (info.Active){
		if (this.type == SpellEnum){
			this.active = parseActive(info.Active);
		}else if (info.Active in activecache){
			this.active = activecache[info.Active];
			var castinfo = activecastcache[info.Active];
			if (castinfo){
				this.cast = castinfo[0];
				this.castele = castinfo[1];
			}
		}else{
			activecache[info.Active] = this.active = {};
			var actives = info.Active.split("+");
			for(var i=0; i<actives.length; i++){
				var active = actives[i].split("=");
				if (active.length == 1){
					this.active.auto = parseActive(active[0]);
				}else{
					var iscast = this.readCost("cast", active[0]);
					this.active[iscast?"cast":active[0]] = parseActive(active[1]);
					if (iscast) activecastcache[info.Active] = [this.cast, this.castele];
				}
			}
			Object.freeze(this.active);
		}
	}
	if (info.Status){
		if (info.Status in statuscache){
			this.status = statuscache[info.Status];
		}else{
			statuscache[info.Status] = this.status = {};
			var statuses = info.Status.split("+");
			for(var i=0; i<statuses.length; i++){
				var status = statuses[i].split("=");
				this.status[status[0]] = status.length==1 || parseInt(status[1]);
			}
			Object.freeze(this.status);
		}
	}
	if (info.Text){
		this.text = info.Text;
	}
	if (info.Rarity){
		this.rarity = parseInt(info.Rarity);
	}
	Object.freeze(this);
}
function Thing(card, owner){
	this.owner = owner;
	this.card = card;
	if (this.status){
		for (var key in this.status){
			if (key in passives) delete this.status[key];
		}
		for (var key in card.status){
			this.status[key] = card.status[key];
		}
	}else{
		this.status = clone(card.status)
	}
	this.active = clone(card.active);
}
function Player(game){
	this.game = game;
	this.owner = this;
	this.shield = undefined;
	this.weapon = undefined;
	this.status = {poison:0};
	this.neuro = false;
	this.sosa = 0;
	this.silence = false;
	this.sanctuary = false;
	this.precognition = false;
	this.gpull = undefined;
	this.nova = 0;
	this.maxhp = this.hp = 100;
	this.deckpower = 1;
	this.hand = [];
	this.deck = [];
	this.creatures = new Array(23);
	this.permanents = new Array(16);
	this.mark = 0;
	this.quanta = [];
	for(var i=1; i<13; i++)this.quanta[i]=0;
	this.shardgolem = undefined;
}
function Creature(card, owner){
	this.usedactive = true;
	if (card.isOf(Cards.ShardGolem)){
		this.card = card;
		this.owner = owner;
		var golem = owner.shardgolem || { stat: 1, cast: 0 };
		this.atk = this.maxhp = this.hp = golem.stat;
		this.cast = golem.cast;
		this.castele = Earth;
		this.active = clone(golem.active);
		this.status = clone(golem.status);
	}else this.transform(card, owner);
}
function Permanent(card, owner){
	this.usedactive = true;
	this.cast = card.cast;
	this.castele = card.castele;
	Thing.apply(this, arguments);
}
function Weapon(card, owner){
	this.atk = card.attack;
	Permanent.apply(this, arguments);
}
function Shield(card, owner){
	this.dr = card.health;
	Permanent.apply(this, arguments);
}
function Pillar(card, owner){
	Thing.apply(this, arguments);
}
function CardInstance(card, owner){
	this.owner = owner;
	this.card = card;
}
Player.prototype = Object.create(Thing.prototype);
Creature.prototype = Object.create(Thing.prototype);
Permanent.prototype = Object.create(Thing.prototype);
Weapon.prototype = Object.create(Permanent.prototype);
Shield.prototype = Object.create(Permanent.prototype);
Pillar.prototype = Object.create(Permanent.prototype);
CardInstance.prototype = Object.create(Thing.prototype);
Object.defineProperty(CardInstance.prototype, "active", { get: function() { return this.card.active; }});
Object.defineProperty(CardInstance.prototype, "status", { get: function() { return this.card.status; }});
Object.defineProperty(Card.prototype, "shiny", { get: function() { return this.code > "fvv"; }});
Card.prototype.rarity = 0;
Card.prototype.attack = 0;
Card.prototype.health = 0;
Card.prototype.cost = 0;
Card.prototype.upped = false;
Card.prototype.status = {};
Card.prototype.active = {};
Player.prototype.markpower = 1;
var Chroma = 0, Entropy = 1, Death = 2, Gravity = 3, Earth = 4, Life = 5, Fire = 6, Water = 7, Light = 8, Air = 9, Time = 10, Darkness = 11, Aether = 12;
var PillarEnum = 0, WeaponEnum = 1, ShieldEnum = 2, PermanentEnum = 3, SpellEnum = 4, CreatureEnum = 5;
var MulliganPhase1 = 0, MulliganPhase2 = 1, PlayPhase = 2, EndPhase = 3;
var passives = Object.freeze({ airborne: true, aquatic: true, nocturnal: true, voodoo: true, swarm: true, ranged: true, additive: true, stackable: true, salvage: true, token: true, poisonous: true, martyr: true, decrsteam: true, beguilestop: true, bounce: true, dshieldoff: true, salvageoff: true, golem: true, obsession: true, virtue: true });
var PlayerRng = Object.create(Player.prototype);
PlayerRng.rng = Math.random;
PlayerRng.upto = function(x){ return Math.floor(Math.random()*x); }
PlayerRng.uptoceil = function(x){ return Math.ceil((1-Math.random())*x); }
Game.prototype.clone = function(){
	var obj = Object.create(Game.prototype);
	obj.rng = this.rng.clone();
	obj.phase = this.phase;
	obj.player1 = this.player1.clone(obj);
	obj.player2 = this.player2.clone(obj);
	obj.player1.foe = obj.player2;
	obj.player2.foe = obj.player1;
	obj.turn = this.turn == this.player1 ? obj.player1 : obj.player2;
	return obj;
}
Game.prototype.players = function(n){
	return n ? this.player2 : this.player1;
}
Game.prototype.setWinner = function(play){
	if (!this.winner){
		this.winner = play;
		this.phase = EndPhase;
		if (this.time) this.time = Date.now() - this.time;
	}
}
Game.prototype.progressMulligan = function(){
	if (this.phase == MulliganPhase1){
		this.phase = MulliganPhase2;
	}else if(this.phase == MulliganPhase2){
		this.phase = PlayPhase;
	}else{
		console.log("Not mulligan phase: " + game.phase);
		return;
	}
	this.turn = this.turn.foe;
}
var blacklist = { flip: true, seed: true, p1deckpower: true, p2deckpower: true, deck: true, urdeck: true };
Game.prototype.addData = function(data) {
	for (var key in data) {
		if (!(key in blacklist)){
			var p1or2 = key.match(/^p(1|2)/);
			if (p1or2){
				this["player" + p1or2[1]][key.slice(2)] = data[key];
			}else this[key] = data[key];
		}
	}
}
function removeSoPa(p){
	if (p){
		delete p.status.patience;
	}
}
Game.prototype.updateExpectedDamage = function(){
	if (this.expectedDamage){
		this.expectedDamage[0] = this.expectedDamage[1] = 0;
		if (!this.winner){
			Effect.disable = true;
			for(var i = 0; i<3; i++){
				var gclone = this.clone();
				gclone.player1.permanents.forEach(removeSoPa);
				gclone.player2.permanents.forEach(removeSoPa);
				gclone.rng.seed(gclone.rng.mt[0]^(i*997));
				gclone.turn.endturn();
				if (!gclone.winner) gclone.turn.endturn();
				this.expectedDamage[0] += this.player1.hp - gclone.player1.hp;
				this.expectedDamage[1] += this.player2.hp - gclone.player2.hp;
			}
			Effect.disable = false;
			this.expectedDamage[0] = Math.round(this.expectedDamage[0]/3);
			this.expectedDamage[1] = Math.round(this.expectedDamage[1]/3);
		}
	}
}
Game.prototype.tgtToBits = function(x) {
	var bits;
	if (x == undefined) {
		return 0;
	} else if (x instanceof Player) {
		bits = 1;
	} else if (x instanceof Weapon) {
		bits = 17;
	} else if (x instanceof Shield) {
		bits = 33;
	} else {
		bits = (x instanceof Creature ? 2 : x instanceof Permanent ? 4 : 5) | x.getIndex() << 4;
	}
	if (x.owner == this.player2) {
		bits |= 8;
	}
	return bits;
}
Game.prototype.bitsToTgt = function(x) {
	var tgtop = x & 7, player = this.players(!(x & 8));
	if (tgtop == 0) {
		return undefined;
	} else if (tgtop == 1) {
		return player[["owner", "weapon", "shield"][x >> 4]];
	} else if (tgtop == 2) {
		return player.creatures[x >> 4];
	} else if (tgtop == 4) {
		return player.permanents[x >> 4];
	} else if (tgtop == 5) {
		return player.hand[x >> 4];
	} else console.log("Unknown tgtop: " + tgtop + ", " + x);
}
Game.prototype.getTarget = function(src, active, cb) {
	var targetingFilter = Cards.Targeting[active.activename[0]];
	if (targetingFilter) {
		this.targetingMode = function(t) { return (t instanceof Player || t instanceof CardInstance || t.owner == this.turn || t.status.cloak || !t.owner.isCloaked()) && targetingFilter(src, t); }
		this.targetingModeCb = cb;
		this.targetingText = active.activename[0];
	} else cb();
}
Player.prototype.shuffle = function(array) {
	var counter = array.length, temp, index;
	while (counter--) {
		index = this.upto(counter)|0;
		temp = array[counter];
		array[counter] = array[index];
		array[index] = temp;
	}
	return array;
}
function fromTrueMark(x){
	var code = parseInt(x, 32);
	return code >= 9010 && code <= 9022 ? code-9010 : -1;
}
function toTrueMark(n){
	return (n+9010).toString(32);
}
function place(array, item){
	for (var i=0; i<array.length; i++){
		if (!array[i]){
			return array[i] = item;
		}
	}
}
function clone(obj){
	var result = {};
	for(var key in obj){
		result[key] = obj[key];
	}
	return result;
}
function objinfo(obj, info){
	if (!info) info = [];
	for (var key in obj){
		var val = obj[key];
		if (val===true) info.push(key);
		else if (val) info.push(val + key);
	}
	return info;
}
function combineactive(a1, a2){
	if (!a1){
		return a2;
	}
	var combine = function(){
		var v1 = a1.apply(null, arguments), v2 = a2.apply(null, arguments);
		return v1 === undefined ? v2 : v2 === undefined ? v1 : v1 === true || v2 === true ? true : v1+v2;
	}
	combine.activename = a1.activename.concat(a2.activename);
	return combine;
}
function isEmpty(obj){
	for(var key in obj){
		if (obj[key] !== undefined){
			return false;
		}
	}
	return true;
}

Player.prototype.clone = function(game){
	var obj = Object.create(Player.prototype);
	function maybeClone(x){
		return x && x.clone(obj);
	}
	obj.status = clone(this.status);
	obj.shield = maybeClone(this.shield);
	obj.weapon = maybeClone(this.weapon);
	obj.creatures = this.creatures.map(maybeClone);
	obj.permanents = this.permanents.map(maybeClone);
	if (this.gpull){
		obj.gpull = obj.creatures[this.gpull.getIndex()];
	}
	obj.hand = this.hand.map(maybeClone);
	obj.deck = this.deck.slice();
	obj.quanta = this.quanta.slice();
	obj.game = game;
	obj.owner = obj;
	for(var attr in this){
		if (!(attr in obj) && this.hasOwnProperty(attr)){
			obj[attr] = this[attr];
		}
	}
	return obj;
}
CardInstance.prototype.clone = function(owner){
	return new CardInstance(this.card, owner);
}
;[Creature, Permanent, Weapon, Shield, Pillar].forEach(function(type){
	var proto = type.prototype;
	proto.clone = function(owner){
		var obj = Object.create(proto);
		obj.active = clone(this.active);
		obj.status = clone(this.status);
		obj.owner = owner;
		for(var attr in this){
			if (!(attr in obj) && this.hasOwnProperty(attr)){
				obj[attr] = this[attr];
			}
		}
		return obj;
	}
});
CardInstance.prototype.hash = function(){
	return parseInt(this.card.code, 32) << 1 | (this.owner == this.owner.game.player1?1:0);
}
function hashString(str){
	var hash = 0;
	for (var i=0; i<str.length; i++){
		hash = hash*31 + str.charCodeAt(i) & 0x7FFFFFFF;
	}
	return hash;
}
function hashObj(obj){
	var hash = 0;
	for (var key in obj){
		hash ^= hashString(key) ^ obj[key];
	}
	return hash;
}
Creature.prototype.hash = function(){
	var hash = this.owner == this.owner.game.player1 ? 17 : 19;
	hash ^= hashObj(this.status) ^ (this.hp*17 + this.atk*31 - this.maxhp - this.usedactive * 3);
	hash ^= parseInt(this.card.code, 32);
	for (var key in this.active){
		hash ^= hashString(key + ":" + this.active[key].activename.join(" "));
	}
	if (this.active.cast){
		hash ^= this.cast * 7 + this.castele * 23;
	}
	return hash & 0x7FFFFFFF;
}
Permanent.prototype.hash = function(){
	var hash = this.owner == this.owner.game.player1 ? 5351 : 5077;
	hash ^= hashObj(this.status) ^ (this.usedactive * 3);
	hash ^= parseInt(this.card.code, 32);
	for (var key in this.active){
		hash ^= hashString(key + "=" + this.active[key].activename.join(" "));
	}
	if (this.active.cast){
		hash ^= this.cast * 7 + this.castele * 23;
	}
	return hash & 0x7FFFFFFF;
}
Weapon.prototype.hash = function(){
	var hash = this.owner == this.owner.game.player1 ? 13 : 11;
	hash ^= hashObj(this.status) ^ (this.atk*31 - this.usedactive * 3);
	hash ^= parseInt(this.card.code, 32);
	for (var key in this.active){
		hash ^= hashString(key + "-" + this.active[key].activename.join(" "));
	}
	if (this.active.cast){
		hash ^= this.cast * 7 + this.castele * 23;
	}
	return hash & 0x7FFFFFFF;
}
Shield.prototype.hash = function(){
	var hash = this.owner == this.owner.game.player1 ? 5009 : 4259;
	hash ^= hashObj(this.status) ^ (this.dr*31 - this.usedactive * 3);
	hash ^= parseInt(this.card.code, 32);
	for (var key in this.active){
		hash ^= hashString(key + "~" + this.active[key].activename.join(" "));
	}
	if (this.active.cast){
		hash ^= this.cast * 7 + this.castele * 23;
	}
	return hash & 0x7FFFFFFF;
}
Pillar.prototype.hash = function(){
	var hash = this.owner == this.owner.game.player1 ? 3917 : 2789;
	hash ^= hashObj(this.status);
	hash ^= parseInt(this.card.code, 32);
	for (var key in this.active){
		hash ^= hashString(key + "_" + this.active[key].activename.join(" "));
	}
	return hash & 0x7FFFFFFF;
}
Card.prototype.readCost = function(attr, cost){
	var c=cost.split(":");
	var cost = parseInt(c[0]);
	if (isNaN(cost))return;
	this[attr] = cost;
	this[attr+"ele"] = c.length==1?this.element:parseInt(c[1]);
	return true;
}
Card.prototype.as = function(card){
	return card.asUpped(this.upped).asShiny(this.shiny);
}
Card.prototype.isFree = function() {
	return this.type == PillarEnum && !this.upped && !this.rarity && !this.shiny;
}
Card.prototype.info = function(){
	if (this.type == PillarEnum){
		return this.text || "1:" + this.element + " " + activename(this.active.auto);
	}else{
		var dmgtype = "";
		if (this.type == WeaponEnum){
			if (this.status && this.status.ranged) dmgtype = " ranged";
			if (this.status && this.status.psion) dmgtype += " spell";
		}
		var prefix = this.type == ShieldEnum?(this.health?"Reduce damage by "+this.health+"\n":""):
			this.type == CreatureEnum || this.type == WeaponEnum ?this.attack+"|"+this.health+"\n":"";
		return prefix + (this.text || (this.type == SpellEnum ? activename(this.active) : objinfo(this.status, Thing.prototype.activetext.call(this)).join("\n")));
	}
}
Thing.prototype.toString = function(){ return this.card.name; }
CardInstance.prototype.toString = function() { return "::" + this.card.name; }
Player.prototype.toString = function(){ return this == this.game.player1?"p1":"p2"; }
Card.prototype.toString = function(){ return this.code; }
Card.prototype.asUpped = function(upped){
	return this.upped == upped ? this : Cards.Codes[etgutil.asUpped(this.code, upped)];
}
Card.prototype.asShiny = function(shiny){
	return !this.shiny == !shiny ? this : Cards.Codes[etgutil.asShiny(this.code, shiny)];
}
Card.prototype.isOf = function(card){
	return card.code == etgutil.asShiny(etgutil.asUpped(this.code, false), false);
}
Player.prototype.rng = function(){
	return this.game.rng.real();
}
Player.prototype.upto = function(x){
	return Math.floor(this.game.rng.rnd()*x);
}
Player.prototype.uptoceil = function(x){
	return Math.ceil((1-this.game.rng.rnd())*x);
}
Player.prototype.choose = function(x){
	return x[this.upto(x.length)];
}
Player.prototype.isCloaked = function(){
	return this.permanents.some(function(pr){
		return pr && pr.status.cloak;
	});
}
Player.prototype.info = function(){
	var info = [this.hp + "/" + this.maxhp + " " + this.deck.length + "cards"];
	objinfo(this.status, info);
	if (this.nova)info.push(this.nova + "nova");
	if (this.neuro)info.push("neuro");
	if (this.sosa)info.push(this.sosa + "sosa");
	if (this.silence)info.push("silence");
	if (this.sanctuary)info.push("sanctuary");
	if (this.precognition)info.push("precognition");
	if (this.gpull)info.push("gpull");
	return info.join("\n");
}
Player.prototype.randomquanta = function() {
	var nonzero = 0;
	for(var i=1; i<13; i++){
		nonzero += this.quanta[i];
	}
	if (nonzero == 0){
		return -1;
	}
	nonzero = this.uptoceil(nonzero);
	for(var i=1; i<13; i++){
		if ((nonzero -= this.quanta[i])<=0){
			return i;
		}
	}
}
Player.prototype.canspend = function(qtype, x) {
	if (x <= 0)return true;
	if (qtype == Chroma){
		for (var i=1; i<13; i++){
			x -= this.quanta[i];
			if (x <= 0){
				return true;
			}
		}
		return false;
	}else return this.quanta[qtype] >= x;
}
Player.prototype.spend = function(qtype, x) {
	if (x == 0 || (x<0 && this.flatline))return true;
	if (!this.canspend(qtype, x))return false;
	if (qtype == Chroma){
		var b = x<0?-1:1;
		for (var i=x*b; i>0; i--){
			this.quanta[b==-1?this.uptoceil(12):this.randomquanta()] -= b;
		}
	}else this.quanta[qtype] -= x;
	for (var i=1; i<13; i++){
		if (this.quanta[i]>99){
			this.quanta[i]=99;
		}
	}
	return true;
}
Player.prototype.countcreatures = function() {
	return this.creatures.reduce(function(count, cr){
		return count+!!cr;
	}, 0);
}
Player.prototype.countpermanents = function() {
	return this.permanents.reduce(function(count, pr){
		return count+!!pr;
	}, 0);
}
Player.prototype.endturn = function(discard) {
	this.game.ply++;
	if (discard != undefined){
		this.hand[discard].die(discard);
	}
	this.spend(this.mark, this.markpower * (this.mark > 0 ? -1 : -3));
	if (this.foe.status.poison){
		this.foe.dmg(this.foe.status.poison);
	}
	var patienceFlag = false, floodingFlag = false, stasisFlag = false, floodingPaidFlag = false, freedomChance = 0;
	for(var i=0; i<16; i++){
		var p;
		if ((p=this.permanents[i])){
			if(p.active.auto){
				p.active.auto(p);
			}
			if (~p.getIndex()){
				p.usedactive = false;
				if (p.status.stasis){
					stasisFlag = true;
				}else if (p.status.flooding && !floodingPaidFlag){
					floodingPaidFlag = true;
					floodingFlag = true;
					if (!this.spend(Water, 1)){
						delete this.permanents[i];
					}
				}else if (p.status.patience){
					patienceFlag = true;
					stasisFlag = true;
				}else if (p.status.freedom){
					freedomChance++;
				}
			}
		}
		if ((p=this.foe.permanents[i])){
			if (p.status.stasis){
				stasisFlag = true;
			}else if (p.status.flooding){
				floodingFlag = true;
			}
		}
	}
	if (freedomChance){
		freedomChance = (1-Math.pow(.7,freedomChance));
	}
	this.creatures.slice().forEach(function(cr, i){
		if (cr){
			if (patienceFlag){
				var floodbuff = floodingFlag && i>4;
				cr.atk += floodbuff?5:cr.status.burrowed?4:2;
				cr.buffhp(floodbuff?2:1);
			}
			cr.attack(stasisFlag, freedomChance);
			if (floodingFlag && !cr.status.aquatic && cr.isMaterial() && cr.getIndex() > 4){
				cr.die();
			}
		}
	});
	if (this.shield){
		this.shield.usedactive = false;
		if(this.shield.active.auto)this.shield.active.auto(this.shield);
	}
	if (this.weapon)this.weapon.attack();
	if (this.foe.sosa > 0){
		this.foe.sosa--;
	}
	this.nova = 0;
	this.flatline = this.silence = false;
	this.foe.precognition = this.foe.sanctuary = false;
	for (var i = this.foe.drawpower !== undefined ? this.foe.drawpower : 1; i > 0; i--) {
		this.foe.drawcard(true);
	}
	this.game.turn = this.foe;
	this.foe.procactive("turnstart");
	this.game.updateExpectedDamage();
}
Thing.prototype.procactive = function(name, param) {
	function proc(c){
		var a;
		if (c && (a = c.active[name])){
			a.call(null, c, this, param);
		}
	}
	if (this.active && this.active["own" + name]){
		this.active["own" + name].call(null, this, this, param);
	}
	for(var i=0; i<2; i++){
		var pl = i==0?this.owner:this.owner.foe;
		pl.creatures.forEach(proc, this);
		pl.permanents.forEach(proc, this);
		proc.call(this, pl.shield);
		proc.call(this, pl.weapon);
	}
}
Player.prototype.drawcard = function(drawstep) {
	if (this.hand.length<8){
		if (this.deck.length>0){
			if (~new CardInstance(this.deck.pop(), this).place()){
				this.procactive("draw", drawstep);
				if (this.deck.length == 0 && this.game.player1 == this)
					Effect.mkSpriteFade(ui.getTextImage("Last card!", 32, "white", 0));
			}
		}else this.game.setWinner(this.foe);
	}
}
Player.prototype.drawhand = function(x) {
	if (x >= 0){
		while (this.hand.length > 0){
			this.deck.push(this.hand.pop().card);
		}
		this.shuffle(this.deck);
		for(var i=0; i<x; i++){
			this.hand.push(new CardInstance(this.deck.pop(), this));
		}
	}
}
function destroyCloak(pr){
	if (pr && pr.status.cloak) pr.die();
}
Player.prototype.masscc = function(caster, func, massmass){
	this.permanents.forEach(destroyCloak);
	if (massmass) this.foe.permanents.forEach(destroyCloak);
	var crs = this.creatures.slice(), crsfoe = massmass && this.foe.creatures.slice();
	for(var i=0; i<23; i++){
		if (crs[i] && crs[i].isMaterial()){
			func(caster, crs[i]);
		}
		if (crsfoe && crsfoe[i] && crsfoe[i].isMaterial()){
			func(caster, crsfoe[i]);
		}
	}
}
Creature.prototype.info = function(){
	var info = [this.trueatk()+"|"+this.truehp()+"/"+this.maxhp];
	this.activetext(info);
	if (this.owner.gpull == this) info.push("gpull");
	objinfo(this.status, info);
	return info.join("\n");
}
Permanent.prototype.info = function(){
	return objinfo(this.status, this.activetext()).join("\n");
}
Weapon.prototype.info = function(){
	var info = [this.trueatk()];
	return objinfo(this.status, this.activetext(info)).join("\n");
}
Shield.prototype.info = function(){
	return objinfo(this.status, this.activetext([this.truedr() + "DR"])).join("\n");
}
Pillar.prototype.info = function(){
	return this.status.charges + " 1:" + (this.status.pendstate?this.owner.mark:this.card.element) + (this.status.immaterial?"\nimmaterial":"");
}
Thing.prototype.activetext = function(info){
	if (!info) info = [];
	for(var key in this.active){
		if (this.active[key])info.push((key != "auto"?(key == "cast"?casttext(this.cast, this.castele):key) + " ":"") + activename(this.active[key]));
	}
	return info;
}
Thing.prototype.activetext1 = function(){
	if (this.active.cast) return casttext(this.cast, this.castele) + this.active.cast.activename[0];
	var order = ["hit", "death", "owndeath", "buff", "destroy", "draw", "play", "spell", "dmg", "shield", "postauto"];
	for(var i=0; i<order.length; i++){
		if (this.active[order[i]]) return order[i] + " " + this.active[order[i]].activename.join(" ");
	}
	return this.active.auto ? this.active.auto.activename.join(" ") : "";
}
Thing.prototype.place = function(fromhand){
	this.procactive("play", fromhand);
}
Creature.prototype.place = function(fromhand){
	if (place(this.owner.creatures, this)){
		Thing.prototype.place.call(this, fromhand);
	}
}
Permanent.prototype.place = function(fromhand){
	if (this.status.additive){
		var dullcode = etgutil.asShiny(this.card.code, false);
		for(var i=0; i<16; i++){
			if (this.owner.permanents[i] && etgutil.asShiny(this.owner.permanents[i].card.code, false) == dullcode){
				this.owner.permanents[i].status.charges += this.status.charges;
				Thing.prototype.place.call(this.owner.permanents[i], fromhand);
				return;
			}
		}
	}
	if (place(this.owner.permanents, this)){
		Thing.prototype.place.call(this, fromhand);
	}
}
Weapon.prototype.place = function(fromhand){
	this.owner.weapon = this;
	Thing.prototype.place.call(this, fromhand);
}
Shield.prototype.place = function(fromhand){
	if (this.status.additive && this.owner.shield && this.card.as(this.owner.shield.card) == this.card){
		this.owner.shield.status.charges += this.status.charges;
	}else{
		this.owner.shield = this;
	}
	Thing.prototype.place.call(this, fromhand);
}
CardInstance.prototype.place = function(){
	return this.owner.hand.length < 8 ? this.owner.hand.push(this) : -1;
}
Player.prototype.delay = function(x) {
	if (this.weapon)this.weapon.delay(x);
}
Player.prototype.freeze = function(x) {
	if (this.weapon)this.weapon.freeze(x);
}
Weapon.prototype.addpoison = function(x) {
	return this.owner.addpoison(x);
}
Weapon.prototype.spelldmg = function(x) {
	return this.owner.spelldmg(x);
}
Weapon.prototype.dmg = function(x) {
	return this.owner.dmg(x);
}
Player.prototype.dmg = function(x, ignoresosa) {
	if (!x)return 0;
	var sosa = this.sosa && !ignoresosa;
	if (sosa){
		x *= -1;
	}
	if (x<0){
		var heal = Math.max(this.hp-this.maxhp, x);
		this.hp -= heal;
		return sosa?-x:heal;
	}else{
		this.hp -= x;
		if (this.hp <= 0){
			this.game.setWinner(this.foe);
		}
		return sosa?-x:x;
	}
}
Player.prototype.spelldmg = function(x) {
	return (!this.shield || !this.shield.status.reflect?this:this.foe).dmg(x);
}
CardInstance.prototype.getIndex = function() { return this.owner.hand.indexOf(this); }
Creature.prototype.getIndex = function() { return this.owner.creatures.indexOf(this); }
Player.prototype.addpoison = function(x) {
	this.defstatus("poison", 0);
	this.status.poison += x;
}
Creature.prototype.addpoison = function(x) {
	if (this.card.isOf(Cards.Cell)){
		this.transform(Cards.MalignantCell);
	}else{
		this.defstatus("poison", 0);
		this.status.poison += x;
		if (this.status.voodoo){
			this.owner.foe.addpoison(x);
		}
	}
}
Weapon.prototype.buffhp = function(){ return this.owner.buffhp.apply(this.owner, arguments) }
Player.prototype.buffhp = Creature.prototype.buffhp = function(x) {
	if (!(this instanceof Player) || this.maxhp < 500) {
		this.maxhp += x;
		if (this.maxhp > 500 && this instanceof Player) {
			this.maxhp = 500;
		}
	}
	this.dmg(-x);
}
Weapon.prototype.delay = Creature.prototype.delay = function(x){
	this.defstatus("delayed", 0);
	this.status.delayed += x;
	if (this.status.voodoo)this.owner.foe.delay(x);
}
Weapon.prototype.freeze = Creature.prototype.freeze = function(x){
	if (this.card.isOf(Cards.Squid)){
		this.transform(Cards.ArcticSquid.asUpped(this.card.upped));
	}else{
		if (!this.active.ownfreeze || this.active.ownfreeze(this)){
			Effect.mkText("Freeze", this);
			this.defstatus("frozen", 0);
			if (x > this.status.frozen) this.status.frozen = x;
			if (this.status.voodoo) this.owner.foe.freeze(x);
		}
	}
}
Creature.prototype.spelldmg = function(x, dontdie){
	if (this.active.spelldmg && this.active.spelldmg(this, undefined, x)) return 0;
	return this.dmg(x, dontdie);
}
Creature.prototype.dmg = function(x, dontdie){
	if (!x)return 0;
	var dmg = x<0 ? Math.max(this.hp-this.maxhp, x) : Math.min(this.truehp(), x);
	this.hp -= dmg;
	this.procactive("dmg", dmg);
	if (this.truehp() <= 0){
		if (!dontdie)this.die();
	}else if (dmg>0 && this.status.voodoo)this.owner.foe.dmg(x);
	return dmg;
}
Creature.prototype.remove = function(index) {
	if (this.owner.gpull == this)delete this.owner.gpull;
	if (index === undefined)index=this.getIndex();
	if (~index){
		delete this.owner.creatures[index];
	}
	return index;
}
Permanent.prototype.remove = function(index){
	if (index === undefined)index=this.getIndex();
	if (~index){
		delete this.owner.permanents[index];
	}
	return index;
}
CardInstance.prototype.remove = function(index) {
	if (index === undefined)index=this.getIndex();
	if (~index){
		this.owner.hand.splice(index, 1);
	}
	return index;
}
CardInstance.prototype.die = function(idx){
	var idx = this.remove(idx);
	if (~idx) this.procactive("discard");
}
Creature.prototype.deatheffect = Weapon.prototype.deatheffect = function(index) {
	var data = {index:index}
	this.procactive("death", data);
	if (index>=0) Effect.mkDeath(ui.creaturePos(this.owner == this.owner.game.player1?0:1, index));
}
Creature.prototype.die = function() {
	var index = this.remove();
	if (~index){
		if (!(this.active.predeath && this.active.predeath(this))){
			if (this.status.aflatoxin & !this.card.isOf(Cards.MalignantCell)){
				this.owner.creatures[index] = new Creature(this.card.as(Cards.MalignantCell), this.owner);
			}
			this.deatheffect(index);
		}
	}
}
Creature.prototype.transform = Weapon.prototype.transform = function(card, owner){
	this.maxhp = this.hp = card.health;
	this.atk = card.attack;
	this.cast = card.cast;
	this.castele = card.castele;
	Thing.call(this, card, owner || this.owner);
	if (this.status.mutant){
		var buff = this.owner.upto(25);
		this.buffhp(Math.floor(buff/5));
		this.atk += buff%5;
		this.mutantactive();
	}
}
Weapon.prototype.calcCore = Creature.prototype.calcCore = function(prefix, filterstat){
	if (!prefix(this)) return 0;
	for (var j=0; j<2; j++){
		var pl = j == 0 ? this.owner : this.owner.foe;
		if (pl.permanents.some(function(pr){return pr.status[filterstat]})) return 1;
	}
	return 0;
}
Weapon.prototype.calcCore2 = Creature.prototype.calcCore2 = function(prefix, filterstat){
	if (!prefix(this)) return 0;
	var bonus = 0;
	for (var j=0; j<2; j++){
		var pl = j == 0 ? this.owner : this.owner.foe, pr;
		for (var i=0; i<16; i++){
			if ((pr = pl.permanents[i]) && pr.status[filterstat]){
				if (pr.card.upped) return 2;
				else bonus = 1;
			}
		}
	}
	return bonus;
}
function isEclipseCandidate(c){
	return c.status.nocturnal && c instanceof Creature;
}
function isWhetCandidate(c){
	return c.status.golem || c.card.type == WeaponEnum;
}
Weapon.prototype.calcBonusAtk = Creature.prototype.calcBonusAtk = function(){
	return this.calcCore2(isEclipseCandidate, "nightfall") + this.calcCore(isWhetCandidate, "whetstone");
}
Creature.prototype.calcBonusHp = function(){
	return this.calcCore(isEclipseCandidate, "nightfall") + this.calcCore2(isWhetCandidate, "whetstone");
}
Thing.prototype.lobo = function(){
	// TODO deal with combined actives
	for (var key in this.active){
		if (!(this.active[key].activename[0] in passives)) delete this.active[key];
	}
}
Thing.prototype.mutantactive = function(){
	this.lobo();
	var abilities = ["hatch","freeze","burrow","destroy","steal","dive","heal","paradox","lycanthropy","growth 1","infect","gpull","devour","mutation","growth 2","ablaze","poison 1","deja","endow","guard","mitosis"];
	var index = this.owner.upto(abilities.length+2)-2;
	if (index<0){
		this.status[["momentum","immaterial"][~index]] = true;
	}else{
		var active = Actives[abilities[index]];
		if (abilities[index] == "growth 1"){
			this.addactive("death", active);
		}else{
			this.active.cast = active;
			this.cast = this.owner.uptoceil(2);
			this.castele = this.card.element;
			return true;
		}
	}
}
var adrtbl = Object.freeze([
	[0, 0, 0, 0],
	[1, 1, 1], [2, 2, 2], [3, 3, 3],
	[3, 2], [4, 2], [4, 2], [5, 3], [6, 3],
	[3], [4], [4], [4], [5], [5], [5]
]);
adrtbl.forEach(Object.freeze);
Weapon.prototype.trueatk = Creature.prototype.trueatk = function(adrenaline){
	var dmg = this.atk;
	if (this.status.dive)dmg += this.status.dive;
	if (this.active.buff)dmg += this.active.buff(this);
	dmg += this.calcBonusAtk();
	if (this.status.burrowed)dmg = Math.ceil(dmg/2);
	var y=adrenaline || this.status.adrenaline || 0;
	if (y<2)return dmg;
	var row = adrtbl[dmg];
	return row ? row[y-2] || 0 : 0;
}
Shield.prototype.truedr = function(){
	var dr = this.dr;
	if (this.active.buff){
		dr += this.active.buff(this);
	}
	return dr;
}
Player.prototype.truehp = function(){ return this.hp; }
Weapon.prototype.truehp = function(){ return this.card.health; }
Creature.prototype.truehp = function(){
	var hp = this.hp + this.calcBonusHp(this.owner.game);
	if (this.active.hp) hp += this.active.hp(this);
	return hp;
}
Permanent.prototype.getIndex = function() { return this.owner.permanents.indexOf(this); }
Permanent.prototype.die = function(){
	if (~this.remove()){
		this.procactive("destroy");
	}
}
Weapon.prototype.remove = function() {
	if (this.owner.weapon != this)return -1;
	delete this.owner.weapon;
	return 0;
}
Shield.prototype.remove = function() {
	if (this.owner.shield != this)return -1;
	delete this.owner.shield;
	return 0;
}
Thing.prototype.isMaterial = function(type) {
	return (type ? this instanceof type : !(this instanceof CardInstance) && !(this instanceof Player)) && !this.status.immaterial && !this.status.burrowed;
}
Thing.prototype.addactive = function(type, active){
	this.active[type] = combineactive(this.active[type], active);
}
Thing.prototype.rmactive = function(type, activename){
	if (!this.active[type])return;
	var actives = this.active[type].activename, idx;
	if (~(idx=actives.indexOf(activename))){
		if (actives.length == 1){
			delete this.active[type];
		} else {
			this.active[type] = actives.reduce(function(previous, current, i){
				return i == idx ? previous : combineactive(previous, Actives[current]);
			}, null);
		}
	}
}
Thing.prototype.hasactive = function(type, activename) {
	if (!this.active[type])return false;
	return ~this.active[type].activename.indexOf(activename);
}
Thing.prototype.canactive = function() {
	return this.owner.game.turn == this.owner && this.active.cast && !this.usedactive && !this.status.delayed && !this.status.frozen && this.owner.canspend(this.castele, this.cast);
}
Thing.prototype.castSpell = function(t, active, nospell){
	var data = {tgt: t, active: active};
	this.procactive("prespell", data);
	if (data.tgt !== true){
		active(this, data.tgt);
		if (!nospell) this.procactive("spell", data.tgt);
	}else if (t) Effect.mkText("Evade", t);
}
Thing.prototype.useactive = function(t) {
	this.usedactive = true;
	var castele = this.castele, cast = this.cast;
	this.castSpell(t, this.active.cast);
	this.owner.spend(castele, cast);
	this.owner.game.updateExpectedDamage();
}
Player.prototype.defstatus = Thing.prototype.defstatus = function(key, def){
	if (!(key in this.status)){
		this.status[key] = def;
	}
}
Weapon.prototype.attack = Creature.prototype.attack = function(stasis, freedomChance, target){
	var isCreature = this instanceof Creature;
	if (isCreature){
		this.dmg(this.status.poison, true);
	}
	if (target === undefined) target = this.active.cast == Actives.appease && !this.status.appeased ? this.owner : this.owner.foe;
	if (this.active.auto && !this.status.frozen){
		this.active.auto(this);
	}
	this.usedactive = false;
	var trueatk;
	if (!(stasis || this.status.frozen || this.status.delayed) && (trueatk = this.trueatk()) != 0){
		var momentum = this.status.momentum ||
			(this.status.burrowed && this.owner.permanents.some(function(pr){ return pr && pr.status.tunnel }));
		if (this.status.airborne && freedomChance && this.owner.rng() < freedomChance){
			if (!momentum && !target.shield && !target.gpull && !this.status.psion){
				trueatk = Math.ceil(trueatk * 1.5);
			}else{
				momentum = true;
			}
		}
		if (this.status.psion){
			target.spelldmg(trueatk);
		}else if (momentum || trueatk < 0){
			target.dmg(trueatk);
			if (this.active.hit){
				this.active.hit(this, target, trueatk);
			}
		}else if (target.gpull){
			var gpull = target.gpull;
			var dmg = gpull.dmg(trueatk);
			if (this.active.hit){
				this.active.hit(this, gpull, dmg);
			}
			if (target.gpull == gpull && gpull.active.shield){
				gpull.active.shield(gpull, this, dmg);
			}
		}else{
			var truedr = target.shield ? target.shield.truedr() : 0;
			var tryDmg = Math.max(trueatk - truedr, 0), blocked = Math.max(Math.min(truedr, trueatk), 0);
			if (!target.shield || !target.shield.active.shield || !target.shield.active.shield(target.shield, this, tryDmg, blocked)){
				if (truedr > 0 && this.active.blocked) this.active.blocked(this, target.shield, blocked);
				if (tryDmg > 0){
					var dmg = target.dmg(tryDmg);
					if (this.active.hit){
						this.active.hit(this, target, dmg);
					}
				}
			}else if (this.active.blocked) this.active.blocked(this, target.shield, trueatk);
		}
	}
	if (this.status.frozen){
		this.status.frozen--;
	}
	if (this.status.delayed){
		this.status.delayed--;
	}
	delete this.status.dive;
	if (isCreature && ~this.getIndex() && this.truehp() <= 0){
		this.die();
	}else if (!isCreature || ~this.getIndex()){
		if (this.active.postauto && !this.status.frozen) {
			this.active.postauto(this);
		}
		if(this.status.adrenaline){
			if(this.status.adrenaline < countAdrenaline(this.trueatk(0))){
				this.status.adrenaline++;
				this.attack(stasis, freedomChance, target);
			}else{
				this.status.adrenaline = 1;
			}
		}
	}
}
CardInstance.prototype.canactive = function(){
	if (this.owner.silence || this.owner.game.turn != this.owner)return false;
	if (!this.card){
		console.log("wtf cardless card");
		return false;
	}
	return this.owner.canspend(this.card.costele, this.card.cost);
}
CardInstance.prototype.useactive = function(target){
	if (!this.canactive()){
		console.log((this.owner==this.owner.game.player1?"1":"2") + " cannot cast " + (this || "-"));
		return;
	}
	var owner = this.owner, card = this.card;
	this.remove();
	if (owner.neuro){
		owner.addpoison(1);
	}
	if (card.type <= PermanentEnum){
		var cons = [Pillar, Weapon, Shield, Permanent][card.type];
		new cons(card, owner).place(true);
		ui.playSound("permPlay");
	}else if (card.type == SpellEnum){
		this.castSpell(target, card.active);
	}else if (card.type == CreatureEnum){
		new Creature(card, owner).place(true);
		ui.playSound("creaturePlay");
	} else console.log("Unknown card type: " + card.type);
	owner.spend(card.costele, card.cost);
	this.procactive("cardplay");
	owner.game.updateExpectedDamage();
}
function countAdrenaline(x){
	var atks = adrtbl[Math.abs(x)];
	return atks?atks.length+1:1;
}
var filtercache = [];
function filtercards(upped, filter, cmp, showshiny){
	if (!Cards.loaded) return;
	var cacheidx = (upped?1:0)|(showshiny?2:0);
	if (!(cacheidx in filtercache)){
		filtercache[cacheidx] = [];
		for (var key in Cards.Codes){
			var card = Cards.Codes[key];
			if (card.upped == upped && !card.shiny == !showshiny && !card.status.token){
				filtercache[cacheidx].push(card);
			}
		}
		filtercache[cacheidx].sort();
	}
	var keys = filtercache[cacheidx];
	if (filter) keys = keys.filter(filter);
	if (cmp) keys.sort(cmp);
	return keys;
}
Player.prototype.randomcard = function(upped, filter){
	var keys = filtercards(upped, filter);
	return keys && keys.length && Cards.Codes[this.choose(keys)];
}
function activename(active){
	return active?active.activename.join(" "):"";
}
function casttext(cast, castele){
	return cast == 0?"0":cast + ":" + castele;
}
function cardCmp(x, y){
	var cx = Cards.Codes[x].asShiny(false), cy = Cards.Codes[y].asShiny(false);
	return cx.upped - cy.upped || cx.element - cy.element || cx.cost - cy.cost || cx.type - cy.type || (cx.code > cy.code) - (cx.code < cy.code) || (x > y) - (x < y);
}
exports.cardCmp = cardCmp;
exports.Game = Game;
exports.Thing = Thing;
exports.Card = Card;
exports.Player = Player;
exports.CardInstance = CardInstance;
exports.Pillar = Pillar;
exports.Weapon = Weapon;
exports.Shield = Shield;
exports.Permanent = Permanent;
exports.Creature = Creature;
exports.passives = passives;
exports.isEmpty = isEmpty;
exports.filtercards = filtercards;
exports.countAdrenaline = countAdrenaline;
exports.clone = clone;
exports.casttext = casttext;
exports.fromTrueMark = fromTrueMark;
exports.toTrueMark = toTrueMark;
exports.PlayerRng = PlayerRng;
exports.parseActive = parseActive;
exports.Chroma = 0;
exports.Entropy = 1;
exports.Death = 2;
exports.Gravity = 3;
exports.Earth = 4;
exports.Life = 5;
exports.Fire = 6;
exports.Water = 7;
exports.Light = 8;
exports.Air = 9;
exports.Time = 10;
exports.Darkness = 11;
exports.Aether = 12;
exports.PillarEnum = 0;
exports.WeaponEnum = 1;
exports.ShieldEnum = 2;
exports.PermanentEnum = 3;
exports.SpellEnum = 4;
exports.CreatureEnum = 5;
exports.MulliganPhase1 = 0;
exports.MulliganPhase2 = 1;
exports.PlayPhase = 2;
exports.EndPhase = 3;
exports.AdrenaTable = adrtbl;
exports.PillarList = Object.freeze(["4sa", "4vc", "52g", "55k", "58o", "5bs", "5f0", "5i4", "5l8", "5oc", "5rg", "5uk", "61o"]);
exports.PendList = Object.freeze(["4sc", "50u", "542", "576", "5aa", "5de", "5gi", "5jm", "5mq", "5pu", "5t2", "606", "63a"]);
exports.NymphList = Object.freeze([undefined, "500", "534", "568", "59c", "5cg", "5fk", "5io", "5ls", "5p0", "5s4", "5v8", "62c"]);
exports.AlchemyList = Object.freeze([undefined, "4vn", "52s", "55v", "595", "5c7", "5fb", "5ig", "5lj", "5om", "5rr", "5uu", "621"]);
exports.ShardList = Object.freeze([undefined, "50a", "53e", "56i", "59m", "5cq", "5fu", "5j2", "5m6", "5pa", "5se", "5vi", "62m"]);
exports.eleNames = Object.freeze(["Chroma", "Entropy", "Death", "Gravity", "Earth", "Life", "Fire", "Water", "Light", "Air", "Time", "Darkness", "Aether", "Random", "Recently Released"]);