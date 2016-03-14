"use strict";

// Some dummy ENV variables used for testing
process.env.PASTEC_URL = "http://localhost:8000/";
process.env.THUMB_SIZE = "220x220";
process.env.SCALED_SIZE = "300x300";
process.env.BASE_DATA_DIR = process.cwd();

const fs = require("fs");
const path = require("path");

const tap = require("tap");
const sinon = require("sinon");
const mockfs = require("mock-fs");
const async = require("async");

const core = require("../core");
const server = require("../server/server");

// Models used for testing
const Image = core.models.Image;
const Artwork = core.models.Artwork;
const Source = core.models.Source;
const ImageImport = core.models.ImageImport;
const ArtworkImport = core.models.ArtworkImport;
const UploadImage = core.models.UploadImage;
const Upload = core.models.Upload;

// Data used for testing
let source;
let sources;
let batch;
let batches;
let artworkBatch;
let artworkBatches;
let imageResultsData;
let images;
let image;
let upload;
let uploadImages;
let uploadImage;
let artworks;
let artwork;
let artworkData;
let similar;
let similarAdded;

// Sandbox the bound methods
let sandbox;

// Files used for testing
const testFiles = {};
const dataDir = path.resolve(__dirname, "data");

for (const file of fs.readdirSync(dataDir)) {
    if (/\.\w+$/.test(file)) {
        testFiles[file] = fs.readFileSync(path.resolve(dataDir, file));
    }
}

// Views
const viewFiles = {};
const viewDir = path.resolve(__dirname, "..", "views");

for (const file of fs.readdirSync(viewDir)) {
    viewFiles[file] = fs.readFileSync(path.resolve(viewDir, file));
}

// Converters used for testing
const converterFiles = {};
const converterDir = path.resolve(__dirname, "..", "converters");

for (const file of fs.readdirSync(converterDir)) {
    const filePath = path.resolve(converterDir, file);

    // Require the file now so that other dependencies are pre-loaded
    if (file === "default.js") {
        require(filePath);
    }

    // However we still need to import the files
    converterFiles[file] = fs.readFileSync(filePath);
}

// Public files used to render the site
const publicFiles = {};
const publicDir = path.resolve(__dirname, "..", "public");

for (const dir of fs.readdirSync(publicDir)) {
    const dirPath = path.resolve(publicDir, dir);
    const files = publicFiles[dir] = {};

    for (const file of fs.readdirSync(dirPath)) {
        const filePath = path.resolve(dirPath, file);
        files[file] = fs.readFileSync(filePath);
    }
}

