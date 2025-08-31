class Dialogue {
    game;
    lines = [];
    boxes = [];
    playing = false;
    lineIndex = 0;

    constructor(o) {
        this.game = o.game;
        let lines = o.text.trim().split('\n');
        for (let line of lines) {
            line = line.trim();
            if (line === "") continue;
            if (line.substring(0, 2) === "//") continue;

            let type = "default";
            let split = line.split(':');
            if (
                split.length > 1 && 
                (this.game.dialogueTypes[split[0]] || this.game.specialDialogueIds.includes(split[0]))
            ) {
                line = split.slice(1).join(':').trim();
                type = split[0];
            }
            this.lines.push({ line, type });
        }
    }

    play() {
        this.playing = true;
        this.boxes = [];
        this.lineIndex = 0;
        this.playLine();
    }

    playLine() {
        let data = this.lines[this.lineIndex];
        for (let i=0; i<this.boxes.length; i++) {
            if (this.boxes[i].closed) continue;
            if (this.boxes[i].type === data.type || this.lineIndex - i > 1) {
                this.boxes[i].close();
            }
        }
        if (data.type === "PLAY") {
            this.game.playSound(data.line);
            this.next();
        } else if (data.type === "STOP") {
            this.game.stopSound(data.line);
            this.next();
        } else if (data.type === "GOTO") {
            this.game.setScene(data.line);
            this.next();
        } else {
            this.boxes.push(new DialogueBox({
                type: data.type,
                text: data.line,
                game: this.game
            }));
        }
    }

    next() {
        this.lineIndex++;
        if (this.lineIndex < this.lines.length) {
            this.playLine();
        } else {
            let i = 0;
            for (let box of this.boxes)
                if (!box.closed)
                    setTimeout(box.close.bind(box), (i++)*50)
            this.playing = false;
        }
    }

    draw() {
        for (let box of this.boxes)
            box.draw();
    }

    update(delta) {
        if (this.boxes[this.boxes.length - 1]?.awaitingInput && this.game.mouse.clicked)
            this.next();
        for (let box of this.boxes)
            box.update(delta);
    }
}

class DialogueBox {
    game;
    
    closed = false;
    text = "";
    charIndex = 0;
    awaitingInput = false;
    playf = 0;
    boxf = 0;
    boxa = 1;

    constructor(o) {
        this.game = o.game;
        this.type = {};
        for (let key in this.game.dialogueTypes.default) {
            this.type[key] = this.game.dialogueTypes.default[key];
        }
        if (o.type !== "default" && this.game.dialogueTypes[o.type]) {
            for (let key in this.game.dialogueTypes[o.type]) {
                this.type[key] = this.game.dialogueTypes[o.type][key];
            }
        }
        if (o.text)
            this.text = o.text;
    }

    breakLinesToFit(line, width) {
        this.game.context.font = this.type.font;
        this.game.context.textAlign = "left";
        this.game.context.textBaseline = "top";
        let lines = [];
        let i = 0;
        while (line.length >= i) {
            let sub = line.substring(i, line.length);
            let words = sub.split(/[^A-Za-z.?!'",]/).filter(w => w !== "");
            if (words.length === 0)
                break;
            let word = words[0];
            let length = word.length + sub.indexOf(word);
            if (this.game.context.measureText(line.substring(0, i + length)).width <= width) {
                i += length;
            } else {
                lines.push(line.substring(0, i).trim());
                line = line.substring(i, line.length);
                i = 0;
            }
        }
        if (line.trim() !== "")
            lines.push(line.trim());
        return lines;
    }

    close() {
        this.closed = true;
    }

    draw() {
        if (this.boxf === 0) return;

        var context = this.game.context;

        context.globalAlpha = this.boxa;
        context.font = `${this.type.fontSize}px ${this.type.fontFamily}`;
        context.textAlign = "left";
        context.textBaseline = "top";
        
        let width = this.type.width;

        let allLines = this.breakLinesToFit(this.text, width);
        let lines = this.breakLinesToFit(this.text.substring(0, this.charIndex), width);
        
        let mm = context.measureText(allLines.length === 1 ? allLines[0] : lines[0]);
        if (allLines.length === 1)
            width = mm.width;
        let lineHeight = mm.fontBoundingBoxAscent + mm.fontBoundingBoxDescent;
        let height = allLines.length * lineHeight * smootherstep(this.boxf);
        let p = this.type.textPadding;

        var x, y;
        try {
            let pos = new Function('canvas', 'width', 'height', this.type.position).bind(this)(this.game.canvas, width, height);
            x = pos.x;
            y = pos.y;
        } catch {
            x = 0;
            y = 0;
            console.log("error with position function.");
        }

        context.fillStyle = this.type.backgroundColor;
        context.beginPath();
        context.rect(x - p, y - p, width + p*2, height + (p * smootherstep(this.boxf))*2);
        context.fill();
        if (this.type.borderWidth > 0) {
            context.strokeStyle = this.type.color;
            context.lineWidth = this.type.borderWidth;
            context.stroke();
        }
        if (lines[0] !== "" && this.boxf === 1) {
            context.fillStyle = this.type.color;
            for (let i=0; i<lines.length; i++)
                context.fillText(lines[i], x, y + i * lineHeight);
        }

        context.globalAlpha = 1;
    }

    update(dt) {
        if (!this.closed) {
            this.boxf += dt/150;
            if (this.boxf > 1) this.boxf = 1;

            if (!this.awaitingInput && this.boxf >= 1) {
                var interval;
                var charIncrement;
                try {
                    let data = new Function(this.type.animation).bind(this)();
                    interval = data.interval;
                    charIncrement = data.charIncrement;
                } catch {
                    interval = 0;
                    charIncrement = 1;
                    console.log("error with animation function.");
                }

                this.playf += dt;
                if (this.playf >= interval) {
                    this.playf = 0;
                    this.charIndex += charIncrement;
                    if (this.type.sound)
                        this.game.playSound(this.type.sound);
                }

                if (this.charIndex >= this.text.length || this.game.mouse.clicked) {
                    this.awaitingInput = true;
                    this.charIndex = this.text.length;
                }
            }
        } else {
            this.boxa -= dt/150;
            if (this.boxa < 0) this.boxa = 0;
        }
    }
}