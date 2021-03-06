"use strict";

const fs = require("fs");
const path = require("path");

const farmhash = require("farmhash");
const imageinfo = require("imageinfo");
let gm = require("gm");
const async = require("async");

const models = require("../lib/models");
const urls = require("../lib/urls");
const db = require("../lib/db");
const similar = require("../lib/similar");
const config = require("../lib/config");

// Add the ability to provide an explicit bath to the GM binary
/* istanbul ignore if */
if (config.GM_PATH) {
    gm = gm.subClass({appPath: config.GM_PATH});
}

const Image = new db.schema({
    // An ID for the image in the form: SOURCE/IMAGENAME
    _id: String,

    // The date that this item was created
    created: {
        type: Date,
        default: Date.now,
    },

    // The date that this item was updated
    modified: {
        type: Date,
    },

    // The most recent batch in which the image was uploaded
    // NOTE(jeresig): This is not required as the image could have
    // been uploaded for use in a search.
    batch: {
        type: String,
        ref: "ImageImport",
    },

    // The source that the image is associated with
    source: {
        type: String,
        required: true,
    },

    // The name of the original file (e.g. `foo.jpg`)
    fileName: {
        type: String,
        required: true,
    },

    // Full URL of where the image came.
    url: String,

    // The hashed contents of the image
    hash: {
        type: String,
        required: true,
    },

    // The width of the image
    width: {
        type: Number,
        required: true,
        min: 1,
    },

    // The height of the image
    height: {
        type: Number,
        required: true,
        min: 1,
    },

    // Keep track of if the image needs to index its image similarity
    needsSimilarIndex: {
        type: Boolean,
        default: false,
    },

    // Keep track of if the image needs to update its image similarity
    needsSimilarUpdate: {
        type: Boolean,
        default: false,
    },

    // Similar images (as determined by image similarity)
    similarImages: [{
        // The ID of the visually similar image
        _id: {
            type: String,
            required: true,
        },

        // The similarity score between the images
        score: {
            type: Number,
            required: true,
            min: 1,
        },
    }],
});

Image.methods = {
    getFilePath() {
        return path.resolve(this.getSource().getDirBase(),
            `images/${this.hash}.jpg`);
    },

    getOriginalURL() {
        return urls.genData(
            `/${this.source}/images/${this.hash}.jpg`);
    },

    getScaledURL() {
        return urls.genData(
            `/${this.source}/scaled/${this.hash}.jpg`);
    },

    getThumbURL() {
        return urls.genData(
            `/${this.source}/thumbs/${this.hash}.jpg`);
    },

    getSource() {
        return models("Source").getSource(this.source);
    },

    relatedArtworks(callback) {
        models("Artwork").find({images: this._id}, callback);
    },

    canIndex() {
        return this.width >= 150 && this.height >= 150;
    },

    updateSimilarity(callback) {
        // Skip small images
        if (!this.canIndex()) {
            return process.nextTick(callback);
        }

        similar.similar(this.hash, (err, matches) => {
            if (err || !matches) {
                return callback(err);
            }

            async.mapLimit(matches, 1, (match, callback) => {
                // Skip matches for the image itself
                if (match.id === this.hash) {
                    return callback();
                }

                models("Image").findOne({
                    hash: match.id,
                }, (err, image) => {
                    if (err || !image) {
                        return callback();
                    }

                    callback(null, {
                        _id: image._id,
                        score: match.score,
                    });
                });
            }, (err, matches) => {
                this.similarImages = matches.filter((match) => match);
                callback();
            });
        });
    },

    indexSimilarity(callback) {
        similar.idIndexed(this.hash, (err, indexed) => {
            /* istanbul ignore if */
            if (err) {
                return callback(err);
            } else if (indexed) {
                return callback(null, true);
            }

            const file = this.getFilePath();

            similar.add(file, this.hash, (err) => {
                // Ignore small images, we just won't index them
                /* istanbul ignore if */
                if (err && err.type !== "IMAGE_SIZE_TOO_SMALL") {
                    return callback(err);
                } else if (err) {
                    return callback();
                }

                return callback(null, true);
            });
        });
    },

    updateRelatedArtworks(callback) {
        this.relatedArtworks((err, artworks) => {
            /* istanbul ignore if */
            if (err) {
                return callback(err);
            }

            async.eachLimit(artworks, 1, (artwork, callback) => {
                artwork.updateSimilarity((err) => {
                    /* istanbul ignore if */
                    if (err) {
                        return callback(err);
                    }

                    artwork.save(callback);
                });
            }, callback);
        });
    },
};

