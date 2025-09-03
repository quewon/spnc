var ENV = "editor";

var editor = {
    supportedImageFormats: ["jpg", "jpeg", "png", "gif"],
    supportedAudioFormats: ["mp3", "wav", "ogg"],
    grabbedObject: null,
    grabOffset: null,
    scrollOffset: null,
    selectedObject: null,
    disablePrompts: false,
    selectedSoundObject: null,
    shiftPressed: false,
    gameWidth: 800,
    gameHeight: 600
}
var game;

// asset folder

function allSprites() {
    var sprites = [
        game.cursorDefault,
        game.cursorDown
    ];
    for (let sound in game.sounds) {
        sprites.push(game.sounds[sound]);
    }
    for (let sceneName in game.scenes) {
        let scene = game.scenes[sceneName];
        if (scene.background)
            sprites.push(scene.background);
        for (let object of scene.objects) {
            if (object.sprite)
                sprites.push(object.sprite);
        }
    }   
    return sprites;
}

function clearAssetFolder() {
    if (document.querySelector(".user.folder"))
        document.querySelector(".user.folder").remove();
    for (let sprite of allSprites()) {
        if (sprite.src && !sprite.src.includes("_preset/")) {
            sprite.loaded = false;
        }
    }
    _cursordefault.title = "drop default cursor image here";
    _cursordown.title = "drop held cursor image here";
    _cursordefault.style.backgroundImage = `url(${Game.defaultCursorDefault.src})`;
    _cursordown.style.backgroundImage = `url(${Game.defaultCursorDown.src})`;
    _sfxdropzone.title = "drop sound file here";
}

function loadAssetFolder(files) {
    clearAssetFolder();
    var structure = getFolderStructure(files);
    var userFolder = createFolderElement(_filesystem, Object.keys(structure)[0], structure);
    userFolder.classList.add("user");
    userFolder.querySelector("details").open = true;
    userFolder.querySelector("summary").focus();
    game.windowresize();
    _folderpicker.value = "";
    if (game.cursorDefault.src !== Game.defaultCursorDefault.src) {
        _cursordefault.title = game.cursorDefault.src;
        _cursordefault.style.backgroundImage = `url(${game.cursorDefault.image.src})`;
    }
    if (game.cursorDown.src !== Game.defaultCursorDown.src) {
        _cursordown.title = game.cursorDown.src;
        _cursordown.style.backgroundImage = `url(${game.cursorDown.image.src})`;
    }
    game.setScene(game.currentScene);
}

function getFolderStructure(files) {
    const structure = {};
    for (let file of files) {
        const pathParts = (file.webkitRelativePath || file.path).split('/');
        let current = structure;
        for (let i = 0; i < pathParts.length - 1; i++) {
            const dirName = pathParts[i];
            if (!current[dirName]) {
                current[dirName] = { kind: "directory", children: {} };
            }
            current = current[dirName].children;
        }
        const filename = pathParts[pathParts.length - 1];
        const filenameParts = filename.split(".");
        const ext = filenameParts[filenameParts.length - 1];
        if (editor.supportedImageFormats.includes(ext)) {
            current[filename] = { 
                kind: "image", 
                path: file.webkitRelativePath || file.path,
                file: file
            };
        } else if (editor.supportedAudioFormats.includes(ext)) {
            current[filename] = { 
                kind: "audio",
                path: file.webkitRelativePath || file.path,
                file: file
            };
        }
    };
    return structure;
}

function createFolderElement(parentElement, directoryName, parent) {
    const el = document.createElement("li");
    el.className = "folder";
    parentElement.appendChild(el);

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = directoryName;
    summary.title = "folder";
    setLabel(summary);
    details.appendChild(summary);
    el.appendChild(details);

    const list = document.createElement("ul");
    details.appendChild(list);
    for (const name in parent[directoryName].children) {
        if (parent[directoryName].children[name].kind !== "directory")
            continue;
        createFolderElement(list, name, parent[directoryName].children);
    }
    for (const name in parent[directoryName].children) {
        switch (parent[directoryName].children[name].kind) {
            case "image":
                createImageFileElement(list, name, parent[directoryName].children);
                break;
            case "audio":
                createAudioFileElement(list, name, parent[directoryName].children);
                break;
        }
    }
    return el;
}

