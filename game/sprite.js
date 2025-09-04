const fakeCanvas = document.createElement("canvas");
const fakeContext = fakeCanvas.getContext("2d", { willReadFrequently: true });
fakeCanvas.width = 1;
fakeCanvas.height = 1;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioDestination = audioContext.createMediaStreamDestination();
const outputAudio = new Audio();
outputAudio.srcObject = audioDestination.stream;

class Sprite {
    loaded = false;
    src;
    objectURL;
    image;
    width = 0;
    height = 0;
    scale = 1;

    constructor(o) {
        this.src = o.src;
        this.image = new Image();
        this.objectURL = o.objectURL || this.src;
        this.image.src = this.objectURL;
        if (o.width)
            this.width = o.width;
        if (o.height)
            this.height = o.height;
        if (o.scale)
            this.scale = o.scale;
        this.image.onload = async () => {
            this.width = this.image.naturalWidth;
            this.height = this.image.naturalHeight;
            if (o.onload)
                o.onload();
            this.loaded = true;
        }
    }

    setSource(url) {
        this.loaded = false;
        this.objectURL = url;
        this.image.src = url;
    }

    createOutlineImage(image, color, offset) {
        var canvas = document.createElement("canvas");
        canvas.width = (image.naturalWidth * this.scale) + offset * 2;
        canvas.height = (image.naturalHeight * this.scale) + offset * 2;
        var context = canvas.getContext("2d");
        for (let x=-offset; x<=offset; x++) {
            for (let y=-offset; y<=offset; y++) {
                if (x === 0 && y === 0) continue;
                context.translate(offset + x, offset + y);
                context.scale(this.scale, this.scale);
                context.drawImage(image, 0, 0);
                context.setTransform(1,0,0,1,0,0);
            }
        }
        context.globalCompositeOperation = "source-in";
        context.fillStyle = color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
    }

    drawOutline(context, name, x, y) {
        if (this.loaded) {
            var offset = 2;
            var outline = this.createOutlineImage(this.image, name === "active" ? "greenyellow" : "white", offset);
            context.drawImage(outline, x - offset, y - offset);
        }
    }

    draw(context, x, y, w, h) {
        if (!this.loaded && this.width && this.height) {
            context.strokeStyle = "white";
            context.lineWidth = 1;
            context.strokeRect(x, y, this.width * this.scale, this.height * this.scale);
            context.fillStyle = "white";
            context.font = "20px sans-serif";
            context.fillText(this.src, x + 5, y + (this.height * this.scale) - 5);
            return;
        }
        context.translate(x, y);
        context.scale(this.scale, this.scale);
        if (this.loaded)
            context.drawImage(this.image, 0, 0, w || this.width, h || this.height);
        context.setTransform(1,0,0,1,0,0);
    }

    isTransparent(x, y) {
        if (!this.loaded) {
            if (this.width && this.height)
                return x < 0 || x > this.width || y < 0 || y > this.height;
            return true;
        }
        fakeContext.clearRect(0, 0, 1, 1);
        fakeContext.drawImage(this.image, -Math.floor(x), -Math.floor(y));
        return fakeContext.getImageData(0, 0, 1, 1).data[3] === 0;
    }

    generateData() {
        return {
            src: this.src,
            scale: this.scale,
            width: this.width,
            height: this.height
        }
    }
}

class AudioSprite {
    loaded = false;
    src;
    objectURL;
    buffer;
    playing = false;
    loop = false;

    constructor(o) {
        this.src = o.src;
        this.loop = o.loop;
        this.objectURL = o.objectURL || this.src;
        if (o.buffer) {
            this.buffer = o.buffer;
            this.loaded = true;
            if (o.onload)
                o.onload();
        } else {
            this.setSource(this.objectURL, o.onload);
        }
    }

    setSource(src, onload) {
        this.loaded = false;
        this.objectURL = src;
        fetch(src, {cache: "force-cache"})
        .then(res => res.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .then(buffer => {
            this.buffer = this.addSilence(buffer);
            this.loaded = true;
            if (onload)
                onload();
        })
    }

    addSilence(buffer, silenceDuration = 0.1) {
        const silenceLength = Math.floor(buffer.sampleRate * silenceDuration);
        const totalLength = buffer.length + silenceLength;
        const newBuffer = audioContext.createBuffer(
            buffer.numberOfChannels,
            totalLength,
            buffer.sampleRate
        );
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const originalData = buffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            newData.set(originalData, 0);
        }
        return newBuffer;
    }

    setLoop(value) {
        this.loop = value;
        if (this.source)
            this.source.loop = value;
    }

    play(onend) {
        if (!this.loaded)
            return;
        if (outputAudio.dataset.started !== "true") {
            outputAudio.play();
            outputAudio.dataset.started = true;
        }
        this.stop();
        this.source = audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(audioDestination);
        this.source.start();
        this.playing = true;
        if (this.loop)
            this.source.loop = true;
        this.source.onended = () => {
            if (onend) onend();
            this.source.onended = null;
            this.playing = false;
        }
    }

    stop() {
        if (this.source)
            this.source.stop();
        if (this.silence)
            this.silence.stop();
        this.playSilence();
        this.playing = false;
    }

    playSilence() {
        this.silence = audioContext.createBufferSource();
        this.silence.buffer = audioContext.createBuffer(1, audioContext.sampleRate * .1, audioContext.sampleRate);
        this.silence.connect(audioDestination);
        this.silence.start();
    }

    generateData() {
        return {
            src: this.src,
            loop: this.loop
        }
    }
}