Image.statics = {
    fromFile(batch, file, callback) {
        const Image = models("Image");
        const Source = models("Source");

        const fileName = path.basename(file);
        const source = batch.source;
        const _id = `${source}/${fileName}`;
        const sourceDir = Source.getSource(source).getDirBase();
        const warnings = [];

        this.findById(_id, (err, image) => {
            /* istanbul ignore if */
            if (err) {
                return callback(new Error("ERROR_RETRIEVING"));
            }

            const creating = !image;

            this.processImage(file, sourceDir, (err, hash) => {
                if (err) {
                    return callback(new Error("MALFORMED_IMAGE"));
                }

                // The same image was uploaded, we can just skip the rest
                if (!creating && hash === image.hash) {
                    return callback(null, image, warnings);
                }

                this.getSize(file, (err, size) => {
                    /* istanbul ignore if */
                    if (err) {
                        return callback(new Error("MALFORMED_IMAGE"));
                    }

                    const width = size.width;
                    const height = size.height;

                    if (width <= 1 || height <= 1) {
                        return callback(new Error("EMPTY_IMAGE"));
                    }

                    const data = {
                        _id,
                        batch: batch._id,
                        source,
                        fileName,
                        hash,
                        width,
                        height,
                    };

                    let model = image;

                    if (creating) {
                        model = new Image(data);

                    } else {
                        warnings.push("NEW_VERSION");
                        model.set(data);
                    }

                    if (!model.canIndex()) {
                        warnings.push("TOO_SMALL");
                    }

                    model.validate((err) => {
                        /* istanbul ignore if */
                        if (err) {
                            return callback(new Error("ERROR_SAVING"));
                        }

                        callback(null, model, warnings);
                    });
                });
            });
        });
    },

    processImage(sourceFile, baseDir, callback) {
        return images.processImage(sourceFile, baseDir, callback);
    },

    getSize(fileName, callback) {
        return images.getSize(fileName, callback);
    },

    indexSimilarity(callback) {
        models("Image").findOne({
            needsSimilarIndex: true,
        }, (err, image) => {
            if (err || !image) {
                return callback(err);
            }

            console.log("Indexing Similarity", image._id);

            image.indexSimilarity((err) => {
                /* istanbul ignore if */
                if (err) {
                    console.error(err);
                    return callback(err);
                }

                image.needsSimilarIndex = false;
                image.needsSimilarUpdate = true;
                image.save((err) => callback(err, true));
            });
        });
    },

    updateSimilarity(callback) {
        models("Image").findOne({
            needsSimilarUpdate: true,
        }, (err, image) => {
            if (err || !image) {
                return callback(err);
            }

            console.log("Updating Similarity", image._id);

            image.updateSimilarity((err) => {
                /* istanbul ignore if */
                if (err) {
                    console.error(err);
                    return callback(err);
                }

                image.needsSimilarUpdate = false;
                image.save((err) => {
                    /* istanbul ignore if */
                    if (err) {
                        return callback(err);
                    }

                    image.updateRelatedArtworks((err) => {
                        /* istanbul ignore if */
                        if (err) {
                            return callback(err);
                        }

                        callback(null, true);
                    });
                });
            });
        });
    },
};

/* istanbul ignore next */
Image.pre("save", function(next) {
    // Always updated the modified time on every save
    this.modified = new Date();
    next();
});

const images = {
    convert(inputStream, outputFile, config, callback) {
        let stream = gm(inputStream).autoOrient();

        if (config) {
            stream = config(stream);
        }

        stream
            .stream("jpg")
            .on("error", (err) => {
                callback(new Error(
                    `Error converting file to JPEG: ${err}`));
            })
            .pipe(fs.createWriteStream(outputFile))
            .on("finish", () => {
                callback(null, outputFile);
            });
    },

    parseSize(size) {
        const parts = size.split("x");

        return {
            width: parseFloat(parts[0]),
            height: parseFloat(parts[0]),
        };
    },

    getSize(fileName, callback) {
        fs.readFile(fileName, (err, data) => {
            /* istanbul ignore if */
            if (err) {
                return callback(err);
            }

            const info = imageinfo(data);

            callback(null, {
                width: info.width,
                height: info.height,
            });
        });
    },

    makeThumb(baseDir, fileName, callback) {
        const imageFile = path.resolve(baseDir, "images", fileName);
        const thumbFile = path.resolve(baseDir, "thumbs", fileName);
        const size = this.parseSize(config.THUMB_SIZE);

        this.convert(fs.createReadStream(imageFile), thumbFile, (img) => {
            return img.resize(size.width, size.height);
        }, callback);
    },

    makeScaled(baseDir, fileName, callback) {
        const imageFile = path.resolve(baseDir, "images", fileName);
        const scaledFile = path.resolve(baseDir, "scaled", fileName);
        const scaled = this.parseSize(config.SCALED_SIZE);

        this.convert(fs.createReadStream(imageFile), scaledFile, (img) => {
            return img.resize(scaled.width, scaled.height, ">");
        }, callback);
    },

    makeThumbs(fullPath, callback) {
        const baseDir = path.resolve(path.dirname(fullPath), "..");
        const fileName = path.basename(fullPath);

        async.series([
            (callback) => this.makeThumb(baseDir, fileName, callback),
            (callback) => this.makeScaled(baseDir, fileName, callback),
        ], (err) => {
            /* istanbul ignore if */
            if (err) {
                return callback(
                    new Error(`Error converting thumbnails: ${err}`));
            }

            callback(null, [
                path.resolve(baseDir, "thumbs", fileName),
                path.resolve(baseDir, "scaled", fileName),
            ]);
        });
    },

    hashImage(sourceFile, callback) {
        fs.readFile(sourceFile, (err, buffer) => {
            /* istanbul ignore if */
            if (err) {
                return callback(err);
            }

            callback(null, farmhash.hash32(buffer).toString());
        });
    },

    processImage(sourceFile, baseDir, callback) {
        let hash;
        let imageFile;
        const existsError = new Error("Already exists.");

        async.series([
            // Generate a hash for the incoming image file
            (callback) => {
                this.hashImage(sourceFile, (err, imageHash) => {
                    /* istanbul ignore if */
                    if (err) {
                        return callback(err);
                    }

                    hash = imageHash;
                    imageFile = path.resolve(baseDir, "images",
                        `${hash}.jpg`);

                    // Avoid doing the rest of this if it already exists
                    fs.stat(imageFile, (err, stats) => {
                        callback(stats ? existsError : null);
                    });
                });
            },

            // Convert the image into our standard format
            (callback) => this.convert(fs.createReadStream(sourceFile),
                imageFile, null, callback),

            // Generate thumbnails based on the image
            (callback) => this.makeThumbs(imageFile, callback),
        ], (err) => {
            callback(err === existsError ? null : err, hash);
        });
    },
};

module.exports = Image;
