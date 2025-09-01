onmessage = async (e) => {
    var directory = e.data.directory;
    var result = [];
    for await (const entry of directory.values()) {
        let ext;
        if (entry.name.split(".").length > 1)
            ext = entry.name.split(".").pop().toLowerCase();
        if (entry.kind === "directory" && !ext) {
            result.push({ entry, kind: "directory" })
        } else if (
            e.data.supportedImageFormats.includes(ext) || 
            e.data.supportedAudioFormats.includes(ext)
        ) {
            const file = await entry.getFile();
            const url = URL.createObjectURL(file);
            const kind = e.data.supportedImageFormats.includes(ext) ? "image" : "audio";
            result.push({ entry, file, url, kind })
        }
    }
    postMessage(result);
};