function createAudioFileElement(parentElement, filename, parent) {
    const el = document.createElement("li");
    el.className = "file";
    el.textContent = filename;
    parentElement.appendChild(el);

    const filepath = parent[filename].path;
    const file = parent[filename].file;
    const url = URL.createObjectURL(file);
    const sprite = new Sprite({
        src: "_preset/music.png",
        onload: function() { this.classList.add("loaded") }.bind(el)
    });
    el.addEventListener("mousedown", () => {
        if (el.classList.contains("loaded")) {
            document.body.classList.add("dragging");
            let scene = game.scenes[game.currentScene];
            let object = new GameObject({
                scene,
                sprite: { src: "_preset/music.png", buffer: sprite.buffer },
                script: `// SFX OBJECT -- drag me into the sfx file box!
//SRC:${filepath}
//URL:${url}`,
                position: [
                    game.mouse.position[0] - sprite.width/2,
                    game.mouse.position[1] - sprite.height/2
                ]
            });
            scene.addObject(object);
            grabObject(object);
        }
    })
    el.title = "audio file";
    setLabel(el);

    for (let sprite of allSprites()) {
        if (sprite.src === filepath) {
            sprite.setSource(url);
        }
    }

    return el;
}

function createImageFileElement(parentElement, filename, parent) {
    const el = document.createElement("li");
    el.className = "file";
    el.textContent = filename;
    parentElement.appendChild(el);

    const filepath = parent[filename].path;
    const file = parent[filename].file;
    const url = URL.createObjectURL(file);

    const sprite = new Sprite({
        src: filepath,
        objectURL: url,
        onload: function() { this.classList.add("loaded") }.bind(el)
    });
    el.addEventListener("mousedown", () => {
        if (el.classList.contains("loaded")) {
            document.body.classList.add("dragging");
            let scene = game.scenes[game.currentScene];
            let object = new GameObject({
                scene,
                sprite: {
                    src: filepath,
                    objectURL: url
                },
                position: [
                    game.mouse.position[0] - sprite.width/2,
                    game.mouse.position[1] - sprite.height/2
                ]
            });
            scene.addObject(object);
            grabObject(object);
        }
    })
    el.title = "image file";
    setLabel(el);

    for (let sprite of allSprites()) {
        if (sprite.src === filepath) {
            sprite.loaded = false;
            sprite.image.src = url;
        }
    }

    return el;
}

// save & load game

