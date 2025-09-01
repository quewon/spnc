const fakeCanvas = document.createElement("canvas");
const fakeContext = fakeCanvas.getContext("2d", { willReadFrequently: true });

class Sprite {
    loaded = false;
    src;
    image;
    imagedata;
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
            if (o.imagedata) {
                this.imagedata = o.imagedata;
                this.loaded = true;
            }
            if (editor) {
                while (ENV !== "editor" || editor?.grabbedObject || editor?.scrollOffset || editor?.generatingImages) {
                    await new Promise(resolve => {
                        setTimeout(() => { resolve() }, 100);
                    })
                }
            }
            if (!o.imagedata) {
                this.imagedata = this.generateImagedata(this.image);
                this.loaded = true;
            }
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

    generateImagedata(image) {
        let canvas = fakeCanvas;
        let context = fakeContext;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }

    isTransparent(x, y) {
        if (!this.loaded) {
            if (this.width && this.height)
                return x <= this.width && y <= this.height;
            return true;
        }
        return this.imagedata[Math.floor(y) * (this.width * 4) + Math.floor(x) * 4 + 3];
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
            this.setSource(o.context, o.objectURL || this.src, o.onload);
        }
    }

    setSource(context, src, onload) {
        this.loaded = false;
        this.url = src;
        fetch(src)
        .then(res => res.arrayBuffer())
        .then(buffer => context.decodeAudioData(buffer))
        .then(buffer => {
            this.buffer = buffer;
            this.loaded = true;
            if (onload)
                onload();
        })
    }

    play(context) {
        if (!this.loaded)
            return;
        this.stop();
        this.source = context.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(context.destination);
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