"use strict";
var etg = require("../etg");
var Cards = require("../Cards");
module.exports = function(game) {
	var limit = 333, cmdct, currentEval = game.player1.hp, casthash = [];
	function iterLoop(game, cmdct0){
		function iterCore(c) {
			if (!c || !c.canactive()) return;
			if (c.hash){
				var ch = c.hash();
				if (ch in casthash) return;
				else casthash[ch] = true;
			}
			var active = c instanceof etg.CardInstance ? c.card.type == etg.SpellEnum && c.card.active : c.active.cast;
			var cbits = game.tgtToBits(c) ^ 8;
			function evalIter(t) {
				if ((!game.targetingMode || (t && game.targetingMode(t))) && limit-- > 0) {
					var tbits = game.tgtToBits(t) ^ 8;
					var gameClone = game.clone();
					gameClone.bitsToTgt(cbits).useactive(gameClone.bitsToTgt(tbits));
					var v = gameClone.winner == gameClone.player2 ? -999 : gameClone.player1.hp;
					if (v < currentEval) {
						cmdct = cmdct0 || (cbits | tbits << 9);
						currentEval = v;
						if (!gameClone.winner){
							iterLoop(gameClone, cmdct);
						}
					}
				}
			}
			var preEval = currentEval;
			if (active && active.activename[0] in Cards.Targeting) {
				game.getTarget(c, active);
				if (c.owner.shield && c.owner.shield.status.reflective) evalIter(c.owner);
				evalIter(c.owner.foe);
				c.owner.creatures.forEach(function(cr){ if (cr.status.voodoo) evalIter(cr) });
				delete game.targetingMode;
			}else{
				evalIter();
			}
		}
		var p2 = game.player2;
		p2.hand.forEach(iterCore);
		p2.permanents.forEach(iterCore);
		p2.creatures.forEach(iterCore);
	}
	iterLoop(game);
	return [currentEval, cmdct];
}