const genData = () => {
    artworkData = {
        id: "1234",
        source: "test",
        lang: "en",
        url: "http://google.com",
        images: ["foo.jpg"],
        title: "Test",
        objectType: "painting",
        artists: [{
            name: "Test",
            dates: [{
                original: "ca. 1456-1457",
                start: 1456,
                end: 1457,
                circa: true,
            }],
        }],
        dimensions: [{width: 123, height: 130, unit: "mm"}],
        dates: [{
            original: "ca. 1456-1457",
            start: 1456,
            end: 1457,
            circa: true,
        }],
        locations: [{city: "New York City"}],
    };

    artworks = {
        "test/1234": new Artwork(Object.assign({}, artworkData, {
            _id: "test/1234",
            id: "1234",
            images: ["test/foo.jpg"],
            defaultImageHash: "4567",
        })),

        "test/1235": new Artwork(Object.assign({}, artworkData, {
            _id: "test/1235",
            id: "1235",
            images: ["test/bar.jpg"],
            defaultImageHash: "4568",
        })),

        "test/1236": new Artwork(Object.assign({}, artworkData, {
            _id: "test/1236",
            id: "1236",
            images: ["test/zoo.jpg", "test/zoo2.jpg", "test/zoo3.jpg"],
            defaultImageHash: "4569",
        })),

        "test/1237": new Artwork(Object.assign({}, artworkData, {
            _id: "test/1237",
            id: "1237",
            images: ["test/nosimilar.jpg"],
            defaultImageHash: "4570",
        })),
    };

    for (const id in artworks) {
        const artwork = artworks[id];
        artwork.validateSync();
        artwork.isNew = false;
    }

    artwork = artworks["test/1234"];

    sources = [
        new Source({
            _id: "test",
            url: "http://test.com/",
            name: "Test Source",
            shortName: "test",
        }),
        new Source({
            _id: "test2",
            url: "http://test2.com/",
            name: "Test Source 2",
            shortName: "test2",
        }),
    ];

    source = sources[0];

    const testZip = path.resolve(process.cwd(), "data", "test.zip");

    imageResultsData = [
        {
            "_id": "bar.jpg",
            "fileName": "bar.jpg",
            "warnings": [
                "NEW_VERSION",
            ],
            "model": "test/bar.jpg",
        },
        {
            "_id": "corrupted.jpg",
            "fileName": "corrupted.jpg",
            "error": "MALFORMED_IMAGE",
        },
        {
            "_id": "empty.jpg",
            "fileName": "empty.jpg",
            "error": "EMPTY_IMAGE",
        },
        {
            "_id": "foo.jpg",
            "fileName": "foo.jpg",
            "warnings": [
                "NEW_VERSION",
            ],
            "model": "test/foo.jpg",
        },
        {
            "_id": "new1.jpg",
            "fileName": "new1.jpg",
            "warnings": [],
            "model": "test/new1.jpg",
        },
        {
            "_id": "new2.jpg",
            "fileName": "new2.jpg",
            "warnings": [],
            "model": "test/new2.jpg",
        },
        {
            "_id": "small.jpg",
            "fileName": "small.jpg",
            "warnings": [
                "TOO_SMALL",
            ],
            "model": "test/small.jpg",
        },
        {
            "_id": "new3.jpg",
            "fileName": "new3.jpg",
            "warnings": [],
            "model": "test/new3.jpg",
        },
    ];

    batches = [
        new ImageImport({
            _id: "test/started",
            source: "test",
            zipFile: testZip,
            fileName: "test.zip",
        }),

        new ImageImport({
            _id: "test/process-started",
            source: "test",
            state: "process.started",
            zipFile: testZip,
            fileName: "test.zip",
        }),

        new ImageImport({
            _id: "test/process-completed",
            source: "test",
            state: "process.completed",
            zipFile: testZip,
            fileName: "test.zip",
            results: imageResultsData,
        }),

        new ImageImport({
            _id: "test/process-completed2",
            source: "test",
            state: "process.completed",
            zipFile: testZip,
            fileName: "test.zip",
            results: imageResultsData,
        }),

        new ImageImport({
            _id: "test/completed",
            source: "test",
            state: "completed",
            zipFile: testZip,
            fileName: "test.zip",
            results: imageResultsData,
        }),

        new ImageImport({
            _id: "test/error",
            source: "test",
            state: "error",
            zipFile: testZip,
            fileName: "test.zip",
            error: "ERROR_READING_ZIP",
        }),
    ];

    for (const batch of batches) {
        sinon.stub(batch, "save", process.nextTick);
    }

    batch = batches[0];

    artworkBatches = [
        new ArtworkImport({
            _id: "test/started",
            fileName: "data.json",
            source: "test",
        }),
        new ArtworkImport({
            _id: "test/started",
            fileName: "data.json",
            source: "test",
            state: "completed",
            results: [],
        }),
        new ArtworkImport({
            _id: "test/started",
            fileName: "data.json",
            source: "test",
            state: "error",
            error: "ABANDONED",
            results: [],
        }),
    ];

    for (const artworkBatch of artworkBatches) {
        sinon.stub(artworkBatch, "save", process.nextTick);
    }

    artworkBatch = artworkBatches[0];

    images = {
        "test/foo.jpg": new Image({
            _id: "test/foo.jpg",
            source: "test",
            fileName: "foo.jpg",
            hash: "4567",
            width: 100,
            height: 100,
            similarImages: [{_id: "test/bar.jpg", score: 10}],
        }),

        "test/bar.jpg": new Image({
            _id: "test/bar.jpg",
            source: "test",
            fileName: "bar.jpg",
            hash: "4568",
            width: 120,
            height: 120,
            similarImages: [
                {_id: "test/foo.jpg", score: 10},
                {_id: "test/zoo2.jpg", score: 9},
                {_id: "test/zoo.jpg", score: 8},
            ],
        }),

        "test/zoo.jpg": new Image({
            _id: "test/zoo.jpg",
            source: "test",
            fileName: "zoo.jpg",
            hash: "4569",
            width: 115,
            height: 115,
            similarImages: [{_id: "test/bar.jpg", score: 8}],
        }),

        "test/zoo2.jpg": new Image({
            _id: "test/zoo2.jpg",
            source: "test",
            fileName: "zoo2.jpg",
            hash: "4571",
            width: 116,
            height: 116,
            similarImages: [{_id: "test/bar.jpg", score: 9}],
        }),

        "test/zoo3.jpg": new Image({
            _id: "test/zoo3.jpg",
            source: "test",
            fileName: "zoo3.jpg",
            hash: "4572",
            width: 117,
            height: 117,
            similarImages: [],
        }),

        "test/nosimilar.jpg": new Image({
            _id: "test/nosimilar.jpg",
            source: "test",
            fileName: "nosimilar.jpg",
            hash: "4570",
            width: 110,
            height: 110,
            similarImages: [],
        }),
    };

    image = images["test/foo.jpg"];

    uploadImages = {
        "uploads/4266906334.jpg": new UploadImage({
            _id: "uploads/4266906334.jpg",
            fileName: "4266906334.jpg",
            hash: "4266906334",
            width: 100,
            height: 100,
            similarImages: [{_id: "test/bar.jpg", score: 10}],
        }),
    };

    uploadImage = uploadImages["uploads/4266906334.jpg"];

    upload = new Upload({
        _id: "4266906334",
        images: ["uploads/4266906334.jpg"],
        defaultImageHash: "4266906334",
    });

    similar = {
        "4266906334": [
            {id: "4567", score: 100},
            {id: "4568", score: 10},
            {id: "NO_LONGER_EXISTS", score: 1},
        ],
        "4567": [
            {id: "4567", score: 100},
            {id: "4568", score: 10},
            {id: "NO_LONGER_EXISTS", score: 1},
        ],
        "4568": [
            {id: "4568", score: 100},
            {id: "4567", score: 10},
            {id: "4571", score: 9},
            {id: "4569", score: 8},
        ],
        "4569": [
            {id: "4569", score: 100},
            {id: "4568", score: 8},
        ],
        "4571": [
            {id: "4571", score: 100},
            {id: "4568", score: 9},
        ],
        "4572": [
            {id: "4572", score: 100},
        ],
        "4570": [
            {id: "4570", score: 100},
        ],
    };

    similarAdded = [];
};

