class Game {
    canvas;
    cachedCanvasRect;
    context;
    previousTime;
    mouse = {
        down: false,
        up: false,
        clicked: false,
        position: [0, 0],
    };
    scenes;
    currentScene;

    cursorDefault = new Sprite({ src: "_res/cursor_open.png" });
    cursorDown = new Sprite({ src: "_res/cursor_closed.png" });

    sounds = {
        "interact": "_res/interact.mp3",
        "dialogue": "_res/default_dialogue.mp3"
    };

    specialDialogueIds = ["PLAY", "STOP", "GOTO"];
    dialogueTypes = {
//         default: {
//             textPadding: 5,
//             width: "canvas.width",
//             fontSize: 50,
//             fontFamily: `'Times', serif`,
//             backgroundColor: "transparent",
//             color: "red",
//             borderWidth: 0,
//             position: `return {x: canvas.width/2 - width/2, y: canvas.height/2 - height/2}`,
//             animation: `let previousChar = this.text[this.charIndex - 1];
// return {
//     interval: 30 + (previousChar?.match(/[.?!,—:]/) ? 200 : 0),
//     charIncrement: 1,
// }`,
//             sound: "_res/default_dialogue.mp3"
//         },
        default: {
            textPadding: 20,
            textAlign: "justify",
            width: 500,
            fontSize: 26,
            fontFamily: "'Times', serif",
            backgroundColor: "yellow",
            color: "black",
            borderWidth: 2,
            position: `return {x: canvas.width/2 - width/2, y: canvas.height/2 - height/2}`,
            animation: `let previousChar = this.text[this.charIndex - 1];
return {
    interval: 30 + (previousChar?.match(/[.?!,—:]/) ? 200 : 0),
    charIncrement: 1,
}`,
            sound: "dialogue"
        },
        "L": {
            fontSize: 23,
            fontFamily: "'Courier', monospace",
            width: 300,
            backgroundColor: "white",
            position: `return {x: canvas.width - canvas.width/3 - width/2, y: canvas.height/2.5 - height/2}`,
            animation: `let pastWords = this.text.substring(0, this.charIndex).split(/[^A-Za-z.?!'",]/).filter(w => w !== "");
let previousWord;
if (pastWords.length > 0)
    previousWord = pastWords[pastWords.length - 1];
let remainingText = this.text.substring(this.charIndex, this.text.length);
let nextWord = remainingText.split(/[^A-Za-z.?!'",]/).filter(w => w !== "")[0];
return {
    interval: nextWord.length * 30 + (previousWord?.match(/[.?!,—:]/) ? 300 : 0),
    charIncrement: nextWord.length + remainingText.indexOf(nextWord),
}`,
        },
        "R": {
            fontSize: 23,
            fontFamily: "'Courier', monospace",
            width: 300,
            backgroundColor: "white",
            position: `return {x: canvas.width/3 - width/2, y: canvas.height - canvas.height/2.5 - height/2}`,
            animation: `let pastWords = this.text.substring(0, this.charIndex).split(/[^A-Za-z.?!'",]/).filter(w => w !== "");
let previousWord;
if (pastWords.length > 0)
    previousWord = pastWords[pastWords.length - 1];
let remainingText = this.text.substring(this.charIndex, this.text.length);
let nextWord = remainingText.split(/[^A-Za-z.?!'",]/).filter(w => w !== "")[0];
return {
    interval: nextWord.length * 30 + (previousWord?.match(/[.?!,—:]/) ? 300 : 0),
    charIncrement: nextWord.length + remainingText.indexOf(nextWord),
}`,
        }
    };
    dialogue;

