"use strict";
var px = require("../px");
var gfx = require("../gfx");
var Cards = require("../Cards");
var etgutil = require("../etgutil");
var userutil = require("../userutil");
module.exports = function(data){
	var stage = px.mkView(), showbound = false;
	var cardpool = etgutil.deck2pool(data.pool);
	var boundpool = etgutil.deck2pool(data.bound);
	var cardArt = new PIXI.Sprite(gfx.nopic);
	cardArt.position.set(734, 8);
	stage.addChild(cardArt);
	var progressmax = 0, progress = 0, shinyprogress = 0;
	for(var code in Cards.Codes){
		var card = Cards.Codes[code];
		if (!card.upped && !card.shiny && card.type && !card.status.token){
			progressmax += 42;
			var upcode = etgutil.asUpped(code, true);
			progress += Math.min((cardpool[code] || 0) + (boundpool[code] || 0) + ((cardpool[upcode] || 0) + (boundpool[upcode] || 0))*6, 42);
			code = etgutil.asShiny(code, true);
			upcode = etgutil.asUpped(code, true);
			shinyprogress += Math.min((cardpool[code] || 0) + (boundpool[code] || 0) + ((cardpool[upcode] || 0) + (boundpool[upcode] || 0))*6, 42);
		}
	}
	var wealth = data.gold + userutil.calcWealth(cardpool);
	var dom = [[100, 16, "Cumulative wealth: " + Math.round(wealth) + "\nZE Progress: " + progress + " / " + progressmax + "\nSZE Progress: " + shinyprogress + " / " + progressmax],
		[5, 554, ["Toggle Bound", function(){
			cardsel.cardpool = (showbound ^= true) ? boundpool : cardpool;
		}]],
		[10, 10, ["Exit", require("./MainMenu")]],
	];
	var cardsel = new px.CardSelector(dom, function(code){
		cardArt.texture = gfx.getArt(code);
	}, null, null, true);
	cardsel.cardpool = cardpool;
	stage.addChild(cardsel);
	px.refreshRenderer({view:stage, stext: dom});
}