const bindStubs = () => {
    sandbox = sinon.sandbox.create();

    sandbox.stub(Artwork, "findById", (id, callback) => {
        if (artworks[id]) {
            process.nextTick(() => callback(null, artworks[id]));
        } else {
            process.nextTick(() => callback(
                new Error("Artwork not found.")));
        }
    });

    sandbox.stub(Artwork, "findByIdAndRemove", (id, callback) => {
        delete artworks[id];
        process.nextTick(callback);
    });

    sandbox.stub(Artwork, "find", (query, callback, extra) => {
        let matches = [];

        if (query.$or) {
            const imageIds = query.$or.map((query) => query.images);

            for (const id in artworks) {
                const artwork = artworks[id];

                if (query._id.$ne === id) {
                    continue;
                }

                for (const imageId of imageIds) {
                    if (artwork.images.indexOf(imageId) >= 0) {
                        matches.push(artwork);
                        break;
                    }
                }
            }
        } else if (query.source) {
            matches = Object.keys(artworks).filter((id) =>
                artworks[id].source === query.source)
                .map((id) => artworks[id]);
        } else {
            matches = Object.keys(artworks).map((id) => artworks[id]);
        }

        if (!callback || extra) {
            const ret = {
                lean: () => ret,
                distinct: (name) => {
                    matches = matches.map((match) => match[name]);
                    return ret;
                },
                stream: () => ret,
                on: (name, callback) => {
                    if (name === "data") {
                        ret._ondata = callback.bind(ret);
                        return ret;
                    }

                    ret._onclose = callback.bind(ret);
                    process.nextTick(ret._popData);
                    return ret;
                },
                pause: () => ret,
                resume: () => {
                    process.nextTick(ret._popData);
                },
                _popData: () => {
                    if (matches.length > 0) {
                        ret._ondata(matches.shift());
                    } else {
                        ret._onclose();
                    }
                },
                exec: (callback) =>
                    process.nextTick(() => callback(null, matches)),
            };
            return ret;
        }

        process.nextTick(() => callback(null, matches));
    });

    sandbox.stub(Artwork, "search", (query, options, callback) => {
        const matches = Object.keys(artworks).map((id) => artworks[id]);
        const aggregations = {
            source: {
                buckets: [{key: "test", doc_count: 2}],
            },
            type: {
                buckets: [{key: "painting", doc_count: 2}],
            },
            date: {
                buckets: [{from: 1100, to: 1199, doc_count: 2}],
            },
            artist: {
                buckets: [{key: "Test", doc_count: 2}],
            },
            width: {
                buckets: [{from: 100, to: 199, doc_count: 2}],
            },
            height: {
                buckets: [{from: 100, to: 199, doc_count: 2}],
            },
        };

        process.nextTick(() => callback(null, {
            aggregations,
            hits: {
                total: matches.length,
                hits: matches,
            },
        }));
    });

    sandbox.stub(Artwork, "count", (query, callback) => {
        const count = Object.keys(artworks).filter((id) =>
            artworks[id].source === query.source).length;

        process.nextTick(() => callback(null, count));
    });

    const fromData = Artwork.fromData;

    sandbox.stub(Artwork, "fromData", (tmpData, req, callback) => {
        fromData.call(Artwork, tmpData, req,
            (err, artwork, warnings, creating) => {
                if (artwork && !artwork.save.restore) {
                    sandbox.stub(artwork, "save", (callback) => {
                        if (!(artwork._id in artworks)) {
                            artworks[artwork._id] = artwork;
                        }

                        process.nextTick(callback);
                    });
                }

                callback(err, artwork, warnings, creating);
            });
    });

    sandbox.stub(ImageImport, "find", (query, select, options, callback) => {
        process.nextTick(() => {
            callback(null, batches.filter((batch) =>
                (batch.state !== "error" && batch.state !== "completed")));
        });
    });

    sandbox.stub(ImageImport, "findById", (id, callback) => {
        process.nextTick(() => {
            callback(null, batches.find((batch) => batch._id === id));
        });
    });

    const imageImportFromFile = ImageImport.fromFile;

    sandbox.stub(ImageImport, "fromFile", (fileName, source) => {
        const batch = imageImportFromFile.call(ImageImport, fileName,
            source);
        if (!batch.save.restore) {
            sandbox.stub(batch, "save", (callback) => batch.validate((err) => {
                /* istanbul ignore if */
                if (err) {
                    callback(err);
                }

                batch.modified = new Date();
                batches.push(batch);
                callback(null, batch);
            }));
        }
        return batch;
    });

    sandbox.stub(ArtworkImport, "find", (query, select, options, callback) => {
        process.nextTick(() => {
            callback(null, artworkBatches.filter((batch) =>
                (batch.state !== "error" && batch.state !== "completed")));
        });
    });

    sandbox.stub(ArtworkImport, "findById", (id, callback) => {
        process.nextTick(() => {
            callback(null, artworkBatches.find((batch) => batch._id === id));
        });
    });

    const artworkImportFromFile = ArtworkImport.fromFile;

    sandbox.stub(ArtworkImport, "fromFile", (fileName, source) => {
        const batch = artworkImportFromFile.call(ArtworkImport, fileName,
            source);
        if (!batch.save.restore) {
            sandbox.stub(batch, "save", (callback) => batch.validate((err) => {
                /* istanbul ignore if */
                if (err) {
                    callback(err);
                }

                batch.modified = new Date();
                artworkBatches.push(batch);
                callback(null, batch);
            }));
        }
        return batch;
    });

    sandbox.stub(Source, "find", (query, callback) => {
        process.nextTick(() => callback(null, sources));
    });

    sandbox.stub(Image, "findById", (id, callback) => {
        process.nextTick(() => callback(null, images[id]));
    });

    sandbox.stub(Image, "findOne", (query, callback) => {
        // NOTE(jeresig): query.hash is assumed
        const id = Object.keys(images)
            .find((id) => images[id].hash === query.hash);
        const match = images[id];

        process.nextTick(() => callback(null, match));
    });

    sandbox.stub(Image, "update", (query, update, callback) => {
        process.nextTick(callback);
    });

    const fromFile = Image.fromFile;

    sandbox.stub(Image, "fromFile", (batch, file, callback) => {
        fromFile.call(Image, batch, file, (err, image, warnings) => {
            if (image && !image.save.restore) {
                sandbox.stub(image, "save", (callback) =>
                    image.validate(callback));
            }

            callback(err, image, warnings);
        });
    });

    sandbox.stub(UploadImage, "findById", (id, callback) => {
        process.nextTick(() => callback(null, uploadImages[id]));
    });

    sandbox.stub(core.similar, "similar", (hash, callback) => {
        process.nextTick(() => callback(null, similar[hash]));
    });

    sandbox.stub(core.similar, "fileSimilar", (file, callback) => {
        // Cheat and just get the hash from the file name
        const hash = path.basename(file).replace(/\..*$/, "");
        process.nextTick(() => callback(null, similar[hash]));
    });

    sandbox.stub(core.similar, "idIndexed", (hash, callback) => {
        process.nextTick(() => callback(null, !!similar[hash]));
    });

    sandbox.stub(core.similar, "add", (file, hash, callback) => {
        if (hash === "99998") {
            return process.nextTick(() => callback({
                type: "IMAGE_SIZE_TOO_SMALL",
            }));
        }

        similarAdded.push({id: hash, score: 5});
        similar[hash] = similarAdded;

        process.nextTick(callback);
    });

    sandbox.stub(core.db, "connect", process.nextTick);
};

