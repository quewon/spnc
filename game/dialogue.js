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
    brokenText;
    width = 0;
    lineHeight = 0;
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
        this.width = this.type.width;
        this.brokenText = this.breakText(this.text, this.width);
    }

    breakText(line, width) {
        const type = this.type.textAlign;
        var context = this.game.context,
        format, nodes, breaks;
        context.textAlign = "left";
        context.textBaseline = "top";
        context.font = `${this.type.fontSize}px ${this.type.fontFamily}`;
        let mm = context.measureText("thinking");
        this.lineHeight = mm.fontBoundingBoxAscent + mm.fontBoundingBoxDescent;
        format = Typeset.formatter(function (str) {
            return context.measureText(str).width;
        });
        nodes = format[type] ? format[type](line) : format["left"](line);
        breaks = Typeset.linebreak(nodes, [width], {tolerance: Typeset.linebreak.infinity});
        if (breaks.length !== 0) {
            var result = [];
            var i, lines = [], point, j, r, lineStart = 0, y = 0;
            for (i = 1; i < breaks.length; i++) {
                point = breaks[i].position,
                r = breaks[i].ratio;
                for (var j = lineStart; j < nodes.length; j += 1) {
                    if (nodes[j].type === 'box' || (nodes[j].type === 'penalty' && nodes[j].penalty === -Typeset.linebreak.infinity)) {
                        lineStart = j;
                        break;
                    }
                }
                lines.push({ratio: r, nodes: nodes.slice(lineStart, point + 1), position: point});
                lineStart = point;
            }
            var rx = 0;
            lines.forEach(function (line, lineIndex) {
                var x = 0;
                line.nodes.forEach(function (node, index, array) {
                    if (node.type === 'box') {
                        result.push({ text: node.value, x, y });
                        x += node.width;
                        rx = x;
                    } else if (node.type === 'glue') {
                        x += node.width + line.ratio * (line.ratio < 0 ? node.shrink : node.stretch);
                    } else if (node.type === 'penalty' && node.penalty === 100 && index === array.length - 1) {
                        if (result.length === 0 || result[result.length - 1].text[result[result.length - 1].text.length - 1] === "-")
                            result.push({ text: "-", x, y });
                    }
                });
                y++;
            });
            if (y === 1)
                this.width = Math.min(rx, this.width);
            return result;
        } else {
            return [];
        }
    }

    close() {
        this.closed = true;
    }

    draw() {
        if (this.boxf === 0 || this.brokenText.length === 0) return;

        var context = this.game.context;

        context.globalAlpha = this.boxa;
        context.font = `${this.type.fontSize}px ${this.type.fontFamily}`;
        context.textAlign = "left";
        context.textBaseline = "top";
        
        let width = this.width;
        let height = (this.brokenText[this.brokenText.length - 1].y + 1) * this.lineHeight * smootherstep(this.boxf);
        
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
        
        let p = this.type.textPadding;
        context.fillStyle = this.type.backgroundColor;
        context.beginPath();
        context.rect(x - p, y - p, width + p*2, height + (p * smootherstep(this.boxf))*2);
        context.fill();
        if (this.type.borderWidth > 0) {
            context.strokeStyle = this.type.color;
            context.lineWidth = this.type.borderWidth;
            context.stroke();
        }
        if (this.boxf === 1) {
            context.fillStyle = this.type.color;
            var ci = 0;
            for (let node of this.brokenText) {
                let nextIndex = ci + this.text.slice(ci).indexOf(node.text) + node.text.length;
                if (nextIndex >= this.charIndex) {
                    context.fillText(this.text.substring(ci, this.charIndex).trim(), x + node.x, y + (node.y * this.lineHeight));
                    break;
                } else {
                    context.fillText(node.text, x + node.x, y + (node.y * this.lineHeight));
                }
                ci = nextIndex;
            }
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