    constructor(o) {
        this.canvas = o.canvas || document.querySelector("canvas");
        this.context = this.canvas.getContext("2d");
        this.setSize(o.width, o.height);

        if (o.scenes) {
            this.scenes = {};
            for (let scene in o.scenes) {
                o.scenes[scene].game = this;
                this.scenes[scene] = new Scene(o.scenes[scene]);
            }
        } else {
            this.scenes = { "main": new Scene({ game: this }) };
        }
        this.setScene(o.currentScene || "main");

        if (o.dialogueTypes)
            this.dialogueTypes = o.dialogueTypes;
        if (o.sounds) {
            this.sounds = {};
            for (let sound in o.sounds) {
                this.sounds[sound] = o.sounds[sound].src;
            }
        }
        for (let sound in this.sounds) {
            this.sounds[sound] = new AudioSprite({
                src: this.sounds[sound]
            });
        }
        if (o.cursorDefault)
            this.cursorDefault = new Sprite(o.cursorDefault);
        if (o.cursorDown)
            this.cursorDown = new Sprite(o.cursorDown);

        // event listeners

        this.mousedownEventListener = this.mousedown.bind(this);
        this.mouseupEventListener = this.mouseup.bind(this);
        this.mousemoveEventListener = this.mousemove.bind(this);
        this.mouseclickEventListener = this.mouseclick.bind(this);
        this.resizeEventListener = this.windowresize.bind(this);

        this.canvas.addEventListener("mousedown", this.mousedownEventListener);
        document.addEventListener("mouseup", this.mouseupEventListener);
        window.addEventListener("blur", this.mouseupEventListener);
        document.addEventListener("mousemove", this.mousemoveEventListener);
        this.canvas.addEventListener("click", this.mouseclickEventListener);
        window.addEventListener("resize", this.resizeEventListener);

        // 

        this.previousTime = new Date();
        this.update();
        this.draw();
    }

    destroy() {
        this.destroyed = true;
        this.stopSounds();
        this.canvas.removeEventListener("mousedown", this.mousedownEventListener);
        document.removeEventListener("mouseup", this.mouseupEventListener);
        window.removeEventListener("blur", this.mouseupEventListener);
        document.removeEventListener("mousemove", this.mousemoveEventListener);
        this.canvas.removeEventListener("click", this.mouseclickEventListener);
        window.removeEventListener("resize", this.resizeEventListener);
    }

    mousedown(e) {
        if (e.button === 0) {
            this.mouse.down = true;
            this.mouse.cancelClick = null;
            this.mouse.clickStartPosition = [
                this.mouse.position[0],
                this.mouse.position[1]
            ]
        }
    }

    mouseup(e) {
        if (e.button === 0) {
            this.mouse.down = false;
            this.mouse.clickStartPosition = null;
            this.mouse.up = true;
        }
    }

    mousemove(e) {
        let rect = this.cachedCanvasRect;
        let scale = this.canvas.width / rect.width;
        this.mouse.position[0] = (e.pageX - rect.x) * scale;
        this.mouse.position[1] = (e.pageY - rect.y) * scale;
        if (this.mouse.clickStartPosition && !this.mouse.cancelClick) {
            let dx = this.mouse.clickStartPosition[0] - this.mouse.position[0];
            let dy = this.mouse.clickStartPosition[1] - this.mouse.position[1];
            let sqrdist = dx * dx + dy * dy;
            if (sqrdist > 4)
                this.mouse.cancelClick = true;
        }
        if (editor)
            editor.scrollOffset = null;
    }

    mouseclick(e) {
        if (e.button === 0 && !this.mouse.cancelClick) {
            this.mouse.clicked = true;
        }
    }

    setSize(width, height) {
        this.canvas.width = width ?? this.canvas.width;
        this.canvas.height = height ?? this.canvas.height;
        if (editor) {
            _gamewidth.value = this.canvas.width;
            _gameheight.value = this.canvas.height;
        }
        this.windowresize();
    }

