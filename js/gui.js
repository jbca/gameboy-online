var inFullscreen = false;

// mapping setting control ids to emulator setting ids
var setting_map = {
	enable_sound: 0,
	enable_mono_sound: 1,
	disable_colors: 2,
	bmp_method: 5,
	auto_frameskip: 7,
	rom_only_override: 9,
	mbc_enable_override: 10,
	enable_gbc_bios: 16,
	enable_colorization: 17,
	software_resizing: 21,
	typed_arrays_disallow: 22
};

function cout(message, colorIndex) {
	var terminal_output = document.getElementById("terminal_output");
	if ((colorIndex != 0 || DEBUG_MESSAGES) && (colorIndex != -1 || DEBUG_WINDOWING)) {
		var lineout = document.createElement('span');
		lineout.appendChild(document.createTextNode(message));
		switch (colorIndex) {
			case -1:
			case 0:
				lineout.className = "white";
				break;
			case 1:
				lineout.className = "yellow";
				break;
			case 2:
				lineout.className = "red";
		}
		terminal_output.appendChild(lineout);
		terminal_output.appendChild(document.createElement('br'));
		terminal_output.scrollTop = terminal_output.scrollHeight - terminal_output.clientHeight;
	}
}

function clear_terminal() {
	var terminal_output = document.getElementById("terminal_output");
	while (terminal_output.firstChild != null) {
		terminal_output.removeChild(terminal_output.firstChild);
	}
}


