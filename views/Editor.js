"use strict";
var px = require("../px");
var etg = require("../etg");
var gfx = require("../gfx");
var ui = require("../uiutil");
var chat = require("../chat");
var sock = require("../sock");
var Cards = require("../Cards");
var etgutil = require("../etgutil");
var options = require("../options");
module.exports = function(arena, acard, startempty) {
	if (!Cards.loaded) return;
	if (arena && (!sock.user || arena.deck === undefined || acard === undefined)) arena = false;
	function updateField(renderdeck){
		if (deckimport){
			deckimport.value = etgutil.encodedeck(decksprite.deck) + "01" + etg.toTrueMark(editormark);
			deckimport.dispatchEvent(new Event("change"));
		}
	}
	function sumCardMinus(cardminus, code){
		var sum = 0;
		for (var i=0; i<2; i++){
			for (var j=0; j<2; j++){
				sum += cardminus[etgutil.asShiny(etgutil.asUpped(code, i==0), j==0)] || 0;
			}
		}
		return sum;
	}
	function processDeck() {
		for (var i = decksprite.deck.length - 1;i >= 0;i--) {
			if (!(decksprite.deck[i] in Cards.Codes)) {
				var index = etg.fromTrueMark(decksprite.deck[i]);
				if (~index) {
					editormark = index;
				}
				decksprite.deck.splice(i, 1);
			}
		}
		marksprite.className = "Eicon E"+editormark;
		if (decksprite.deck.length > 60) decksprite.deck.length = 60;
		decksprite.deck.sort(etg.cardCmp);
		if (sock.user) {
			cardsel.cardminus = cardminus = {};
			for (var i = decksprite.deck.length - 1;i >= 0;i--) {
				var code = decksprite.deck[i], card = Cards.Codes[code];
				if (card.type != etg.PillarEnum) {
					if (sumCardMinus(cardminus, code) == 6) {
						decksprite.deck.splice(i, 1);
						continue;
					}
				}
				if (!card.isFree()) {
					if ((cardminus[code] || 0) < (cardpool[code] || 0)) {
						px.adjust(cardminus, code, 1);
					} else {
						code = etgutil.asShiny(code, !card.shiny);
						card = Cards.Codes[code];
						if (card.isFree()){
							decksprite.deck[i] = code;
						}else if ((cardminus[code] || 0) < (cardpool[code] || 0)) {
							decksprite.deck[i] = code;
							px.adjust(cardminus, code, 1);
						} else {
							decksprite.deck.splice(i, 1);
						}
					}
				}
			}
			if (arena){
				decksprite.deck.unshift(acard, acard, acard, acard, acard);
			}
		}
		updateField();
		decksprite.renderDeck(0);
	}
	function setCardArt(code){
		cardArt.texture = gfx.getArt(code);
		cardArt.visible = true;
	}
	function incrpool(code, count){
		if (code in Cards.Codes && (!arena || (!Cards.Codes[code].isOf(Cards.Codes[acard].asUpped(false).asShiny(false))) && (arena.lv || !Cards.Codes[code].upped))){
			if (code in cardpool) {
				cardpool[code] += count;
			} else {
				cardpool[code] = count;
			}
		}
	}
	var saveToQuick = false;
	function quickDeck(number) {
		return function() {
			if (saveToQuick) {
				saveButton();
				sock.userEmit("changequickdeck", { number: number, name: tname.textcache });
				sock.user.quickdecks[number] = tname.textcache;
				fixQuickButtons();
				saveToQuick = false;
				quickNum.className = quickNum.className.replace(/(?:^|\s)selectedbutton(?!\S)/g, '')
			}
			else {
				loadDeck(sock.user.quickdecks[number]);
			}
		}
	}
	function saveTo() {
		saveToQuick ^= true;
		if (saveToQuick) this.className += " selectedbutton"
		else this.className = this.className.replace(/(?:^|\s)selectedbutton(?!\S)/g, '')

	}
	function fixQuickButtons(){
		for (var i = 0;i < 10;i++) {
			if (sock.user.selectedDeck == sock.user.quickdecks[i]) buttons[i].className += " selectedbutton";
			else buttons[i].className = buttons[i].className.replace(/(?:^|\s)selectedbutton(?!\S)/g, '')
		}
	}
	function saveDeck(force){
		var dcode = etgutil.encodedeck(decksprite.deck) + "01" + etg.toTrueMark(editormark);
		var olddeck = sock.getDeck();
		if (decksprite.deck.length == 0){
			sock.userEmit("rmdeck", {name: sock.user.selectedDeck});
			delete sock.user.decknames[sock.user.selectedDeck];
		}else if (olddeck != dcode){
			sock.user.decknames[sock.user.selectedDeck] = dcode;
			sock.userEmit("setdeck", { d: dcode, name: sock.user.selectedDeck });
		}else if (force) sock.userEmit("setdeck", {name: sock.user.selectedDeck });
	}
	function loadDeck(x){
		if (!x) return;
		saveDeck();
		deckname.value = sock.user.selectedDeck = x;
		tname.text = x;
		fixQuickButtons();
		decksprite.deck = etgutil.decodedeck(sock.getDeck());
		processDeck();
	}
	function importDeck(){
		var dvalue = options.deck.trim();
		decksprite.deck = ~dvalue.indexOf(" ") ? dvalue.split(" ") : etgutil.decodedeck(dvalue);
		processDeck();
	}
	var cardminus, cardpool;
	if (sock.user){
		cardminus = {};
		cardpool = {};
		etgutil.iterraw(sock.user.pool, incrpool);
		etgutil.iterraw(sock.user.accountbound, incrpool);
	}else cardpool = null;
	var editorui = px.mkView(function(){cardArt.visible = false}), dom = [[8, 32, ["Clear", function(){
		if (sock.user) {
			cardsel.cardminus = cardminus = {};
		}
		decksprite.deck.length = arena?5:0;
		decksprite.renderDeck(decksprite.deck.length);
	}]]];
	function sumscore(){
		var sum = 0;
		for(var k in artable){
			sum += arattr[k]*artable[k].cost;
		}
		return sum;
	}
	function makeattrui(y, name){
		function modattr(x){
			arattr[name] += x;
			if (arattr[name] >= (data.min || 0) && (!data.max || arattr[name] <= data.max)){
				var sum = sumscore();
				if (sum <= arpts){
					bv.text = arattr[name];
					curpts.text = (arpts-sum)/45;
					return;
				}
			}
			arattr[name] -= x;
		}
		y = 128+y*20;
		var data = artable[name];
		var bv = px.domText(arattr[name]);
		var bm = px.domButton("-", modattr.bind(null, -(data.incr || 1)));
		var bp = px.domButton("+", modattr.bind(null, data.incr || 1));
		bm.style.width = bp.style.width = "14px";
		dom.push([4, y, name], [38, y, bm], [56, y, bv], [82, y, bp]);
	}
	function switchDeckCb(x){
		return function() {
			loadDeck(x.toString());
		}
	}
	function saveButton() {
		if (deckname.value) {
			sock.user.selectedDeck = deckname.value;
			fixQuickButtons();
			tname.text = sock.user.selectedDeck;
			saveDeck();
		}
	}
	var tutspan;
	function tutorialClick() {
		if (tutspan) {
			document.body.removeChild(tutspan);
			tutspan = null;
			return;
		}
		//100, 272, 800, 328
		var span = document.createElement("span");
		[[100, 32, 624, 198, "This is where the deck you are building shows up. Use the buttons to the left to save and load your deck: " +
		"\nClear: Erase this deck \nSave & Exit: Save the current deck and return to the main menu \nImport: Import a deck code from the import box \nSave: Save the current deck to the name in the name box in the top left" +
		"\nLoad: Load the deck wih the name you have typed in the name box in the top left \nSave to #: Save the current deck and name to one of the quickload slots \nTip: Use one of the quickdeck buttons as a \"New Deck\" button, and then save any decks you make there to a proper name"],
		[298, 6, 426, 24, "Clicking a quickload slot will instantly load the deck saved there"],
		[100, 232, 418, 38, "Choose a mark. You will gain 1 quantum per turn of that element. Mark of Chroma gives 3 random quanta."],
		[520, 234, 320, 24, "The import box shows the deck code of the deck"],
		[2, 350, 250, 100, "Click the element buttons to show cards of that element.\nThe rarity filters will only show cards of that rarity, except pillar filter which will show all cards.", ],
		[300, 350, 320, 48, "Clicking a card will add it to your deck. A number after a / shows how many shiny cards you have."],
		[80, 530, 310, 22, ": Shows all cards, including those you don't own"],
		[80, 575, 160, 22, ": Don't show shiny cards"]].forEach(function(info) {
			var div = px.domBox(info[2], info[3], "tutorialbox");
			div.style.position = "absolute";
			div.style.left = info[0] + "px";
			div.style.top = info[1] + "px";
			var text = px.domText(info[4]);
			text.style.color = "#000000";
			text.style.position = "absolute";
			text.style.left = 5 + "px";
			text.style.top = "50%";
			text.style.transform = "translateY(-50%)";
			div.appendChild(text);
			span.appendChild(div);
		});
		//40, 270, 620, 168,
		tutspan = span;
		document.body.appendChild(span);
	}
	var buttons;
	if (arena){
		dom.push([8, 58, ["Save & Exit", function() {
			if (decksprite.deck.length < 35 || sumscore()>arpts) {
				chat("35 cards required before submission");
				return;
			}
			var data = { d: etgutil.encodedeck(decksprite.deck.slice(5)) + "01" + etg.toTrueMark(editormark), lv: arena.lv };
			for(var k in arattr){
				data[k] = arattr[k];
			}
			if (!startempty){
				data.mod = true;
			}
			sock.userEmit("setarena", data);
			chat("Arena deck submitted");
			startMenu();
		}]], [8, 84, ["Exit", function() {
			require("./ArenaInfo")(arena);
		}]]);
		var arpts = arena.lv?515:425, arattr = {hp:parseInt(arena.hp || 200), mark:parseInt(arena.mark || 2), draw:parseInt(arena.draw || 1)};
		var artable = {
			hp: { min: 65, max: 200, incr: 45, cost: 1 },
			mark: { cost: 45 },
			draw: { cost: 135 },
		};
		var curpts = new px.domText((arpts-sumscore())/45);
		dom.push([4, 188, curpts])
		makeattrui(0, "hp");
		makeattrui(1, "mark");
		makeattrui(2, "draw");
	} else {
		var quickNum = px.domButton("Save to #", saveTo);
		dom.push([8, 58, ["Save & Exit", function() {
			if (sock.user) saveDeck(true);
			startMenu();
		}]], [8, 84, ["Import", importDeck]]);
		if (sock.user) {
			var tutorialbutton = px.domEButton(13,tutorialClick);
			dom.push([4,220,tutorialbutton]);
			var tname = px.domText(sock.user.selectedDeck);
			dom.push([100, 8, tname],
			[8, 110, ["Save", saveButton
			]], [8, 136, ["Load", function() {
				loadDeck(deckname.value);
			}]], [8, 162, ["Exit", function() {
				if (sock.user) sock.userEmit("setdeck", { name: sock.user.selectedDeck });
				startMenu();
			}]], [220, 8, quickNum]);
			buttons = new Array(10);
			for (var i = 0;i < 10;i++) {
				var b = px.domButton(i+1, quickDeck(i));
				b.style.width = "32px";
				dom.push([300 + i*36, 8, b]);
				buttons[i] = b;
			}
			fixQuickButtons();
		}
	}
	var marksprite = document.createElement("span");
	dom.push([66, 200, marksprite]);
	var editormark = 0;
	for (var i = 0;i < 13;i++) {
		(function(_i) {
			dom.push([100 + i * 32, 234,
				px.domEButton(i, function() {
				editormark = _i;
					marksprite.className = "Eicon E"+_i;
				updateField();
				})
			]);
		})(i);
	}
	var decksprite = new px.DeckDisplay(60, setCardArt,
		function(i){
			var code = decksprite.deck[i], card = Cards.Codes[code];
			if (!arena || code != acard){
				if (sock.user && !card.isFree()) {
					px.adjust(cardminus, code, -1);
				}
				decksprite.rmCard(i);
				updateField();
			}
		}, arena ? (startempty ? [] : etgutil.decodedeck(arena.deck)) : etgutil.decodedeck(sock.getDeck())
	);
	editorui.addChild(decksprite);
	var cardsel = new px.CardSelector(dom, setCardArt,
		function(code){
			if (decksprite.deck.length < 60) {
				var card = Cards.Codes[code];
				if (sock.user && !card.isFree()) {
					if (!(code in cardpool) || (code in cardminus && cardminus[code] >= cardpool[code]) ||
						(card.type != etg.PillarEnum && sumCardMinus(cardminus, code) >= 6)) {
						return;
					}
					px.adjust(cardminus, code, 1);
				}
				decksprite.addCard(code, arena?5:0);
				updateField();
			}
		}, !arena, !!cardpool
	);
	cardsel.cardpool = cardpool;
	cardsel.cardminus = cardminus;
	editorui.addChild(cardsel);
	var cardArt = new PIXI.Sprite(gfx.nopic);
	cardArt.position.set(734, 8);
	editorui.addChild(cardArt);
	if (!arena){
		if (sock.user){
			var deckname = document.createElement("input");
			deckname.id = "deckname";
			deckname.style.width = "80px";
			deckname.placeholder = "Name";
			deckname.value = sock.user.selectedDeck;
			deckname.addEventListener("keydown", function(e){
				if (e.keyCode == 13) {
					loadDeck(this.value);
				}
			});
			deckname.addEventListener("click", function(e){
				this.setSelectionRange(0, 99);
			});
			dom.push([4, 4, deckname]);
		}
		var deckimport = document.createElement("input");
		deckimport.id = "deckimport";
		deckimport.style.width = "190px";
		deckimport.style.height = "20px";
		deckimport.placeholder = "Deck";
		deckimport.addEventListener("click", function(){this.setSelectionRange(0, 333)});
		deckimport.addEventListener("keydown", function(e){
			if (e.keyCode == 13){
				this.blur();
				importDeck();
			}
		});
		options.register("deck", deckimport);
		dom.push([520, 238, deckimport]);
	}
	function resetCardArt() { cardArt.visible = false }
	document.addEventListener("mousemove", resetCardArt, true);
	px.refreshRenderer({ view: editorui, editdiv: dom, endnext: function() { document.removeEventListener("mousemove", resetCardArt, true); if (tutspan) document.body.removeChild(tutspan); } });

	if (!arena){
		deckimport.focus();
		deckimport.setSelectionRange(0, 333);
	}
	processDeck();
}
var startMenu = require("./MainMenu");