async function exportGame() {
    var error;

    while (_exportscenes.lastElementChild)
        _exportscenes.lastElementChild.remove();
    for (let scene in game.scenes) {
        let option = document.createElement("option");
        option.textContent = scene;
        option.value = scene;
        _exportscenes.appendChild(option);
    }
    _exportcanceled.checked = true;
    _exporttitle.value = "";
    _exporttitle.placeholder = game.name;
    _exportscenes.value = game.currentScene;
    _export.showModal();
    await new Promise(resolve => {
        _export.onclose = () => {
            if (!_exportcanceled.checked) {
                if (_exporttitle.value.trim() !== "") {
                    game.name = _exporttitle.value.trim();
                    document.title = game.name;
                }
                game.setScene(_exportscenes.value);
            }
            resolve();
        }
    })
    if (_exportcanceled.checked)
        return;

    var zip = new JSZip();
    
    var res = [
        "_lib/typeset/typeset.min.js",
        "_lib/typeset/LICENSE",
    ];
    var objecturl = [];
    for (let sprite of allSprites()) {
        if (sprite.src.includes("_preset/"))
            res.push(sprite.src);
        else
            objecturl.push(sprite);
    }
    if (res.length > 0) {
        await Promise.all(
            res.map(async path => {
                const blob = await fetch(path, {cache: "force-cache"})
                .then(x => x.blob());
                return { path, blob }
            })
        ).then(dataArray => {
            for (let data of dataArray) {
                zip.file(data.path, data.blob);
            }
        }).catch(() => {
            error = 1;
            console.error("_preset and _lib fetch unsuccessful.");
        })
    }
    if (objecturl.length > 0) {
        for (let sprite of objecturl) {
            zip.file(
                sprite.src, 
                await fetch(sprite.buffer ? sprite.url : sprite.image.src, {cache: "force-cache"})
                    .then(res => res.blob())
                    .catch(() => {
                        error = 1;
                        console.error("asset fetch unsuccessful.");
                    })
            );
        }
    }
    
    var html;
    await Promise.all([
        fetch("template.html", {cache: "force-cache"}).then(x => x.text()),
        fetch("game/util.js", {cache: "force-cache"}).then(x => x.text()),
        fetch("game/sprite.js", {cache: "force-cache"}).then(x => x.text()),
        fetch("game/dialogue.js", {cache: "force-cache"}).then(x => x.text()),
        fetch("game/game.js", {cache: "force-cache"}).then(x => x.text()),
    ]).then(([template, util, sprite, dialogue, gamejs]) => {
        html = template
               .replace("GAME_TITLE_", game.name)
               .replace("GAME_UTIL_JS_", util)
               .replace("GAME_SPRITE_JS_", sprite)
               .replace("GAME_DIALOGUE_JS_", dialogue)
               .replace("GAME_GAME_JS_", gamejs)
               .replace("GAME_DATA_", JSON.stringify(game.generateData()))
    }).catch(() => {
        error = 1;
        console.error("template & game scripts fetch unsuccessful.");
    })

    if (error) {
        alert("failed to download necessary files :(");
        return;
    }

    zip.file("index.html", html);
    zip.generateAsync({ type: "blob" })
    .then(function(content) {
        saveAs(content, game.name + ".zip");
    });
}

function loadGame(file) {
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
        const data = JSON.parse(reader.result);
        for (let sprite of allSprites()) {
            if (sprite.buffer)
                sprite.stop();
        }
        game.destroy();
        clearAssetFolder();
        game = new Game(data);
        updateGame();
        updateScenes();
        updateSounds();
        _folderpickerbutton.focus();
    })
    if (file)
        reader.readAsText(file);
    _loadbutton.value = "";
}

