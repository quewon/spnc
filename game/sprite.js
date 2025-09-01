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
    image;
    width = 0;
    height = 0;
    scale = 1;

    constructor(o) {
        this.src = o.src;
        this.image = new Image();
        this.image.src = o.objectURL || this.src;
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

    draw(context, x, y, w, h) {
        context.save();
        context.translate(x, y);
        context.scale(this.scale, this.scale);
        if (this.loaded)
            context.drawImage(this.image, 0, 0, w || this.width, h || this.height);
        context.restore();

        if (!this.loaded && this.width && this.height) {
            context.strokeStyle = "white";
            context.lineWidth = 1;
            context.strokeRect(x, y, this.width * this.scale, this.height * this.scale);
            context.fillStyle = "white";
            context.font = "20px sans-serif";
            context.fillText(this.src, x + 5, y + (this.height * this.scale) - 5);
        }
    }

    isTransparent(x, y) {
        if (!this.loaded) {
            if (this.width && this.height)
                return x < 0 || x > this.width || y < 0 || y > this.height;
            return true;
        }
        fakeContext.clearRect(0, 0, 1, 1);
        fakeContext.drawImage(this.image, -Math.floor(x), -Math.floor(y));
        return fakeContext.getImageData(0, 0, 1, 1).data[3] < 255;
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
    url;
    buffer;

    constructor(o) {
        this.src = o.src;
        if (o.buffer) {
            this.buffer = o.buffer;
            this.loaded = true;
            this.url = o.objectURL || this.src;
            if (o.onload)
                o.onload();
        } else {
            this.setSource(o.objectURL || this.src, o.onload);
        }
    }

    setSource(src, onload) {
        this.loaded = false;
        this.url = src;
        fetch(src)
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

    play() {
        if (!this.loaded)
            return;
        if (outputAudio.dataset.started !== "true") {
            outputAudio.play();
            outputAudio.dataset.started = true;
            console.log("playing");
        }
        this.stop();
        this.source = audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(audioDestination);
        this.source.start();
    }

    stop() {
        if (this.source)
            this.source.stop();
    }

    generateData() {
        return {
            src: this.src
        }
    }
}