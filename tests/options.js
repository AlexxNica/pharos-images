"use strict";

const types = {
    architecture: {
        name: (i18n) => i18n.gettext("Architecture"),
    },

    "decorative arts": {
        name: (i18n) => i18n.gettext("Decorative Arts"),
    },

    drawing: {
        name: (i18n) => i18n.gettext("Drawing"),
    },

    fresco: {
        name: (i18n) => i18n.gettext("Fresco"),
    },

    medal: {
        name: (i18n) => i18n.gettext("Medal"),
    },

    miniature: {
        name: (i18n) => i18n.gettext("Miniature"),
    },

    mosaic: {
        name: (i18n) => i18n.gettext("Mosaic"),
    },

    painting: {
        name: (i18n) => i18n.gettext("Painting"),
    },

    photo: {
        name: (i18n) => i18n.gettext("Photo"),
    },

    print: {
        name: (i18n) => i18n.gettext("Print"),
    },

    sculpture: {
        name: (i18n) => i18n.gettext("Sculpture"),
    },

    "stained glass": {
        name: (i18n) => i18n.gettext("Stained Glass"),
    },
};

module.exports = {
    filters: ["artists", "locations", "objectType", "dates", "dimensions"],

    display: ["artists", "dates", "objectType", "medium", "dimensions",
        "categories", "locations"],

    sorts: {
        "dates.asc": (i18n) => i18n.gettext("Date, earliest first"),
        "dates.desc": (i18n) => i18n.gettext("Date, latest first"),
    },

    model: {
        // The title of the artwork.
        title: {
            type: "SimpleString",
            title: (i18n) => i18n.gettext("Title"),
            recommended: true,
        },

        // A list of artist names extracted from the page.
        artists: {
            type: "Name",
            searchName: "artist",
            title: (i18n) => i18n.gettext("Artist"),
            placeholder: (i18n) => i18n.gettext("Sample: Andrea del Sarto"),
        },

        // Date ranges when the artwork was created or modified.
        dates: {
            type: "YearRange",
            searchName: "date",
            title: (i18n) => i18n.gettext("Date"),
            placeholder: () => ({
                end: 1900,
                start: 1000,
            }),
        },

        // The English form of the object type (e.g. painting, print)
        objectType: {
            type: "FixedString",
            searchName: "type",
            title: (i18n) => i18n.gettext("Type"),
            placeholder: (i18n) => i18n.gettext("Any Type"),
            allowUnknown: false,
            values: types,
            recommended: true,
            url: (value) => `/type/${value}`,
        },

        // The medium of the artwork (e.g. "watercolor")
        medium: {
            type: "SimpleString",
            title: (i18n) => i18n.gettext("Medium"),
            searchField: "filter",
        },

        // The size of the artwork (e.g. 100mm x 200mm)
        dimensions: {
            type: "Dimension",
            title: (i18n) => i18n.gettext("Dimensions"),
            heightTitle: (i18n) => i18n.gettext("Height"),
            widthTitle: (i18n) => i18n.gettext("Width"),
            placeholder: () => ({
                max: 200,
                min: 10,
            }),
        },

        // Locations where the artwork is stored
        locations: {
            type: "Location",
            searchName: "location",
            title: (i18n) => i18n.gettext("Location"),
            placeholder: (i18n) => i18n.gettext("Sample: Louvre"),
        },

        // Categories classifying the artwork
        // The medium of the artwork (e.g. "watercolor")
        categories: {
            type: "SimpleString",
            title: (i18n) => i18n.gettext("Categories"),
            multiple: true,
            searchField: "filter",
        },
    },

    searchURLs: {
        "/type/:type": (req, res, search) => {
            const type = types[req.params.type];

            if (!type) {
                return res.status(404).render("Error", {
                    title: req.gettext("Not found."),
                });
            }

            search(req, res);
        },
    },
};