async function saveGame() {
    const promptvalue = await prompt("what will you name this file?", game.name);
    if (promptvalue === null)
        return;
    const filename = promptvalue.trim();
    game.name = filename;
    document.title = game.name;
    const file = new Blob([JSON.stringify(game.generateData())], { type: "text/plain" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename + ".spnc";
    a.click();
    window.URL.revokeObjectURL(url);
}

// object handling

function containsElement(container, element) {
    if (!element.parentElement)
        return false;
    if (element.parentElement === container)
        return true;
    return (containsElement(container, element.parentElement));
}

function grabObject(object) {
    document.body.classList.add("dragging");
    editor.grabbedObject = object;
    editor.grabOffset = [
        object.position[0] - game.mouse.position[0],
        object.position[1] - game.mouse.position[1]
    ]
    let scene = object.scene;
    scene.removeObject(object);
    scene.addObject(object);
}

function duplicateObject(object) {
    var duplicate = new GameObject(object);
    duplicate.sprite = new Sprite(object.sprite);
    return duplicate;
}

function selectObject(object) {
    editor.selectedObject = object;
    _objectpreview.src = object.sprite.image.src;
    _objectpreview.title = object.sprite.src;
    _objectscript.value = object.script;
    _objectscript.oninput = () => {
        object.scriptChanged = true;
        object.script = _objectscript.value;
        object.dialogue = new Dialogue({
            text: object.script,
            game
        });
    }
    _objectmenu.classList.remove("hidden");
    _gamemenu.classList.add("hidden");
    _objectscript.focus();
}

function deselectObject() {
    editor.selectedObject = null;
    _objectmenu.classList.add("hidden");
    _gamemenu.classList.remove("hidden");
}

function setSceneBackground() {
    var object = editor.grabbedObject;
    if (object) {
        game.scenes[game.currentScene].background = new Sprite({ src: object.sprite.src, objectURL: object.sprite.image.src });
        _scenebg.style.backgroundImage = `url(${object.sprite.image.src})`;
        _scenebg.title = object.sprite.src;
    }
}

function setCursorDefault() {
    var object = editor.grabbedObject;
    if (object) {
        game.cursorDefault = new Sprite({ src: object.sprite.src, objectURL: object.sprite.image.src });
        _cursordefault.style.backgroundImage = `url(${object.sprite.image.src})`;
        _cursordefault.title = object.sprite.src;
    }
}

function setCursorDown() {
    var object = editor.grabbedObject;
    if (object) {
        game.cursorDown = new Sprite({ src: object.sprite.src, objectURL: object.sprite.image.src });
        _cursordown.style.backgroundImage = `url(${object.sprite.image.src})`;
        _cursordown.title = object.sprite.src;
    }
}

function addDialogueType() {
    type = _dialoguetypename.value;
    type = type.trim();
    if (type === "") {
        alert("this dialogue type needs a name.");
        return;
    }
    if (game.specialDialogueIds.includes(type)) {
        alert(`sorry, the name "${type}" is reserved.`);
        return;
    }
    if (game.dialogueTypes[type]) {
        alert(`a dialogue type called "${type}" already exists!`);
        return;
    }
    _dialoguetypename.value = "";
    game.dialogueTypes[type] = {};
    updateDialogueTypes();
}

function selectSound() {
    if (!editor.grabbedObject)
        return;
    editor.selectedSoundObject = editor.grabbedObject;
    _sfxdropzone.style.backgroundImage = `url(${editor.selectedSoundObject.sprite.image.src})`;
    _sfxdropzone.title = editor.grabbedObject.sprite.src;
}

function addSound() {
    let sound = _sfxname.value.trim();
    if (sound === "") {
        alert("this sound needs a name.");
        return;
    }
    if (game.sounds[sound]) {
        alert(`a sound called "${sound}" already exists!`);
        return;
    }
    if (!editor.selectedSoundObject) {
        alert("no sound file selected.");
        return;
    }
    let lines = editor.selectedSoundObject.script.split("\n");
    let path = lines[1]?.split(":").splice(1).join(":");
    let url = lines[2]?.split(":").splice(1).join(":");
    if (!path || !url) {
        alert("invalid sfx object. did you modify its script?");
        return;
    }
    game.sounds[sound] = new AudioSprite({
        src: path,
        objectURL: url
    });
    _sfxdropzone.style.backgroundImage = "none";
    _sfxname.value = "";
    _sfxdropzone.title = "drop sound file here";
    editor.selectedSoundObject = null;
    updateSounds();
}

function addScene() {
    let id = _newscenename.value.trim();
    if (id === "") {
        alert("this scene needs a name.");
        return;
    }
    if (game.scenes[id]) {
        alert(`a scene called "${id}" already exists!`);
        return;
    }
    game.scenes[id] = new Scene({ game });
    game.setScene(id);
    _newscenename.value = "";
    updateScenes();
}

function renameScene() {
    let id = _scenename.value.trim();
    if (id === "") {
        _scenename.value = game.currentScene;
        return;
    }
    _scenename.value = id;
    if (id === game.currentScene)
        return;
    if (game.scenes[id]) {
        alert(`a scene called "${id}" already exists!`);
        return;
    }
    game.scenes[id] = game.scenes[game.currentScene];
    delete game.scenes[game.currentScene];
    game.currentScene = id;
    updateScenes();
}

async function deleteScene() {
    game.stopSounds();
    if (
        (game.scenes[game.currentScene].hasContent()) &&
        !(await confirm(`delete the scene "${game.currentScene}"?`))
    )
        return;
    delete game.scenes[game.currentScene];
    if (Object.keys(game.scenes).length === 0) {
        game.scenes.main = new Scene({ game });
        game.setScene("main");
    } else {
        game.setScene(Object.keys(game.scenes)[0]);
    }
    updateScenes();
}

function duplicateScene() {
    var duplicate = new Scene(game.scenes[game.currentScene]);
    var name = game.currentScene + " copy";
    game.scenes[name] = duplicate;
    game.setScene(name);
    updateScenes();
}

// ui

function setLabel(el) {
    el.addEventListener("mouseover", function() {
        _hoveralt.textContent = this.title;
    })
    el.addEventListener("mouseout", function() {
        _hoveralt.textContent = "";
    })
}

function switchMode() {
    if (ENV === "editor") {
        ENV = "game";
        document.body.classList.add("game");
        _modebutton.textContent = "PLAY MODE";
        game.setScene(game.currentScene);
    } else {
        ENV = "editor";
        document.body.classList.remove("game");
        _modebutton.textContent = "EDITOR MODE";
        game.dialogue = null;
    }
}

function updateGame() {
    _gamewidth.value = game.canvas.width;
    _gameheight.value = game.canvas.height;
    document.title = game.name;
}

function updateScenes() {
    while (_sceneselect.lastElementChild)
        _sceneselect.lastElementChild.remove();
    for (let scene in game.scenes) {
        let option = document.createElement("option");
        option.value = scene;
        option.textContent = scene;
        _sceneselect.appendChild(option);
    }
    _sceneselect.value = game.currentScene;
}

function updateSounds() {
    while (_soundslist.lastElementChild)
        _soundslist.lastElementChild.remove();
    for (let sound in game.sounds) {
        _soundslist.appendChild(createSoundElement(sound, () => {
            game.stopSound(sound);
            delete game.sounds[sound];
            updateSounds();
        }));
    }
    updateDialogueTypes();
}

function createSoundElement(sound, onremove) {
    var flex = document.createElement("div");
    flex.classList.add("flex");

    var input = document.createElement("input");
    input.classList.add("expand");
    input.type = "text";
    input.value = sound;
    input.title = game.sounds[sound].src;
    setLabel(input);
    input.addEventListener("change", () => {
        if (game.sounds[sound].playing)
            game.stopSound(sound);
        if (input.value.trim() === "") {
            alert("this sound needs a name.");
            return;
        }
        var newSound = input.value.trim();
        if (game.sounds[newSound] && newSound !== sound) {
            alert(`a sound called "${newSound}" already exists.`);
            input.value = sound;
            return;
        }
        input.value = newSound;
        game.sounds[newSound] = game.sounds[sound];
        delete game.sounds[sound];
        flex.replaceWith(createSoundElement(newSound, onremove));
        updateDialogueTypes();
    })
    flex.appendChild(input);

    var loopButton = document.createElement("button");
    loopButton.type = "button";
    loopButton.textContent = "⟳";
    loopButton.title = "loop sound toggle";
    setLabel(loopButton);
    loopButton.onclick = () => {
        game.sounds[sound].setLoop(!game.sounds[sound].loop);
        if (game.sounds[sound].loop) {
            loopButton.classList.add("toggled");
        } else {
            loopButton.classList.remove("toggled");
        }
    };
    if (game.sounds[sound].loop)
        loopButton.classList.add("toggled");
    flex.appendChild(loopButton);

    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "▶";
    button.title = "preview sound";
    button.dataset.sound = sound;
    setLabel(button);
    button.onclick = () => {
        if (!game.sounds[sound].playing) {
            game.playSound(sound);
        } else {
            game.stopSound(sound);
        }
    };
    flex.appendChild(button);

    var removebutton = document.createElement("button");
    removebutton.classList.add("delete");
    removebutton.type = "button";
    removebutton.textContent = "delete";
    removebutton.title = "remove sound";
    setLabel(removebutton, removebutton.title);
    removebutton.onclick = onremove;
    flex.appendChild(removebutton);

    return flex;
}

function updateDialogueTypes() {
    var openTypes = [];
    var scrollTop = _gamemenu.scrollTop;
    while (_dialoguetypes.lastElementChild) {
        if (_dialoguetypes.lastElementChild.open)
            openTypes.push(_dialoguetypes.lastElementChild.querySelector("summary").textContent);
        _dialoguetypes.lastElementChild.remove();
    }
    for (let id in game.dialogueTypes) {
        var typeElement = document.createElement("details");
        _dialoguetypes.appendChild(typeElement);
        var typeLabel = document.createElement("summary");
        typeLabel.textContent = id;
        typeElement.appendChild(typeLabel);

        if (openTypes.includes(id))
            typeElement.open = true;

        var propertyList = document.createElement("ul");
        typeElement.appendChild(propertyList);
        for (let property of Object.keys(game.dialogueTypes.default)) {
            var propertyElement = document.createElement("li");
            propertyElement.textContent = property;
            var flex = document.createElement("div");
            flex.className = "flex";
            propertyElement.appendChild(flex);

            var input;
            var originalType = typeof game.dialogueTypes.default[property];
            if (property === "sound") {
                input = document.createElement("select");
                let nulloption = document.createElement("option");
                nulloption.value = "(none)";
                nulloption.textContent = "(none)";
                input.appendChild(nulloption);
                for (let sound in game.sounds) {
                    let option = document.createElement("option");
                    option.textContent = sound;
                    option.value = sound;
                    input.appendChild(option);
                }
                const value = game.dialogueTypes[id][property] || game.dialogueTypes.default[property];
                if (value !== "(none)" && !game.sounds[value]) {
                    let option = document.createElement("option");
                    option.textContent = value;
                    option.value = value;
                    option.disabled = true;
                    input.appendChild(option);
                }
                input.value = value;
            } else {
                if (originalType === "string") {
                    input = document.createElement("textarea");
                    input.addEventListener("focus", resizeTextarea);
                    input.addEventListener("input", resizeTextarea);
                } else if (originalType === "number") {
                    input = document.createElement("input");
                    input.type = "number";
                }
            }
            flex.appendChild(input);

            if (game.dialogueTypes[id][property])
                input.value = game.dialogueTypes[id][property];
            if (id !== "default") {
                input.placeholder = game.dialogueTypes.default[property];
                let defaultbutton = document.createElement("button");
                defaultbutton.textContent = "↻";
                defaultbutton.title = "reset and bind to default";
                setLabel(defaultbutton);
                defaultbutton.onclick = function() {
                    delete game.dialogueTypes[this.dataset.id][this.dataset.property];
                    if (this.dataset.property === "sound") {
                        this.value = game.dialogueTypes.default.sound;
                        if (!game.sounds[this.value])
                            updateDialogueTypes();
                    } else {
                        this.value = null;
                    }
                    this.classList.add("default");
                    this.nextElementSibling.disabled = true;
                }.bind(input);
                if (!game.dialogueTypes[id][property]) {
                    input.classList.add("default");
                    defaultbutton.disabled = true;
                }
                flex.appendChild(defaultbutton);
            }
            input.dataset.id = id;
            input.dataset.property = property;
            input.addEventListener("input", function() {
                if (this.value === "")
                    this.classList.add("default");
                else
                    this.classList.remove("default");
            })
            input.addEventListener("change", function() {
                if (this.value.trim() === "" && this.dataset.id !== "default") {
                    delete game.dialogueTypes[this.dataset.id][this.dataset.property];
                    this.value = null;
                } else {
                    if (this.type === "number")
                        game.dialogueTypes[this.dataset.id][this.dataset.property] = parseFloat(this.value || 0);
                    else
                        game.dialogueTypes[this.dataset.id][this.dataset.property] = this.value.trim();
                    this.value = game.dialogueTypes[this.dataset.id][this.dataset.property];
                }
                if (this.dataset.id === "default") {
                    for (let nondefault of document.querySelectorAll("[data-property]")) {
                        if (nondefault.dataset.id !== "default" && nondefault.dataset.property === this.dataset.property) {
                            nondefault.placeholder = this.value;
                            nondefault.value = this.value;
                            nondefault.classList.add("default");
                        }
                    }
                } else {
                    if (game.dialogueTypes[this.dataset.id][this.dataset.property] === undefined) {
                        this.nextElementSibling.disabled = true;
                        this.classList.add("default");
                    } else {
                        this.nextElementSibling.disabled = false;
                        this.classList.remove("default");
                    }
                }
                if (this.dataset.property === "sound") {
                    if (game.sounds[this.value] && this.querySelector("option[disabled]")) {
                        this.querySelector("option[disabled]").remove();
                    }
                }
            })
            propertyList.appendChild(propertyElement);
        }

        if (id !== "default") {
            var removeElement = document.createElement("li");
            removeElement.style.marginTop = "10px";
            var removeButton = document.createElement("button");
            removeButton.classList.add("delete");
            removeButton.type = "button";
            removeButton.textContent = "delete";
            removeButton.title = "remove dialogue type";
            setLabel(removeButton);
            removeButton.onclick = async () => {
                if (await confirm(`delete dialogue type "${id}"?`)) {
                    delete game.dialogueTypes[id];
                    updateDialogueTypes();
                }
            }
            removeElement.appendChild(removeButton);
            propertyList.appendChild(removeElement);
        }
    }
    _gamemenu.scrollTop = scrollTop;
}

function resizeTextarea() {
    this.style.height = "";
    this.style.height = this.scrollHeight + 5 + "px";
}

// events

window.addEventListener("load", () => {
    window.alert = function(text) {
        _alertprompt.textContent = text;
        setTimeout(_alert.showModal.bind(_alert), 1);
    }
    window.confirm = async function(text) {
        if (editor.disablePrompts)
            return true;
        _confirmvalue.checked = false;
        _confirmprompt.textContent = text;
        setTimeout(_confirm.showModal.bind(_confirm), 1);
        return new Promise(resolve => {
            _confirm.onclose = () => {
                resolve(_confirmvalue.checked === true);
            }
        })
    }
    window.prompt = async function(text, placeholder) {
        _promptprompt.textContent = text;
        _promptcanceled.checked = true;
        _promptinput.value = "";
        _promptinput.placeholder = placeholder;
        setTimeout(_prompt.showModal.bind(_prompt), 1);
        return new Promise(resolve => {
            _prompt.onclose = () => {
                let input = _promptinput.value.trim() === "" ? placeholder : _promptinput.value.trim();
                resolve(_promptcanceled.checked === true ? null : input);
            }
        })
    }

    game = new Game({
        canvas,
        width: editor.gameWidth,
        height: editor.gameHeight
    });
    updateGame();
    clearAssetFolder();
    Promise.all(
        [
            "_preset/cursor_default.png",
            "_preset/cursor_grab.png",
            "_preset/cursor_grabbing.png",
            "_preset/dialogue.mp3",
            "_preset/interact.mp3",
            "_preset/music.png"
        ].map(path => {
            return fetch(path, {cache: "force-cache"})
                .then(res => res.blob())
                .then(blob => {
                    var file = new File([blob], path.split("/").pop());
                    file.path = path;
                    return file;
                })
        })
    ).then(files => {
        var structure = getFolderStructure(files);
        _filesystem.appendChild(
            createFolderElement(_filesystem, "_preset", structure)
        );
    })

    game.canvas.addEventListener("wheel", e => {
        var object = editor.grabbedObject || game.scenes[game.currentScene].hoveredObject;
        if (object) {
            let os = object.sprite.scale;
            object.sprite.scale += e.deltaY / (Math.max(object.sprite.width, object.sprite.height) * 2);
            if (object.sprite.width * object.sprite.scale < 20)
                object.sprite.scale = 20/object.sprite.width;
            if (object.sprite.height * object.sprite.scale < 20)
                object.sprite.scale = 20/object.sprite.height;
            let offset;
            if (object === editor.grabbedObject) {
                editor.grabOffset = [
                    editor.grabOffset[0] * (object.sprite.scale / os),
                    editor.grabOffset[1] * (object.sprite.scale / os)
                ];
                offset = editor.grabOffset;
            } else {
                if (!editor.scrollOffset) {
                    editor.scrollOffset = [
                        object.position[0] - game.mouse.position[0],
                        object.position[1] - game.mouse.position[1]
                    ]
                }
                editor.scrollOffset = [
                    editor.scrollOffset[0] * (object.sprite.scale / os),
                    editor.scrollOffset[1] * (object.sprite.scale / os)
                ];
                offset = editor.scrollOffset;
            }
            object.position = [
                game.mouse.position[0] + offset[0],
                game.mouse.position[1] + offset[1]
            ]
        }
        e.preventDefault();
    })

    document.addEventListener("contextmenu", e => {
        e.preventDefault();
        if (game.scenes[game.currentScene].hoveredObject) {
            let object = game.scenes[game.currentScene].hoveredObject;
            let scene = game.scenes[game.currentScene];
            scene.removeObject(object);
            scene.objects.unshift(object);
            object.scene = scene;
        }
    })

    document.body.addEventListener("mousemove", () => {
        if (editor.grabbedObject) {
            editor.grabbedObject.position = [
                game.mouse.position[0] + editor.grabOffset[0],
                game.mouse.position[1] + editor.grabOffset[1]
            ]
            if (
                game.mouse.position[0] < 0 || game.mouse.position[1] < 0 || 
                game.mouse.position[0] > game.canvas.width || game.mouse.position[1] > game.canvas.height
            ) {
                document.body.classList.add("delete-object");
            } else {
                document.body.classList.remove("delete-object");
            }
        }
        if (
            !document.querySelector("canvas:hover") && game.scenes[game.currentScene].hoveredObject ||
            document.querySelector("canvas:hover") && !game.scenes[game.currentScene].hoveredObject
        )
            _hoveralt.textContent = "";
        editor.scrollOffset = null;
    })

    document.addEventListener("keydown", e => {
        editor.shiftPressed = e.key === "Shift";
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && e.code === "KeyF") {
            document.body.classList.toggle("fullscreen");
            game.windowresize();
        }
    })

    document.addEventListener("keyup", () => {
        editor.shiftPressed = false;
    })
    window.addEventListener("blur", () => {
        editor.shiftPressed = false;
    })

    document.addEventListener("mousedown", e => {
        if (ENV === "editor" && e.target === game.canvas) {
            var hovered = game.scenes[game.currentScene].hoveredObject;
            if (hovered) {
                if (e.button === 0 && !editor.grabbedObject && !game.mouse.cancelClick) {
                    grabObject(hovered);
                } 
                if (e.button === 1 || (e.button === 0 && editor.shiftPressed)) {
                    var duplicate = duplicateObject(hovered);
                    grabObject(duplicate);
                }
            }
        }
        if (e.target !== game.canvas && e.target !== _objectmenu && !containsElement(_objectmenu, e.target)) {
            deselectObject();
        }
    })

    document.addEventListener("mouseup", async (e) => {
        if (editor.grabbedObject) {
            document.body.classList.remove("dragging");
            document.body.classList.remove("delete-object");
            var object = editor.grabbedObject;
            editor.grabbedObject = null;
            if (
                game.mouse.position[0] < 0 || game.mouse.position[1] < 0 || 
                game.mouse.position[0] > game.canvas.width || game.mouse.position[1] > game.canvas.height
            ) {
                if (object.scriptChanged && !(await confirm("delete this object?"))) {
                    object.position = [
                        game.canvas.width/2 - object.sprite.width/2,
                        game.canvas.height/2 - object.sprite.height/2
                    ]
                } else {
                    object.scene.removeObject(object);
                }
            }
        }
    })
})