    windowresize() {
        if (editor) {
            let w = Math.min(this.canvas.width, window.innerWidth / 2);
            this.canvas.style.width = w + "px";
            this.canvas.style.height = (this.canvas.height * (w / this.canvas.width)) + "px";
        } else {
            let ratio = this.canvas.width / this.canvas.height;
            let w = window.innerWidth;
            let h = window.innerHeight;
            if (w / h > ratio) {
                w = h * ratio;
            } else if (w / h < ratio) {
                h = w / ratio;
            }
            this.canvas.style.width = w + "px";
            this.canvas.style.height = h + "px";
        }
        this.cachedCanvasRect = this.canvas.getBoundingClientRect();
    }

    setScene(sceneName) {
        if (!this.scenes[sceneName]) {
            alert(`the scene "${sceneName}" does not exist.`);
            return;
        }
        this.currentScene = sceneName;
        if (editor) {
            _sceneselect.value = this.currentScene;
            if (!this.scenes[this.currentScene].background) {
                _scenebg.title = "drop background image here";
            } else {
                _scenebg.title = this.scenes[this.currentScene].background.src;
                _scenebg.style.backgroundImage = `url(${this.scenes[this.currentScene].background?.image.src})`;
            }
        }
    }

    draw() {
        if (this.destroyed)
            return;

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (ENV === "editor") {
            this.context.fillStyle = "magenta";
            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.currentScene)
            this.scenes[this.currentScene].draw(this.context);
        if (this.dialogue)
            this.dialogue.draw();

        if (ENV !== "editor") {
            if (this.mouse.down) {
                this.cursorDown.draw(this.context, this.mouse.position[0] - this.cursorDown.width/2, this.mouse.position[1] - this.cursorDown.height/2);
            } else {
                this.cursorDefault.draw(this.context, this.mouse.position[0] - this.cursorDefault.width/2, this.mouse.position[1] - this.cursorDefault.height/2);
            }
        }

        requestAnimationFrame(this.draw.bind(this));
    }

    update() {
        if (this.destroyed)
            return;

        var now = new Date();
        var delta = now - this.previousTime;
        
        this.canvas.classList.remove("grab");
        if (ENV !== "editor" && this.dialogue) {
            this.dialogue.update(delta);
            if (!this.dialogue.playing)
                this.dialogue = null;
        } else {
            if (this.currentScene)
                this.scenes[this.currentScene].update(delta);
        }
        if (editor) {
            if (editor.selectedObject && this.mouse.clicked && !editor.selectedObject.hovered())
                deselectObject();
        }
        
        this.previousTime = now;
        this.mouse.clicked = false;
        this.mouse.up = false;
        requestAnimationFrame(this.update.bind(this));
    }
    
    playSound(sound) {
        if (!this.sounds[sound])
            return;
        if (this.sounds[sound])
            this.sounds[sound].play();
    }

    stopSound(sound) {
        if (!this.sounds[sound])
            return;
        if (this.sounds[sound])
            this.sounds[sound].stop();
    }

    stopSounds() {
        outputAudio.pause();
        outputAudio.dataset.started = false;
    }

    generateSoundsData() {
        var data = {};
        for (let sound in this.sounds) {
            data[sound] = this.sounds[sound].generateData();
        }
        return data;
    }

    generateScenesData() {
        var data = {};
        for (let scene in this.scenes) {
            data[scene] = this.scenes[scene].generateData();
        }
        return data;
    }

    generateData() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            currentScene: this.currentScene,
            dialogueTypes: this.dialogueTypes,
            sounds: this.generateSoundsData(),
            scenes: this.generateScenesData(),
            cursorDefault: this.cursorDefault.generateData(),
            cursorDown: this.cursorDown.generateData(),
        }
    }
}

class Scene {
    game;
    objects = [];
    background;
    hoveredObject;
    
    constructor(o) {
        this.game = o.game;
        if (o.background)
            this.background = new Sprite(o.background);
        if (o.objects) {
            for (let object of o.objects) {
                object.scene = this;
                this.objects.push(new GameObject(object));
            }
        }
    }

    addObject(object) {
        this.objects.push(object);
        object.scene = this;
    }

