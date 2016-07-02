"use strict";

const React = require("react");
const yearRange = require("yearrange");

const YearRangeFilter = React.createFactory(
    require("../../views/types/filter/YearRange.jsx"));
const YearRangeDisplay = React.createFactory(
    require("../../views/types/view/YearRange.jsx"));

const numRange = (bucket) => bucket.to ?
    `${bucket.from || 0}-${bucket.to}` :
    `${bucket.from}+`;

const YearRange = function(options) {
    this.options = options;
    /*
    name
    modelName
    title(i18n)
    placeholder(i18n)
    */
};

YearRange.prototype = {
    modelName() {
        return this.options.modelName || this.options.name;
    },

    value(query) {
        const start = query[`${this.options.name}.start`];
        const end = query[`${this.options.name}.end`];

        if (start || end) {
            return {start, end};
        }
    },

    fields(value) {
        return {
            [`${this.options.name}.start`]: value.start,
            [`${this.options.name}.end`]: value.end,
        };
    },

    searchTitle(query, i18n) {
        const title = this.options.title(i18n);
        const range = numRange({
            from: query[this.options.name].start,
            to: query[this.options.name].end,
        });

        return `${title}: ${range}`;
    },

    filter(query) {
        // NOTE(jeresig): There has got to be a better way to handle this.
        const start = query[this.options.name].start || -10000;
        const end = query[this.options.name].end ||
            (new Date).getYear() + 1900;

        const startInside = {
            bool: {
                must: [
                    {
                        range: {
                            [`${this.modelName()}.start`]: {
                                lte: parseFloat(start),
                            },
                        },
                    },

                    {
                        range: {
                            [`${this.modelName()}.end`]: {
                                gte: parseFloat(start),
                            },
                        },
                    },
                ],
            },
        };

        const endInside = {
            bool: {
                must: [
                    {
                        range: {
                            [`${this.modelName()}.start`]: {
                                lte: parseFloat(end),
                            },
                        },
                    },

                    {
                        range: {
                            [`${this.modelName()}.end`]: {
                                gte: parseFloat(end),
                            },
                        },
                    },
                ],
            },
        };

        const contains = {
            bool: {
                must: [
                    {
                        range: {
                            [`${this.modelName()}.start`]: {
                                gte: parseFloat(start),
                            },
                        },
                    },

                    {
                        range: {
                            [`${this.modelName()}.end`]: {
                                lte: parseFloat(end),
                            },
                        },
                    },
                ],
            },
        };

        return {
            bool: {
                should: [
                    startInside,
                    endInside,
                    contains,
                ],
            },
        };
    },

    facet(value) {
        // TODO: Make these ranges configurable
        let ranges = [
            { to: 999 },
            { from: 1000, to: 1099 },
            { from: 1100, to: 1199 },
            { from: 1200, to: 1299 },
            { from: 1300, to: 1399 },
            { from: 1400, to: 1499 },
            { from: 1500, to: 1599 },
            { from: 1600, to: 1699 },
            { from: 1700, to: 1799 },
            { from: 1800 },
        ];

        const start = parseFloat(value.start);
        const end = parseFloat(value.end);

        if (start && end && end - start < 300) {
            ranges = [];
            for (let year = start; year < end; year += 10) {
                ranges.push({
                    from: year,
                    to: year + 9,
                });
            }
        }

        return {
            range: {
                field: `${this.modelName()}.years`,
                ranges,
            },
        };
    },

    formatFacetBucket(bucket, searchURL) {
        return {
            text: numRange(bucket),
            url: searchURL({
                [`${this.props.name}.start`]: bucket.from,
                [`${this.props.name}.end`]: bucket.to,
            }),
        };
    },

    renderFilter(value, i18n) {
        return YearRangeFilter({
            name: this.options.name,
            placeholder: this.options.placeholder(i18n),
            title: this.options.title(i18n),
            value,
        });
    },

    renderView(data, searchURL) {
        return YearRangeDisplay({
            name: this.options.name,
            searchURL,
            value: data[this.modelName()],
        });
    },

    schema(Schema) {
        const YearRangeSchema = new Schema({
            // An ID for the year range, computed from the original + start/end
            // properties before validation.
            _id: String,

            // The source string from which the year range was generated
            original: String,

            // A label associated with the year range (e.g. "modified")
            label: String,

            // If the year range should be treated as "circa"
            circa: Boolean,

            // The year range range start and end
            start: {type: Number, es_indexed: true},
            start_ca: Boolean,
            end: {type: Number, es_indexed: true},
            end_ca: Boolean,

            // If the end year is the current year
            current: {type: Boolean, es_indexed: true},

            // A generated list of years which this year range maps to. This is
            // indexed in Elasticsearch for things like histograms and
            // aggregations.
            years: [{type: Number, es_indexed: true}],
        });

        YearRangeSchema.methods = {
            toJSON() {
                const obj = this.toObject();
                delete obj.original;
                delete obj.years;
                return obj;
            },
        };

        // We generate a list of years in which the artwork exists, in order
        // to improve querying inside Elasticsearch
        YearRangeSchema.pre("validate", function(next) {
            if (!this.start || !this.end || this.start > this.end) {
                return next();
            }

            const years = [];

            for (let year = this.start; year <= this.end; year += 1) {
                years.push(year);
            }

            this.years = years;

            next();
        });

        // Dynamically generate the _id attribute
        YearRangeSchema.pre("validate", function(next) {
            this._id = this.original || [this.start, this.end].join(",");
            next();
        });

        return {
            type: [YearRangeSchema],
            convert: (obj) => typeof obj === "string" ?
                yearRange.parse(obj) : obj,
            validateArray: (val) => val.start || val.end,
            validationMsg: (i18n) =>
                i18n.gettext("Dates must have a start or end specified."),
        };
    },
};

module.exports = YearRange;