function guiInitialize() {
	// Initialize expanding/hiding headers
	$(".next-toggler").each(function() {
		var symbol = $(this);
		var heading = symbol.parent();
		var next = heading.next();
		
		heading.css("cursor", "pointer");
		
		heading.click(function() {
			if(symbol.text() == "[+]") {
				symbol.text("[-]");
				next.show(100);
			} else {
				symbol.text("[+]");
				next.hide(100);
			}
			return false;
		});
	});
	
	// Initialize scale buttons
	$("#scale-choices .scale").click(function() {
		var scale = { "1x": 1, "2x": 2, "4x": 4 }[$(this).text()];
		$("#scale-choices .scale").css("font-weight", "normal");
		$(this).css("font-weight", "bold");
		
		$("#gfx").width(160 * scale);
		$("#gfx").height(144 * scale);
	});
	
	try {
		//Hook the GUI controls.
		registerGUIEvents();
		//Load any save states:
		loadSaveStates();
	}
	catch (error) {
		cout("Fatal gui error: \"" + error.message + "\" file:" + error.fileName + " line: " + error.lineNumber, 2);
	}
	try {
		try {
			//Check for mozAudio
			var audiohook = new Audio();
			audiohook.mozSetup(2, 44100);
		}
		catch (error) {
			//Check for the proposed standard Audio API's context object.
			if (typeof AudioContext == "undefined") {
				throw(new Error(""));
			}
		}
	}
	catch (error) {
		//settings[0] = false;	//Turn off audio by default
		settings[1] = true;		//Mono on non-native to speed it up.
		//cout("Native audio sample writing support not found, audio turned off by default.", 1);
	}
	
	// Set settings controls to emulator's values
	
	for(name in setting_map) {
		document.getElementById(name).checked = settings[setting_map[name]];
	}
}
function registerGUIEvents() {
	cout("In registerGUIEvents() : Registering GUI Events.", -1);
	
	$("#terminal_clear_button").click(clear_terminal);
	
	$(document).keydown(function (event) {
		if (event.keyCode == 27) {
			//Fullscreen on/off
			fullscreenPlayer();
		}
		else {
			//Control keys / other
			GameBoyKeyDown(event);
		}
	});
	
	$(document).keyup(GameBoyKeyUp);
	//$(window).bind("MozOrientation", GameBoyJoyStickSignalHandler);
	
	$("#data_uri_clicker").click(function () {
		var datauri = prompt("Please input the ROM image's Base 64 Encoded Text:", "");
		if (datauri != null && datauri.length > 0) {
			try {
				cout(Math.floor(datauri.length * 3 / 4) + " bytes of data submitted by form (text length of " + datauri.length + ").", 0);
				start(document.getElementsByTagName("canvas")[0],  document.getElementById("canvasAltContainer"), base64_decode(datauri));
				initPlayer();
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
	});
	
	$("#external_file_clicker").click(function () {
		var address = prompt("Please input the ROM image's URL:", "");
		if (address != null && address.length > 0) {
			try {
				new Ajax({
					URL:"res/proxy.php",
					GET:["url=" + escape(address)],
					Accept:"TEXT",
					Cached:true,
					Fail:function (error_message) {
						cout("Failed to load the ROM file through XmlHttpRequest.\r\nReason: " + error_message, 2);
					},
					Complete:function () {
						try {
							var romStream = base64_decode(arguments[1]);
							cout(romStream.length + " bytes of base64 decoded data retrieved by XHR (text length of " + arguments[1].length + ").", 0);
							start(document.getElementsByTagName("canvas")[0],  document.getElementById("canvasAltContainer"), romStream);
							initPlayer();
						}
						catch (error) {
							alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
						}
					}
				});
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
	});
	
	$("#local_file_open").change(function () {
		if (typeof this.files != "undefined") {
			try {
				if (this.files.length >= 1) {
					cout("Reading the local file \"" + this.files[0].name + "\"", 0);
					try {
						//Gecko 1.9.2+ (Standard Method)
						var binaryHandle = new FileReader();
						binaryHandle.onload = function () {
							if (this.readyState == 2) {
								cout("file loaded.", 0);
								try {
									start(document.getElementsByTagName("canvas")[0], document.getElementById("canvasAltContainer"), this.result);
									initPlayer();
								}
								catch (error) {
									alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
								}
							}
							else {
								cout("loading file, please wait...", 0);
							}
						}
						binaryHandle.readAsBinaryString(this.files[this.files.length - 1]);
					}
					catch (error) {
						cout("Browser does not support the FileReader object, falling back to the non-standard File object access,", 2);
						//Gecko 1.9.0, 1.9.1 (Non-Standard Method)
						var romImageString = this.files[this.files.length - 1].getAsBinary();
						try {
							start(document.getElementsByTagName("canvas")[0], document.getElementById("canvasAltContainer"), romImageString);
							initPlayer();
						}
						catch (error) {
							alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
						}
						
					}
				}
				else {
					cout("Incorrect number of files selected for local loading.", 1);
				}
			}
			catch (error) {
				cout("Could not load in a locally stored ROM file.", 2);
			}
		}
		else {
			cout("could not find the handle on the file to open.", 2);
		}
	});
	
	$("#restart_cpu_clicker").click(function () {
		if (typeof gameboy == "object" && gameboy != null && typeof gameboy.ROMImage == "string") {
			try {
				if (!gameboy.fromSaveState) {
					start(document.getElementsByTagName("canvas")[0], document.getElementById("canvasAltContainer"), gameboy.ROMImage);
					initPlayer();
				}
				else {
					openState(gameboy.savedStateFileName, document.getElementsByTagName("canvas")[0],  document.getElementById("canvasAltContainer"));
					initPlayer();
				}
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
		else {
			cout("Could not restart, as a previous emulation session could not be found.", 1);
		}
	});
	
	$("#cpu_toggle_clicker").toggle(function() {
		pause();
		$(this).text("Resume");
	}, function() {
		run();
		$(this).text("Pause");
	});
	
	$("#save_state_clicker").click(save);
	
	// update settings on click of controls
	$(".boolean-settings input").click(function() {
		settings[setting_map[this.id]] = this.checked;
	});
	
	// for settings that require specific actions on change:
	
	$("#enable_sound").click(function () {
		settings[setting_map[this.id]] = this.checked;
		
		if (typeof gameboy == "object" && gameboy != null) {
			gameboy.initSound();
		}
	});
	
	$("#enable_mono_sound").click(function () {
		settings[setting_map[this.id]] = this.checked;
		
		if (typeof gameboy == "object" && gameboy != null) {
			gameboy.initSound();
		}
	});
	
	$("#auto_frameskip").click(function () {
		settings[setting_map[this.id]] = this.checked;
		
		settings[4] = 0;	//Reset the frame skipping amount.
	});
	
	$("#enable_colorization").click(function () {
		settings[setting_map[this.id]] = this.checked;
		
		if (typeof gameboy == "object" && gameboy != null) {
			gameboy.checkPaletteType();
		}
	});
	
	$("#software_resizing").click(function () {
		settings[21] = this.checked;
		
		if (typeof gameboy == "object" && gameboy != null && !gameboy.canvasFallbackHappened) {
			initNewCanvasSize();
			gameboy.initLCD();
		}
	});
	
	$("#view_fullscreen").click(fullscreenPlayer);
	
	$("#gfx").mouseup(onResizeOutput);
	$(window).resize(onResizeOutput);
}
function onResizeOutput() {
	if (typeof gameboy == "object" && gameboy != null && !gameboy.canvasFallbackHappened && settings[21]) {
		cout("Resizing canvas.", 0);
		initNewCanvasSize();
		gameboy.initLCD();
	}
}
function initNewCanvasSize() {
	if (!settings[21]) {
		gameboy.canvas.width = gameboy.width = 160;
		gameboy.canvas.height = gameboy.height = 144;
	}
	else {
		gameboy.canvas.width = gameboy.width = gameboy.canvas.clientWidth;
		gameboy.canvas.height = gameboy.height = gameboy.canvas.clientHeight;
	}
	gameboy.pixelCount = gameboy.width * gameboy.height;
	gameboy.rgbCount = gameboy.pixelCount * 4;
	gameboy.widthRatio = 160 / gameboy.width;
	gameboy.heightRatio = 144 / gameboy.height;
}
function initPlayer() {
	if (typeof gameboy == "object" && gameboy != null && !gameboy.canvasFallbackHappened) {
		initNewCanvasSize();
		if (settings[21]) {
			gameboy.initLCD();
		}
	}
	$("#fullscreenContainer").hide();
}
function fullscreenPlayer() {
	if (typeof gameboy == "object" && gameboy != null && !gameboy.canvasFallbackHappened) {
		if (!inFullscreen) {
			gameboy.canvas = document.getElementById("fullscreen");
			$("#fullscreenContainer").show();
			$("body").css("overflow", "hidden");
		}
		else {
			gameboy.canvas = document.getElementsByTagName("canvas")[0];
			$("#fullscreenContainer").hide();
			$("body").css("overflow", "default");
		}
		initNewCanvasSize();
		gameboy.initLCD();
		inFullscreen = !inFullscreen;
	}
	else {
		cout("Cannot go into fullscreen mode.", 2);
	}
}
//Check for existing saves states on startup and add each to the menu:
function loadSaveStates() {
	try {
		if (findValue("state_names") != null) {
			var states = findValue("state_names");
			for (var index = 0; index < states.length; index++) {
				cout("Adding the save state \""+ states[index] + "\" drop down menu.", 0);
				addSaveStateItem(states[index]);
			}
		}
	}
	catch (error) {
		cout("A problem with attempting to load save states occurred.", 2);
	}
}
//Add a save state to the menu:
function addSaveStateItem(filename) {
	var new_item = document.createElement("li");
	new_item.appendChild(document.createTextNode(filename));
	document.getElementById("save_states").appendChild(new_item);
	addEvent("click", new_item, function () {
		try {
			if (findValue("state_names") != null) {
				var states = findValue("state_names");
				cout("Attempting to find a save state record with the name: \"" + this.firstChild.data + "\"", 0);
				for (var romState in states) {
					if (states[romState] == this.firstChild.data) {
						openState(states[romState], document.getElementsByTagName("canvas")[0],  document.getElementById("canvasAltContainer"));
						initPlayer();
					}
				}
			}
			else {
				cout("The selected save state seems to be missing.", 2);
			}
		}
		catch (error) {
			cout("A problem with attempting to open the selected save state occurred.", 2);
		}
	});
}
//Wrapper for localStorage getItem, so that data can be retrieved in various types.
function findValue(key) {
	try {
		if (window.localStorage.getItem(key) != null) {
			return JSON.parse(window.localStorage.getItem(key));
		}
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		if (window.globalStorage[location.hostname].getItem(key) != null) {
			return JSON.parse(window.globalStorage[location.hostname].getItem(key));
		}
	}
	return null;
}
//Wrapper for localStorage setItem, so that data can be set in various types.
function setValue(key, value) {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		window.globalStorage[location.hostname].setItem(key, JSON.stringify(value));
	}
}
//Some wrappers and extensions for non-DOM3 browsers:
function isDescendantOf(ParentElement, toCheck) {
	//Verify an object as either a direct or indirect child to another object.
	function traverseTree(domElement) {
		while (domElement != null) {
			if (domElement.nodeType == 1) {
				if (isSameNode(domElement, toCheck)) {
					return true;
				}
				if (hasChildNodes(domElement)) {
					if (traverseTree(domElement.firstChild)) {
						return true;
					}
				}
			}
			domElement = domElement.nextSibling;
		}
		return false;
	}
	return traverseTree(ParentElement.firstChild);
}
function hasChildNodes(oElement) {
	return (typeof oElement.hasChildNodes == "function") ? oElement.hasChildNodes() : ((oElement.firstChild != null) ? true : false);
}
function isSameNode(oCheck1, oCheck2) {
	return (typeof oCheck1.isSameNode == "function") ? oCheck1.isSameNode(oCheck2) : (oCheck1 === oCheck2);
}
function pageXCoord(event) {
	if (typeof event.pageX == "undefined") {
		return event.clientX + document.documentElement.scrollLeft;
	}
	return event.pageX;
}
function pageYCoord(event) {
	if (typeof event.pageY == "undefined") {
		return event.clientY + document.documentElement.scrollTop;
	}
	return event.pageY;
}
function mouseLeaveVerify(oElement, event) {
	//Hook target element with onmouseout and use this function to verify onmouseleave.
	return isDescendantOf(oElement, (typeof event.target != "undefined") ? event.target : event.srcElement) && !isDescendantOf(oElement, (typeof event.relatedTarget != "undefined") ? event.relatedTarget : event.toElement);
}
function mouseEnterVerify(oElement, event) {
	//Hook target element with onmouseover and use this function to verify onmouseenter.
	return !isDescendantOf(oElement, (typeof event.target != "undefined") ? event.target : event.srcElement) && isDescendantOf(oElement, (typeof event.relatedTarget != "undefined") ? event.relatedTarget : event.fromElement);
}

function addEvent(event, element, f) {
	$(element).bind(event, f);
}