    removeObject(object) {
        let index = this.objects.indexOf(object);
        if (index != -1)
            this.objects.splice(index, 1);
        object.scene = null;
    }

    draw(context) {
        if (this.background)
            this.background.draw(context, 0, 0, context.canvas.width, context.canvas.height);
        for (let object of this.objects)
            object.draw(context);
    }

    update(delta) {
        this.hoveredObject = null;
        for (let i=this.objects.length - 1; i>=0; i--) {
            let object = this.objects[i];
            if (!this.hoveredObject && object.hovered())
                this.hoveredObject = object;
        }
        for (let i=this.objects.length - 1; i>=0; i--) {
            let object = this.objects[i];
            object.update(delta);
        }
        if (
            editor && !this.hoveredObject && 
            this.game.mouse.position[0] >= 0 && this.game.mouse.position[0] <= this.game.canvas.width &&
            this.game.mouse.position[1] >= 0 && this.game.mouse.position[1] <= this.game.canvas.height
        )
            _hoveralt.textContent = "";
    }

    generateData() {
        var data = {
            objects: []
        };
        if (this.background)
            data.background = this.background.generateData();
        for (let object of this.objects) {
            data.objects.push(object.generateData());
        }
        return data;
    }
}

class GameObject {
    scene;
    loaded = false;
    sprite;
    position = [0, 0];
    script = "PLAY: interact";
    dialogue;

    constructor(o) {
        o = o || {};
        if (o.sprite)
            this.sprite = new Sprite(o.sprite);
        if (o.position)
            this.position = o.position;
        if (o.script)
            this.script = o.script;
        this.scene = o.scene;
        this.dialogue = new Dialogue({
            text: this.script,
            game: this.scene.game
        });
    }

    hovered() {
        let mouse = this.scene.game.mouse.position;
        if (
            mouse[0] >= this.position[0] && mouse[0] <= this.position[0] + this.sprite.width * this.sprite.scale &&
            mouse[1] >= this.position[1] && mouse[1] <= this.position[1] + this.sprite.height * this.sprite.scale &&
            !this.sprite.isTransparent((mouse[0] - this.position[0]) / this.sprite.scale, (mouse[1] - this.position[1]) / this.sprite.scale)
        ) {
            return true;
        }
        return false;
    }

    draw(context) {
        var mouse = this.scene.game.mouse;
        var hovered = this.scene.hoveredObject === this;

        var x = this.position[0];
        var y = this.position[1];
        var w = this.sprite.width * this.sprite.scale;
        var h = this.sprite.height * this.sprite.scale;

        if (hovered && this.dialogue.lines.length > 0) {
            context.fillStyle = "white";
            context.fillRect(x - 1, y - 1, w + 2, h + 2);
        }
        if (
            ENV !== "editor" && hovered && this.dialogue.lines.length > 0 && mouse.down && !mouse.cancelClick || 
            ENV === "editor" && editor?.selectedObject === this
        ) {
            context.fillStyle = "greenyellow";
            context.fillRect(x - 3, y - 3, w + 6, h + 6);
        }

        this.sprite.draw(context, this.position[0], this.position[1]);
    }

    update(delta) {
        var mouse = this.scene.game.mouse;
        var hovered = this.scene.hoveredObject === this;
        if (ENV === "editor" && editor) {
            if (hovered) {
                this.scene.game.canvas.classList.add("grab");
                _hoveralt.textContent = this.sprite.src;
            }
            if (!editor.grabbedObject && hovered && mouse.down) {
                grabObject(this);
            }
            if (hovered && mouse.clicked) {
                selectObject(this);
            }
        } else {
            if (hovered && mouse.clicked) {
                this.click();
            }
        }
    }

    click() {
        if (this.dialogue.lines.length > 0) {
            this.scene.game.dialogue = this.dialogue;
            this.scene.hoveredObject = null;
            this.dialogue.play();
        }
    }

    generateData() {
        return {
            sprite: this.sprite.generateData(),
            position: this.position,
            script: this.script
        }
    }
}