const req = {
    format: (msg, fields) =>
        msg.replace(/%\((.*?)\)s/g, (all, name) => fields[name]),
    gettext: (msg) => msg,
    lang: "en",
};

let app;

const init = (done) => {
    genData();
    bindStubs();

    async.parallel([
        (callback) => {
            Source.cacheSources(() => {
                async.each(Object.keys(artworks), (id, callback) => {
                    artworks[id].validate(callback);
                }, callback);
            });
        },

        (callback) => {
            server((err, _app) => {
                app = _app;
                callback(err);
            });
        },
    ], () => {
        mockfs({
            "sources/test": {
                "images": {},
                "scaled": {},
                "thumbs": {},
            },
            "sources/uploads": {
                "images": {
                    "4266906334.jpg": testFiles["4266906334.jpg"],
                    "bar.jpg": testFiles["bar.jpg"],
                },
                "scaled": {},
                "thumbs": {},
            },
            "data": testFiles,
            "converters": converterFiles,
            "public": publicFiles,
            "views": viewFiles,
        });

        done();
    });
};

tap.beforeEach(init);

tap.afterEach((done) => {
    app.close();
    sandbox.restore();
    mockfs.restore();
    done();
});

module.exports = {
    getBatch: () => batch,
    getBatches: () => batches,
    getArtworkBatch: () => artworkBatch,
    getImage: () => image,
    getSource: () => source,
    getArtwork: () => artwork,
    getArtworks: () => artworks,
    getArtworkData: () => artworkData,
    getImageResultsData: () => imageResultsData,
    getUpload: () => upload,
    getUploadImage: () => uploadImage,
    req,
    Image,
    Artwork,
    ImageImport,
    ArtworkImport,
    UploadImage,
    Source,
    stub: sinon.stub,
    core,
    init,
};
