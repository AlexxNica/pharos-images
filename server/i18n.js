"use strict";

const i18n = require("i18n-abide");

const config = require("../lib/config");
const options = require("../lib/options");

module.exports = (app) => {
    app.use((req, res, next) => {
        // i18n-abide overwrites all the locals, so we need to save them
        // and restore them after it's done.
        res.tmpLocals = res.locals;
        next();
    });

    app.use(i18n.abide({
        supported_languages: Object.keys(options.locales),
        default_lang: options.defaultLocale,
        translation_directory: "translations",
        translation_type: "po",
    }));

    app.use((req, res, next) => {
        // Restore the old local properties and methods
        Object.assign(res.locals, res.tmpLocals);

        /* istanbul ignore next */
        const host = req.headers["x-forwarded-host"] || req.get("host");
        let locale = config.USE_I18N_SUBDOMAIN === "1" ?
            // Set the locale based upon the subdomain
            /^\w*/.exec(host)[0] :

            // Set the locale based upon the ?lang= query string
            req.query.lang;

        // Fall back to the default locale if one isn't given, or it's invalid
        if (!options.locales[locale]) {
            locale = options.defaultLocale;
        }

        res.locals.setLocale(locale);

        next();
    });
};
