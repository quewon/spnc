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
        this.image.onload = () => {
            this.loaded = true;
            this.width = this.image.naturalWidth;
            this.height = this.image.naturalHeight;
            this.imagedata = this.generateImagedata(this.image);
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
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");
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
        this.setSource(o.context, o.objectURL || this.src);
    }

    setSource(context, src) {
        this.loaded = false;
        this.url = src;
        fetch(src)
        .then(res => res.arrayBuffer())
        .then(buffer => context.decodeAudioData(buffer))
        .then(buffer => {
            this.loaded = true;
            this.buffer = buffer;
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