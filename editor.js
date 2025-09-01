var ENV = "editor";

var editor = {
    supportedImageFormats: ["jpg", "jpeg", "png", "gif"],
    supportedAudioFormats: ["mp3", "wav", "ogg"],
    grabbedObject: null,
    grabOffset: null,
    scrollOffset: null,
    selectedObject: null,
    disablePrompts: true,
    selectedSoundObject: null,
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
    if (document.querySelector(".folder"))
        document.querySelector(".folder").remove();
    for (let sprite of allSprites()) {
        if (sprite.src && !sprite.src.includes("_res/")) {
            sprite.loaded = false;
        }
    }
}

function loadAssetFolder(files) {
    clearAssetFolder();
    var structure = getFolderStructure(files);
    createFolderElement(_filesystem, Object.keys(structure)[0], structure).querySelector("details").open = true;
    game.windowresize();
    _folderpicker.value = "";
}

function getFolderStructure(files) {
    const structure = {};
    for (let file of files) {
        const pathParts = file.webkitRelativePath.split('/');
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
                path: file.webkitRelativePath,
                file: file
            };
        } else if (editor.supportedAudioFormats.includes(ext)) {
            current[filename] = { 
                kind: "audio",
                path: file.webkitRelativePath,
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
    setLabel(summary, "folder");
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
        src: "_res/music.png",
        onload: function() { this.classList.add("loaded") }.bind(el)
    });
    el.addEventListener("mousedown", () => {
        if (el.classList.contains("loaded")) {
            document.body.classList.add("dragging");
            let scene = game.scenes[game.currentScene];
            let object = new GameObject({
                scene,
                sprite: { src: "_res/music.png", buffer: sprite.buffer },
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
    setLabel(el, "audio file");

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
    setLabel(el, "image file");

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
    const promptvalue = prompt("what will you name this game?", "untitled");
    if (promptvalue === null || promptvalue.trim() === "")
        return;
    const gametitle = promptvalue.trim();

    var zip = new JSZip();
    
    var res = [
        "_lib/typeset/lib/en-us.js",
        "_lib/typeset/lib/hypher.js",
        "_lib/typeset/src/formatter.js",
        "_lib/typeset/src/linebreak.js",
        "_lib/typeset/src/linked-list.js",
        "_lib/typeset/src/LICENSE",
    ];
    var objecturl = [];
    for (let sprite of allSprites()) {
        if (sprite.src.includes("_res/"))
            res.push(sprite.src);
        else
            objecturl.push(sprite);
    }
    if (res.length > 0) {
        await Promise.all(
            res.map(async path => {
                const blob = await fetch(path)
                .then(x => x.blob());
                return { path, blob }
            })
        ).then(dataArray => {
            for (let data of dataArray) {
                zip.file(data.path, data.blob);
            }
        })
    }
    if (objecturl.length > 0) {
        for (let sprite of objecturl)
            zip.file(sprite.src, await fetch(sprite.buffer ? sprite.url : sprite.image.src).then(res => res.blob()));
    }
    
    var html;
    await Promise.all([
        fetch("template.html").then(x => x.text()),
        fetch("game/util.js").then(x => x.text()),
        fetch("game/sprite.js").then(x => x.text()),
        fetch("game/dialogue.js").then(x => x.text()),
        fetch("game/game.js").then(x => x.text()),
    ]).then(([template, util, sprite, dialogue, gamejs]) => {
        html = template
               .replace("GAME_TITLE_", gametitle)
               .replace("GAME_UTIL_JS_", util)
               .replace("GAME_SPRITE_JS_", sprite)
               .replace("GAME_DIALOGUE_JS_", dialogue)
               .replace("GAME_GAME_JS_", gamejs)
               .replace("GAME_DATA_", JSON.stringify(game.generateData()))
    });

    zip.file("index.html", html);
    zip.generateAsync({ type: "blob" })
    .then(function(content) {
        saveAs(content, gametitle + ".zip");
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
        game = new Game(data);
        clearAssetFolder();
        updateScenes();
        updateSounds();
    })
    if (file)
        reader.readAsText(file);
    _loadbutton.value = "";
}

function saveGame() {
    const promptvalue = prompt("what will you name this file?", "untitled");
    if (promptvalue === null || promptvalue.trim() === "")
        return;
    const filename = promptvalue.trim();
    const file = new Blob([JSON.stringify(game.generateData())], { type: "text/plain" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = (filename === "" ? "untitled" : filename) + ".spnc";
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

function selectObject(object) {
    editor.selectedObject = object;
    _objectpreview.src = object.sprite.image.src;
    _objectname.textContent = object.sprite.src;
    _objectscript.value = object.script;
    _objectscript.oninput = () => {
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
        _scenebg.style.background = `url(${object.sprite.image.src})`;
    }
}

function setCursorDefault() {
    var object = editor.grabbedObject;
    if (object) {
        game.cursorDefault = new Sprite({ src: object.sprite.src, objectURL: object.sprite.image.src });
        _cursordefault.style.background = `url(${object.sprite.image.src})`;
    }
}

function setCursorDown() {
    var object = editor.grabbedObject;
    if (object) {
        game.cursorDown = new Sprite({ src: object.sprite.src, objectURL: object.sprite.image.src });
        _cursordown.style.background = `url(${object.sprite.image.src})`;
    }
}

function addDialogueType(type) {
    type = type.trim();
    if (type === "") {
        alert("this dialogue type needs a name.");
        return;
    }
    if (game.specialDialogueIds.includes(type)) {
        alert(`sorry, the name ${type} is reserved!`);
        return;
    }
    if (game.dialogueTypes[type]) {
        alert(`a dialogue type called "${type}" already exists!`);
        return;
    }
    game.dialogueTypes[type] = {};
    updateDialogueTypes();
}

function selectSound() {
    editor.selectedSoundObject = editor.grabbedObject;
    _sfxdropzone.style.backgroundImage = `url(${editor.selectedSoundObject.sprite.image.src})`;
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
    editor.selectedSoundObject = null;
    updateSounds();
}

function addScene() {
    let id = _scenename.value.trim();
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
    _scenename.value = "";
    updateScenes();
}

function deleteScene() {
    if (!editor.disablePrompts && !confirm(`are you sure you want to delete the scene "${game.currentScene}"?`))
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

// ui

function setLabel(el, label) {
    el.addEventListener("mouseover", () => {
        _hoveralt.textContent = label;
    })
    el.addEventListener("mouseout", () => {
        _hoveralt.textContent = "";
    })
}

function switchMode() {
    if (ENV === "editor") {
        ENV = "game";
        document.body.classList.add("game");
        _modebutton.textContent = "PLAY MODE";
    } else {
        ENV = "editor";
        document.body.classList.remove("game");
        _modebutton.textContent = "EDITOR MODE";
        game.dialogue = null;
    }
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
    _scenebg.style.backgroundImage = `url(${game.scenes[game.currentScene].background?.image.src})`;
}

function updateSounds() {
    while (_soundslist.lastElementChild)
        _soundslist.lastElementChild.remove();
    for (let sound in game.sounds) {
        var li = document.createElement("li");
        li.appendChild(createSoundElement(sound, () => {
            game.stopSound(sound);
            delete game.sounds[sound];
            updateSounds();
            for (let type in game.dialogueTypes) {
                if (game.dialogueTypes[type].sound === sound)
                    game.dialogueTypes[type].sound = "(none)";
            }
        }));
        _soundslist.appendChild(li);
    }
    updateDialogueTypes();
}

function createSoundElement(sound, onremove) {
    var flex = document.createElement("div");
    flex.classList.add("flex");

    var button = document.createElement("button");
    button.type = "button";
    button.textContent = sound;
    button.title = "play sound";
    setLabel(button, button.title);
    button.onclick = () => {
        game.playSound(sound);
    }
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
            propertyElement.innerHTML = property + "<br>";
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
                input.value = game.dialogueTypes[id][property] || game.dialogueTypes.default[property];
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
            propertyElement.appendChild(input);

            if (game.dialogueTypes[id][property])
                input.value = game.dialogueTypes[id][property];
            if (id !== "default") {
                input.placeholder = game.dialogueTypes.default[property];
                if (!game.dialogueTypes[id][property])
                    input.classList.add("default");
                if (property === "sound") {
                    let defaultbutton = document.createElement("button");
                    defaultbutton.style.marginLeft = "5px";
                    defaultbutton.textContent = "bind to default";
                    defaultbutton.onclick = function() {
                        game.dialogueTypes[this.dataset.id][this.dataset.property] = null;
                        this.value = game.dialogueTypes.default[this.dataset.property];
                        this.classList.add("default");
                        this.nextElementSibling.disabled = true;
                    }.bind(input);
                    if (!game.dialogueTypes[id][property])
                        defaultbutton.disabled = true;
                    propertyElement.appendChild(defaultbutton);
                }
            }
            input.dataset.id = id;
            input.dataset.property = property;
            input.addEventListener("change", function() {
                if (this.type === "number")
                    game.dialogueTypes[this.dataset.id][this.dataset.property] = parseFloat(this.value);
                else
                    game.dialogueTypes[this.dataset.id][this.dataset.property] = this.value === "" ? null : this.value;
                if (this.dataset.id === "default") {
                    for (let nondefault of document.querySelectorAll("[data-property]")) {
                        if (nondefault.dataset.id !== "default" && nondefault.dataset.property === this.dataset.property) {
                            if (nondefault.placeholder)
                                nondefault.placeholder = game.dialogueTypes.default[this.dataset.property];
                            if (!game.dialogueTypes[nondefault.dataset.id][this.dataset.property])
                                nondefault.value = this.value;
                        }
                    }
                } else {
                    if (game.dialogueTypes[this.dataset.id][this.dataset.property]) {
                        this.classList.remove("default");
                        if (this.dataset.property === "sound")
                            this.nextElementSibling.disabled = false;
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
            setLabel(removeButton, removeButton.title);
            removeButton.onclick = () => {
                if (editor.disablePrompts || confirm(`delete dialogue type "${id}"?`)) {
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
    game = new Game({
        canvas,
        width: editor.gameWidth,
        height: editor.gameHeight
    });

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
    })

    document.addEventListener("mousedown", e => {
        if (e.target !== game.canvas && e.target !== _objectmenu && !containsElement(_objectmenu, e.target)) {
            deselectObject();
        }
    })

    document.addEventListener("mouseup", () => {
        if (editor.grabbedObject) {
            if (
                game.mouse.position[0] < 0 || game.mouse.position[1] < 0 || 
                game.mouse.position[0] > game.canvas.width || game.mouse.position[1] > game.canvas.height
            ) {
                if (editor.disablePrompts) {
                    editor.grabbedObject.scene.removeObject(editor.grabbedObject);
                } else {
                    if (!confirm("delete this object?")) {
                        editor.grabbedObject.position = [
                            game.canvas.width/2 - editor.grabbedObject.width/2,
                            game.canvas.height/2 - editor.grabbedObject.height/2
                        ]
                    } else {
                        editor.grabbedObject.scene.removeObject(editor.grabbedObject);
                    }
                }
                if (editor.grabbedObject === editor.selectedObject) {
                    deselectObject();
                }
            }
            document.body.classList.remove("dragging");
            document.body.classList.remove("delete-object");
            editor.grabbedObject = null;
        }
    })
})