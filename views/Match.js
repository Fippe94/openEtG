"use strict";
var px = require("../px");
var etg = require("../etg");
var gfx = require("../gfx");
var ui = require("../uiutil");
var mkAi = require("../mkAi");
var sock = require("../sock");
var Cards = require("../Cards");
var Effect = require("../Effect");
var Actives = require("../Actives");
var etgutil = require("../etgutil");
function startMatch(game, foeDeck) {
	function drawBorder(obj, spr) {
		if (obj) {
			if (game.targetingMode) {
				if (game.targetingMode(obj)) {
					fgfx.lineStyle(2, 0xff0000);
					fgfx.drawRect(spr.position.x - spr.width / 2, spr.position.y - spr.height / 2, spr.width, spr.height);
					fgfx.lineStyle(2, 0xffffff);
				}
			} else if (obj.canactive() && !(obj.owner == game.player2 && game.player2.isCloaked())) {
				fgfx.lineStyle(2, obj.card.element == 8 ? 0x000000 : 0xffffff);
				fgfx.drawRect(spr.position.x - spr.width / 2, spr.position.y - spr.height / 2 - 1, spr.width, (obj instanceof etg.Weapon || obj instanceof etg.Shield ? 12 : 10));
			}
		}
	}
	function drawStatus(obj, spr) {
		var statuses = spr.children[0].children;
		statuses[0].visible = obj.status.psion;
		statuses[1].visible = obj.status.aflatoxin;
		statuses[2].visible = !obj.status.aflatoxin && obj.status.poison > 0;
		statuses[3].visible = obj.status.airborne || obj.status.ranged;
		statuses[4].visible = obj.status.momentum;
		statuses[5].visible = obj.status.adrenaline;
		statuses[6].visible = obj.status.poison < 0;
		statuses[7].visible = obj.status.delayed;
		statuses[8].visible = obj == obj.owner.gpull;
		statuses[9].visible = obj.status.frozen;
		statuses[10].visible = obj.hasactive("prespell", "protectonce");
		spr.alpha = obj.isMaterial() ? 1 : .7;
	}
	function addNoHealData(game) {
		var data = game.dataNext || {};
		if (game.noheal){
			data.p1hp = Math.max(game.player1.hp, 1);
			data.p1maxhp = game.player1.maxhp;
		}
		return data;
	}
	function endClick(discard) {
		if (game.turn == game.player1 && game.phase <= etg.MulliganPhase2){
			if (!game.ai) sock.emit("mulligan", {draw: true});
			game.progressMulligan();
		}else if (game.winner) {
			if (sock.user) {
				if (game.arena) {
					sock.userEmit("modarena", { aname: game.arena, won: game.winner == game.player2, lv: game.level-4 });
				}
				if (game.winner == game.player1) {
					if (game.quest){
						if (game.autonext) {
							var data = addNoHealData(game);
							var newgame = require("../Quest").mkQuestAi(game.quest[0], game.quest[1] + 1, game.area);
							newgame.addData(data);
							return;
						}else if (sock.user.quest[game.quest[0]] <= game.quest[1] || !(game.quest[0] in sock.user.quest)) {
							sock.userEmit("updatequest", { quest: game.quest[0], newstage: game.quest[1] + 1 });
							sock.user.quest[game.quest[0]] = game.quest[1] + 1;
						}
					}else if (game.daily){
						if (game.endurance) {
							var data = addNoHealData(game);
							data.endurance--;
							var newgame = mkAi.mkAi(game.level, true)();
							newgame.addData(data);
							newgame.dataNext = data;
							return;
						}
						else {
							sock.userExec("donedaily", { daily: game.daily == 4 ? 5 : game.daily == 3 ? 0 : game.daily });
						}
					}
				}else if (!game.endurance && game.level !== undefined){
					sock.user["streak"+game.level] = 0;
				}
			}
			require("./Result")(game);
		} else if (game.turn == game.player1) {
			if (discard == undefined && game.player1.hand.length == 8) {
				discarding = true;
			} else {
				discarding = false;
				if (!game.ai) sock.emit("endturn", {bits: discard});
				game.player1.endturn(discard);
				delete game.targetingMode;
				if (foeplays.children.length)
					foeplays.removeChildren();
			}
		}
	}
	function cancelClick(){
		if (resigning) {
			resign.value = "Resign";
			resigning = false;
		} else if (game.turn == game.player1) {
			if (game.phase <= etg.MulliganPhase2 && game.player1.hand.length > 0) {
				game.player1.drawhand(game.player1.hand.length - 1);
				if (!game.ai) sock.emit("mulligan");
			} else if (game.targetingMode) {
				delete game.targetingMode;
			} else discarding = false;
		}
	}
	var resigning, discarding, aiDelay = 0, aiState, aiCommand;
	if (sock.user && (game.level !== undefined || !game.ai)) {
		sock.userExec("addloss", { pvp: !game.ai });
		if (game.cost){
			sock.userExec("addgold", { g: -game.cost });
		}
	}
	var redhor = [
		12, 0, 900,
		144, 145, 796,
		301, 103, 796,
		459, 103, 754,
		590, 103, 754,
	], redver = [
		103, 301, 590,
		144, 12, 301,
		275, 12, 144,
		624, 459, 590,
		754, 301, 590,
		796, 12, 301,
	], gameui = new PIXI.Graphics();
	gameui.hitArea = new PIXI.math.Rectangle(0, 0, 900, 600);
	gameui.interactive = true;
	for(var j=0; j<4; j++){
		gameui.lineStyle(1, [0x121212, 0x6a2e0d, 0x8a3e1d, 0x969696][j]);
		for (var i=0; i<redhor.length; i+=3){
			gameui.moveTo(redhor[i+1], redhor[i]-j);
			gameui.lineTo(redhor[i+2], redhor[i]-j);
		}
		for (var i=0; i<redver.length; i+=3){
			gameui.moveTo(redver[i]+j, redver[i+1]);
			gameui.lineTo(redver[i]+j, redver[i+2]);
		}
	}
	var cloakgfx = new PIXI.Graphics();
	cloakgfx.beginFill(0);
	cloakgfx.drawRect(130, 20, 660, 280);
	gameui.addChild(cloakgfx);
	var endturn = px.domButton("Accept Hand", endClick.bind(null, undefined));
	var cancel = px.domButton("Mulligan", cancelClick);
	var resign = px.domButton("Resign", function() {
		if (resigning){
			if (!game.ai) sock.emit("foeleft");
			game.setWinner(game.player2);
			endClick();
		}else{
			resign.value = "Confirm";
			resigning = true;
		}
	});
	var turntell = new px.domText("");
	turntell.style.pointerEvents = "none";
	var foename = px.domText((game.level === undefined ? "" : ["Commoner", "Mage", "Champion", "Demigod", "Arena1", "Arena2"][game.level] + "\n") + (game.foename || "-"));
	foename.style.textAlign = "center";
	foename.style.width = "140px";
	var dom = [
		[800, 520, endturn],
		[800, 490, cancel],
		[8, 24, resign],
		[800, 550, turntell],
		[0, 64, foename],
	];
	var activeInfo = {
		firebolt:function(){
			return 3+Math.floor(game.player1.quanta[etg.Fire]/4);
		},
		drainlife:function(){
			return 2+Math.floor(game.player1.quanta[etg.Darkness]/5);
		},
		icebolt:function(){
			var bolts = Math.floor(game.player1.quanta[etg.Water]/5);
			return (2+bolts) + " " + (35+bolts*5) + "%";
		},
		catapult:function(t){
			return Math.ceil(t.truehp()*(t.status.frozen?150:100)/(t.truehp()+100));
		},
		adrenaline:function(t){
			var tatk = Math.abs(t.trueatk());
			return "extra: " + (tatk > 15 ? 0 : etg.AdrenaTable[tatk].join(", "));
		},
	};
	function setInfo(obj) {
		if (!cloakgfx.visible || obj.owner != game.player2 || obj.status.cloak) {
			var info = obj.info(), actinfo = game.targetingMode && game.targetingMode(obj) && activeInfo[game.targetingText];
			if (actinfo) info += "\nDmg " + actinfo(obj);
			infobox.text = info;
			infobox.style.left = px.mouse.x + "px";
			infobox.style.top = px.mouse.y + "px";
			infobox.style.display = "inline";
		}
	}
	var handsprite = [new Array(8), new Array(8)];
	var creasprite = [new Array(23), new Array(23)];
	var permsprite = [new Array(16), new Array(16)];
	var shiesprite = new Array(2);
	var weapsprite = new Array(2);
	var marksprite = [document.createElement("span"), document.createElement("span")], markspritexy = [];
	var marktext = [px.domText(""), px.domText("")], marktextxy = [];
	var quantatext = [[], []], quantaxy = [[], []];
	var hptext = [new px.domText(""), new px.domText("")], hpxy = [];
	var playerOverlay = [new PIXI.Sprite(gfx.nopic), new PIXI.Sprite(gfx.nopic)];
	var handOverlay = [new PIXI.Sprite(gfx.nopic), new PIXI.Sprite(gfx.nopic)];
	var sabbathOverlay = [document.createElement("span"), document.createElement("span")];
	var sacrificeOverlay = [new PIXI.Sprite(gfx.sacrifice), new PIXI.Sprite(gfx.sacrifice)];
	for (var j = 0;j < 2;j++) {
		hptext[j].style.textAlign = "center";
		hptext[j].style.width = "100px";
		hptext[j].style.pointerEvents = "none";
		hptext[j].style.fontSize = "12px";
		hptext[j].style.lineHeight = "1.1";
		marktext[j].style.pointerEvents = "none";
		marktext[j].style.fontSize = "18px";
		marktext[j].style.transform = "translate(-50%,-50%)";
		playerOverlay[j].width = 95;
		playerOverlay[j].height = 80;
		sabbathOverlay[j].className = "sabbath";
		sabbathOverlay[j].style.display = "none";
		handOverlay[j].position.set(j ? 9 : 774, j ? 99 : 300);
		sacrificeOverlay[j].position.set(j ? 800 : 0, j ? 7 : 502);
		(function(_j) {
			for (var i = 0;i < 8;i++) {
				handsprite[j][i] = new PIXI.Sprite(gfx.nopic);
				handsprite[j][i].position = ui.cardPos(j, i);
				gameui.addChild(handsprite[j][i]);
				(function(_i) {
					px.setClick(handsprite[j][i], function() {
						if (game.phase != etg.PlayPhase) return;
						var cardinst = game.players(_j).hand[_i];
						if (cardinst) {
							if (!_j && discarding) {
								endClick(_i);
							} else if (game.targetingMode) {
								if (game.targetingMode(cardinst)) {
									delete game.targetingMode;
									game.targetingModeCb(cardinst);
								}
							} else if (!_j && cardinst.canactive()) {
								if (cardinst.card.type != etg.SpellEnum) {
									console.log("summoning", _i);
									if (!game.ai) sock.emit("cast", {bits: game.tgtToBits(cardinst)});
									cardinst.useactive();
								} else {
									game.getTarget(cardinst, cardinst.card.active, function(tgt) {
										if (!game.ai) sock.emit("cast", {bits: game.tgtToBits(cardinst) | game.tgtToBits(tgt) << 9});
										cardinst.useactive(tgt);
									});
								}
							}
						}
					}, false);
				})(i);
			}
			function makeInst(insts, i, pos, scale){
				if (scale === undefined) scale = 1;
				var spr = new PIXI.Sprite(gfx.nopic);
				var statuses = new PIXI.Container();
				for (var k=0; k<7; k++){
					var icon = new PIXI.Sprite(gfx.sicons[k]);
					icon.alpha = .6;
					icon.anchor.y = 1;
					icon.position.set(-34 * scale + [4, 1, 1, 0, 3, 2, 1][k] * 8, 30 * scale);
					statuses.addChild(icon);
				}
				for (var k=0; k<3; k++){
					var icon = new PIXI.Sprite(gfx.sborders[k]);
					icon.position.set(-32 * scale, -40 * scale);
					icon.scale.set(scale, scale);
					statuses.addChild(icon);
				}
				var bubble = new PIXI.Sprite(gfx.protection);
				bubble.position.set(-40 * scale, -40 * scale);
				bubble.scale.set(scale, scale);
				statuses.addChild(bubble);
				spr.addChild(statuses);
				var stattext = new PIXI.Sprite(gfx.nopic);
				stattext.position.set(-32 * scale, -33 * scale);
				spr.addChild(stattext);
				var activetext = new PIXI.Sprite(gfx.nopic);
				activetext.position.set(-32 * scale, -42 * scale);
				spr.addChild(activetext);
				spr.anchor.set(.5, .5);
				spr.position = pos;
				px.setClick(spr, function() {
					if (game.phase != etg.PlayPhase) return;
					var inst = insts ? insts[i] : game.players(_j)[i];
					if (!inst) return;
					if (game.targetingMode && game.targetingMode(inst)) {
						delete game.targetingMode;
						game.targetingModeCb(inst);
					} else if (_j == 0 && !game.targetingMode && inst.canactive()) {
						game.getTarget(inst, inst.active.cast, function(tgt) {
							delete game.targetingMode;
							if (!game.ai) sock.emit("cast", {bits: game.tgtToBits(inst) | game.tgtToBits(tgt) << 9});
							inst.useactive(tgt);
						});
					}
				}, false);
				return spr;
			}
			for (var i = 0;i < 23;i++) {
				creasprite[j][i] = makeInst(game.players(j).creatures, i, ui.creaturePos(j, i));
			}
			for (var i = 0;i < 23;i++){
				gameui.addChild(creasprite[j][j?22-i:i]);
			}
			for (var i = 0;i < 16;i++) {
				permsprite[j][i] = makeInst(game.players(j).permanents, i, ui.permanentPos(j, i));
			}
			for (var i = 0;i < 16;i++){
				gameui.addChild(permsprite[j][j?15-i:i]);
			}
			px.setInteractive.apply(null, handsprite[j]);
			px.setInteractive.apply(null, creasprite[j]);
			px.setInteractive.apply(null, permsprite[j]);
			markspritexy[j] = new PIXI.math.Point(740, 470);
			marksprite[j].style.transform = "translate(-50%,-50%)";
			weapsprite[j] = makeInst(null, "weapon", new PIXI.math.Point(666, 512), 5/4);
			shiesprite[j] = makeInst(null, "shield", new PIXI.math.Point(710, 536), 5/4);
			if (j){
				gameui.addChild(shiesprite[j]);
				gameui.addChild(weapsprite[j]);
				ui.reflectPos(weapsprite[j]);
				ui.reflectPos(shiesprite[j]);
				ui.reflectPos(markspritexy[j]);
			}else{
				gameui.addChild(weapsprite[j]);
				gameui.addChild(shiesprite[j]);
			}
			playerOverlay[j].anchor.set(.5, .5);
			marktextxy[j] = new PIXI.math.Point(768, 470);
			playerOverlay[j].position.set(50, 555);
			hpxy[j] = new PIXI.math.Point(50, 550);
			if (j) {
				ui.reflectPos(marktextxy[j]);
				ui.reflectPos(hpxy[j]);
				ui.reflectPos(playerOverlay[j]);
				playerOverlay[j].y += 15;
			}
			var child, quantaxy = [j ? 792 : 0, j ? 106 : 308];
			for (var k = 1;k < 13;k++) {
				quantatext[j][k-1] = px.domText("");
				quantatext[j][k-1].style.fontSize = "16px";
				quantatext[j][k-1].style.pointerEvents = "none";
				dom.push([quantaxy[0] + ((k & 1) ? 32 : 86), quantaxy[1] + Math.floor((k - 1) / 2) * 32 + 4,
					quantatext[j][k-1]]);
				var quantaicon = document.createElement("span");
				quantaicon.className = "Eicon E"+k;
				dom.push([quantaxy[0] + ((k & 1) ? 0 : 54), quantaxy[1] + Math.floor((k - 1) / 2) * 32, quantaicon]);
			}
			px.setClick(playerOverlay[j], function() {
				if (game.phase != etg.PlayPhase) return;
				if (game.targetingMode && game.targetingMode(game.players(_j))) {
					delete game.targetingMode;
					game.targetingModeCb(game.players(_j));
				}
			}, false);
		})(j);
		dom.push([markspritexy[j].x, markspritexy[j].y, marksprite[j]],
			[marktextxy[j].x, marktextxy[j].y, marktext[j]],
			[hpxy[j].x-50, playerOverlay[j].y - 24, hptext[j]],
			[j ? 792 : 0, j ? 80 : 288, sabbathOverlay[j]]);
		gameui.addChild(handOverlay[j]);
		gameui.addChild(sacrificeOverlay[j]);
		gameui.addChild(playerOverlay[j]);
	}
	px.setInteractive.apply(null, weapsprite);
	px.setInteractive.apply(null, shiesprite);
	px.setInteractive.apply(null, playerOverlay);
	var fgfx = new PIXI.Graphics();
	gameui.addChild(fgfx);
	var anims = new PIXI.Container();
	gameui.addChild(anims);
	Effect.register(anims);
	var foeplays = new PIXI.Container();
	gameui.addChild(foeplays);
	var cardart = new PIXI.Sprite(gfx.nopic);
	cardart.anchor.set(.5, 0);
	gameui.addChild(cardart);
	var infobox = px.domText("");
	infobox.style.display = "none";
	infobox.style.opacity = ".7";
	infobox.style.backgroundColor = "black";
	infobox.style.fontSize = "10px";
	infobox.style.transform = "translate(-50%,-100%)";
	infobox.style.pointerEvents = "none";
	dom.push([0, 0, infobox]);
	function onkeydown(e) {
		if (e.keyCode == 32) { // spc
			endClick();
		} else if (e.keyCode == 8) { // bsp
			cancelClick();
		} else if (e.keyCode >= 49 && e.keyCode <= 56) {
			handsprite[0][e.keyCode-49].click();
		} else if (e.keyCode == 83 || e.keyCode == 87) { // s/w
			playerOverlay[e.keyCode == 87?1:0].click();
		}
	}
	var cmds = {
		endturn: function(data) {
			game.player2.endturn(data.bits);
		},
		cast: function(data) {
			var bits = data.bits, c = game.bitsToTgt(bits & 511), t = game.bitsToTgt((bits >> 9) & 511);
			console.log("cast", c.toString(), (t || "-").toString(), bits);
			var sprite = new PIXI.Sprite(gfx.nopic);
			sprite.position.set((foeplays.children.length&7) * 99, (foeplays.children.length>>3) * 19);
			sprite.card = c instanceof etg.CardInstance ? c.card : c.active.cast.activename[0];
			foeplays.addChild(sprite);
			c.useactive(t);
		},
		foeleft: function(){
			if (!game.ai) game.setWinner(game.player1);
		},
		mulligan: function(data){
			if (data.draw === true) {
				game.progressMulligan();
			} else {
				game.player2.drawhand(game.player2.hand.length - 1);
			}
		},
	};
	document.addEventListener("keydown", onkeydown);
	px.refreshRenderer({view:gameui, gamedom:dom, next:function() {
		if (game.turn == game.player2 && game.ai) {
			if (game.phase == etg.PlayPhase){
				if (!aiCommand){
					Effect.disable = true;
					aiState = require("../ai/search")(game, aiState);
					Effect.disable = false;
					if (aiState.length <= 2){
						aiCommand = true;
					}
				}
				var now;
				if (aiCommand && (now = Date.now()) > aiDelay){
					cmds[aiState[0]]({bits: aiState[1]});
					aiState = undefined;
					aiCommand = false;
					aiDelay = now + (game.turn == game.player1 ? 2000 : 200);
				}
			}else if (game.phase <= etg.MulliganPhase2){
				cmds.mulligan({draw: require("../ai/mulligan")(game.player2)});
			}
		}
		var cardartcode, cardartx;
		infobox.style.display = "none";
		if (!cloakgfx.visible){
			foeplays.children.forEach(function(foeplay){
				if (foeplay.card instanceof etg.Card && px.hitTest(foeplay, px.mouse)) {
					cardartcode = foeplay.card.code;
				}
			});
		}
		for (var j = 0;j < 2;j++) {
			var pl = game.players(j);
			if (j == 0 || game.player1.precognition) {
				for (var i = 0;i < pl.hand.length;i++) {
					if (px.hitTest(handsprite[j][i], px.mouse)) {
						cardartcode = pl.hand[i].card.code;
					}
				}
			}
			for (var i = 0;i < 16;i++) {
				var pr = pl.permanents[i];
				if (pr && (j == 0 || !cloakgfx.visible || pr.status.cloak) && px.hitTest(permsprite[j][i], px.mouse)) {
					cardartcode = pr.card.code;
					cardartx = permsprite[j][i].position.x;
					setInfo(pr);
				}
			}
			if (j == 0 || !cloakgfx.visible) {
				for (var i = 0;i < 23;i++) {
					var cr = pl.creatures[i];
					if (cr && px.hitTest(creasprite[j][i], px.mouse)) {
						cardartcode = cr.card.code;
						cardartx = creasprite[j][i].position.x;
						setInfo(cr);
					}
				}
				if (pl.weapon && px.hitTest(weapsprite[j], px.mouse)) {
					cardartcode = pl.weapon.card.code;
					cardartx = weapsprite[j].position.x;
					setInfo(pl.weapon);
				}
				if (pl.shield && px.hitTest(shiesprite[j], px.mouse)) {
					cardartcode = pl.shield.card.code;
					cardartx = shiesprite[j].position.x;
					setInfo(pl.shield);
				}
			}
		}
		if (cardartcode) {
			cardart.texture = gfx.getArt(cardartcode);
			cardart.visible = true;
			cardart.position.set(cardartx || 654, px.mouse.y > 300 ? 44 : 300);
			if (px.mouse.y < 300) marktext[0].style.display = marksprite[0].style.display = cardartx >= 670 && cardartx <= 760 ? "none" : "inline";
			else marktext[1].style.display = marksprite[1].style.display = cardartx >= 140 && cardartx <= 230 ? "none" : "inline";
		} else {
			cardart.visible = false;
			for(var j=0; j<2; j++){
				marksprite[j].style.display = marktext[j].style.display = "inline";
			}
		}
		if (game.winner == game.player1 && sock.user && !game.quest && game.ai) {
			if (game.cardreward === undefined) {
				var winnable = foeDeck.filter(function(card){ return card.rarity > 0 && card.rarity < 4; }), cardwon;
				if (winnable.length) {
					cardwon = etg.PlayerRng.choose(winnable);
					if (cardwon == 3 && Math.random() < .5)
						cardwon = etg.PlayerRng.choose(winnable);
				} else {
					var elewin = foeDeck[Math.floor(Math.random() * foeDeck.length)];
					cardwon = etg.PlayerRng.randomcard(elewin.upped, function(x) { return x.element == elewin.element && x.type != etg.PillarEnum && x.rarity <= 3; });
				}
				if (game.level !== undefined && game.level < 2) {
					cardwon = cardwon.asUpped(false);
				}
				game.cardreward = "01" + etgutil.asShiny(cardwon.code, false);
			}
			if (!game.goldreward) {
				var goldwon;
				if (game.level !== undefined) {
					var streak = "streak" + game.level;
					var reward = [15, 30, 70, 200, 60, 120][game.level] * Math.min(1+[.05, .05, .075, .1, .075, .1][game.level]*(sock.user[streak]||0), 2);
					sock.user[streak] = (sock.user[streak] || 0)+1;
					goldwon = Math.floor(reward * (200 + game.player1.hp) / 300);
				} else goldwon = 0;
				game.goldreward = goldwon + (game.cost || 0) + (game.addonreward || 0);
			}
		}
		if (game.phase != etg.EndPhase) {
			var turntext;
			if (discarding){
				turntext = "Discard";
			}else if (game.targetingMode){
				turntext = game.targetingText;
			}else{
				turntext = game.turn == game.player1 ? "Your Turn" : "Their Turn";
				if (game.phase < 2) turntext += "\n" + (game.phase ? "Second" : "First");
			}
			turntell.text = turntext;
			if (game.turn == game.player1){
				endturn.text = game.phase == etg.PlayPhase ? "End Turn" : "Accept Hand";
				cancel.text = game.phase != etg.PlayPhase ? "Mulligan" : game.targetingMode || discarding || resigning ? "Cancel" : "";
			}else cancel.style.display = endturn.style.display = "none";
		}else{
			turntell.text = (game.turn == game.player1 ? "Your" : "Their") + " Turn\n" + (game.winner == game.player1?"Won":"Lost");
			endturn.text = "Continue";
			cancel.style.display = "none";
		}
		foeplays.children.forEach(function(foeplay){
			foeplay.texture = foeplay.card instanceof etg.Card ? gfx.getCardImage(foeplay.card.code) : ui.getTextImage(foeplay.card, 12);
		});
		foeplays.visible = !(cloakgfx.visible = game.player2.isCloaked());
		fgfx.clear();
		fgfx.beginFill(0, 0);
		fgfx.lineStyle(2, 0xffffff);
		for (var j = 0;j < 2;j++) {
			var pl = game.players(j);
			for (var i = 0;i < 23;i++) {
				drawBorder(pl.creatures[i], creasprite[j][i]);
			}
			for (var i = 0;i < 16;i++) {
				drawBorder(pl.permanents[i], permsprite[j][i]);
			}
			drawBorder(pl.weapon, weapsprite[j]);
			drawBorder(pl.shield, shiesprite[j]);
		}
		if (game.targetingMode) {
			fgfx.lineStyle(2, 0xff0000);
			for (var j = 0;j < 2;j++) {
				if (game.targetingMode(game.players(j))) {
					var spr = playerOverlay[j];
					fgfx.drawRect(spr.position.x - spr.width / 2, spr.position.y - spr.height / 2, spr.width, spr.height);
				}
				for (var i = 0;i < game.players(j).hand.length;i++) {
					if (game.targetingMode(game.players(j).hand[i])) {
						var spr = handsprite[j][i];
						fgfx.drawRect(spr.position.x, spr.position.y, spr.width, spr.height);
					}
				}
			}
		}
		fgfx.lineStyle(0, 0, 0);
		if (game.turn == game.player1 && !game.targetingMode && game.phase != etg.EndPhase) {
			fgfx.beginFill(0xffffff, .7);
			for (var i = 0;i < game.player1.hand.length;i++) {
				var card = game.player1.hand[i].card;
				if (game.player1.canspend(card.costele, card.cost)) {
					fgfx.drawRect(handsprite[0][i].position.x + 100, handsprite[0][i].position.y, 20, 19);
				}
			}
		}
		for (var j = 0;j < 2;j++) {
			var pl = game.players(j);
			sacrificeOverlay[j].visible = pl.sosa;
			sabbathOverlay[j].style.display = pl.flatline ? "inline-block" : "none";
			handOverlay[j].texture = (pl.silence? gfx.hborders[0] :
				pl.sanctuary ? gfx.hborders[1] :
				pl.nova >= 3 ? gfx.hborders[2] : gfx.nopic);
			for (var i = 0;i < 8;i++) {
				handsprite[j][i].texture = gfx.getCardImage(pl.hand[i] ? (j == 0 || game.player1.precognition ? pl.hand[i].card.code : "0") : "1");
			}
			for (var i = 0;i < 23;i++) {
				var cr = pl.creatures[i];
				if (cr && !(j == 1 && cloakgfx.visible)) {
					creasprite[j][i].texture = gfx.getCreatureImage(cr.card);
					creasprite[j][i].visible = true;
					var child = creasprite[j][i].children[1];
					child.texture = ui.getTextImage(cr.trueatk() + "|" + cr.truehp() + (cr.status.charges ? " x" + cr.status.charges : ""), 10, cr.card.upped ? "black" : "white", ui.maybeLighten(cr.card));
					var child2 = creasprite[j][i].children[2];
					var activetext = cr.activetext1();
					child2.texture = ui.getTextImage(activetext, 8, cr.card.upped ? "black" : "white");
					drawStatus(cr, creasprite[j][i]);
				} else creasprite[j][i].visible = false;
			}
			for (var i = 0;i < 16;i++) {
				var pr = pl.permanents[i];
				if (pr && !(j == 1 && cloakgfx.visible && !pr.status.cloak)) {
					permsprite[j][i].texture = gfx.getPermanentImage(pr.card.code);
					permsprite[j][i].visible = true;
					var child = permsprite[j][i].children[1];
					if (pr instanceof etg.Pillar) {
						child.texture = ui.getTextImage("1:" + (pr.status.pendstate ? pr.owner.mark : pr.card.element) + " x" + pr.status.charges, 10, pr.card.upped ? "black" : "white", ui.maybeLighten(pr.card));
					}
					else if (pr.active.auto && pr.active.auto == Actives.locket) {
						child.texture = ui.getTextImage("1:" + (pr.status.mode === undefined ? pr.owner.mark : pr.status.mode), 10, pr.card.upped ? "black" : "white", ui.maybeLighten(pr.card));
					}
					else child.texture = ui.getTextImage(pr.status.charges !== undefined ? " " + pr.status.charges : "", 10, pr.card.upped ? "black" : "white", ui.maybeLighten(pr.card));
					var child2 = permsprite[j][i].children[2];
					child2.texture = pr instanceof etg.Pillar ? gfx.nopic : ui.getTextImage(pr.activetext1(), 8, pr.card.upped ? "black" : "white");
					drawStatus(pr, permsprite[j][i]);
				} else permsprite[j][i].visible = false;
			}
			var wp = pl.weapon;
			if (wp && !(j == 1 && cloakgfx.visible)) {
				weapsprite[j].visible = true;
				var child = weapsprite[j].children[1];
				child.texture = ui.getTextImage(wp.trueatk() + (wp.status.charges ? " x" + wp.status.charges : ""), 12, wp.card.upped ? "black" : "white", ui.maybeLighten(wp.card));
				child.visible = true;
				var child = weapsprite[j].children[2];
				child.texture = ui.getTextImage(wp.activetext1(), 12, wp.card.upped ? "black" : "white");
				child.visible = true;
				weapsprite[j].texture = gfx.getWeaponShieldImage(wp.card.code);
				drawStatus(wp, weapsprite[j]);
			} else weapsprite[j].visible = false;
			var sh = pl.shield;
			if (sh && !(j == 1 && cloakgfx.visible)) {
				shiesprite[j].visible = true;
				var child = shiesprite[j].children[1];
				child.texture = ui.getTextImage(sh.status.charges ? "x" + sh.status.charges: sh.truedr().toString(), 12, sh.card.upped ? "black" : "white", ui.maybeLighten(sh.card));
				child.visible = true;
				var child = shiesprite[j].children[2];
				child.texture = ui.getTextImage(sh.activetext1(), 12, sh.card.upped ? "black" : "white");
				child.visible = true;
				shiesprite[j].texture = gfx.getWeaponShieldImage(sh.card.code);
				drawStatus(sh, shiesprite[j]);
			} else shiesprite[j].visible = false;
			marksprite[j].className = "Eicon E"+pl.mark;
			marktext[j].text = pl.markpower != 1 ? "x" + pl.markpower : "";
			for (var i = 1;i < 13;i++) {
				quantatext[j][i-1].text = pl.quanta[i] || "";
			}
			fgfx.beginFill(0);
			fgfx.drawRect(playerOverlay[j].x - 41, playerOverlay[j].y - 25, 82, 16);
			if (pl.hp > 0){
				fgfx.beginFill(ui.elecols[etg.Life]);
				fgfx.drawRect(playerOverlay[j].x - 40, playerOverlay[j].y - 24, 80 * pl.hp / pl.maxhp, 14);
				if (!cloakgfx.visible && game.expectedDamage[j]) {
					fgfx.beginFill(ui.elecols[game.expectedDamage[j] >= pl.hp ? etg.Fire : game.expectedDamage[j] > 0 ? etg.Time : etg.Water]);
					fgfx.drawRect(playerOverlay[j].x - 40 + 80 * pl.hp / pl.maxhp, playerOverlay[j].y - 24, -80 * Math.min(game.expectedDamage[j], pl.hp) / pl.maxhp, 14);
				}
			}
			if (px.hitTest(playerOverlay[j], px.mouse)){
				setInfo(pl);
			}else{
				var poison = pl.status.poison, poisoninfo = (poison > 0 ? poison + " 1:2" : poison < 0 ? -poison + " 1:7" : "") + (pl.neuro ? " 1:10" : "");
				hptext[j].text = pl.hp + "/" + pl.maxhp + "\n" + pl.deck.length + "cards" + (!cloakgfx.visible && game.expectedDamage[j] ? "\nDmg: " + game.expectedDamage[j] : "") + (poisoninfo ? "\n" + poisoninfo : "");
			}
		}
		Effect.next(cloakgfx.visible);
	}, endnext:function() {
		document.removeEventListener("keydown", onkeydown);
	}, cmds:cmds});
}
function deckPower(deck, amount) {
	if (amount > 1){
		var res = deck.slice();
		for (var i = 1;i < amount;i++) {
			Array.prototype.push.apply(res, deck);
		}
		return res;
	}else return deck;
}
module.exports = function(data, ai) {
	var game = new etg.Game(data.seed, data.flip);
	game.addData(data);
	game.player1.maxhp = game.player1.hp;
	game.player2.maxhp = game.player2.hp;
	var deckpower = [data.p1deckpower, data.p2deckpower];
	var decks = [data.urdeck, data.deck];
	for (var j = 0;j < 2;j++) {
		var pl = game.players(j);
		etgutil.iterdeck(decks[j], function(code){
			var idx;
			if (code in Cards.Codes) {
				pl.deck.push(Cards.Codes[code]);
			} else if (~(idx = etg.fromTrueMark(code))) {
				pl.mark = idx;
			}
		});
		if (deckpower[j]) {
			pl.deck = deckPower(pl.deck, deckpower[j]);
			pl.deckpower = deckpower[j];
		}
		else if (pl.drawpower > 1){
			pl.deck = deckPower(pl.deck, 2);
			pl.deckpower = 2;
		}
	}
	var foeDeck = game.player2.deck.slice();
	game.turn.drawhand(7);
	game.turn.foe.drawhand(7);
	if (data.foename) game.foename = data.foename;
	if (ai) game.ai = true;
	startMatch(game, foeDeck);
	return game;
}