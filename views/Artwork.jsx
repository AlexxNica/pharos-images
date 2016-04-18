"use strict";

const React = require("react");

const Page = require("./Page.jsx");

const artworkType = React.PropTypes.shape({
    artists: React.PropTypes.arrayOf(
        React.PropTypes.shape({
            _id: React.PropTypes.string,
            name: React.PropTypes.string.isRequired,
            pseudonym: React.PropTypes.string,
        })
    ),
    dates: React.PropTypes.arrayOf(
        React.PropTypes.shape({
            _id: React.PropTypes.string,
            original: React.PropTypes.string,
            circa: React.PropTypes.bool,
            end: React.PropTypes.number,
            start: React.PropTypes.number,
        })
    ),
    dimensions: React.PropTypes.arrayOf(
        React.PropTypes.shape({
            _id: React.PropTypes.string,
            height: React.PropTypes.number,
            width: React.PropTypes.number,
        })
    ),
    images: React.PropTypes.arrayOf(
        React.PropTypes.shape({
            _id: React.PropTypes.string.isRequired,
        })
    ),
    medium: React.PropTypes.string,
    objectType: React.PropTypes.string,
    title: React.PropTypes.string,
});

module.exports = React.createClass({
    propTypes: {
        URL: React.PropTypes.func.isRequired,
        artworks: React.PropTypes.arrayOf(artworkType),
        compare: React.PropTypes.bool.isRequired,
        format: React.PropTypes.func.isRequired,
        fullName: React.PropTypes.func.isRequired,
        getDate: React.PropTypes.func.isRequired,
        getDimension: React.PropTypes.func.isRequired,
        getTitle: React.PropTypes.func.isRequired,
        getType: React.PropTypes.func.isRequired,
        gettext: React.PropTypes.func.isRequired,
        searchURL: React.PropTypes.func.isRequired,
        shortName: React.PropTypes.func.isRequired,
        similar: React.PropTypes.arrayOf(artworkType),
        stringNum: React.PropTypes.func.isRequired,
    },

    renderArtwork() {
        const compare = this.props.compare;
        const artworks = this.props.artworks;
        const artworkWidth = this.props.similar.length > 0 ?
            "col-md-9" : "col-md-12";

        return <div className={`${artworkWidth} imageholder`}>
            {(compare || artworks.length > 1) &&
                <a href={this.props.URL(artworks[0])}
                    className="btn btn-success"
                >
                    &laquo; {this.props.gettext("End Comparison")}
                </a>}
            <div className="responsive-table">
                <table className="table table-hover">
                    <thead>
                        <tr className="plain">
                            <th></th>
                            {artworks.map((artwork) =>
                                this.renderTitle(artwork))}
                        </tr>
                        <tr className="plain">
                            <td></td>
                            {artworks.map((artwork) =>
                                this.renderImages(artwork))}
                        </tr>
                    </thead>
                    <tbody>
                        {(compare || artworks[0].artists.length > 0) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Artist")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderArtist(artwork))}
                        </tr>}
                        {(compare || artworks[0].dates.length > 0) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Date")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderDate(artwork))}
                        </tr>}
                        {(compare || artworks[0].objectType) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Type")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderType(artwork))}
                        </tr>}
                        {(compare || artworks[0].medium) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Medium")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderMedium(artwork))}
                        </tr>}
                        {(compare || artworks[0].dimensions.length > 0) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Dimensions")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderDimensions(artwork))}
                        </tr>}
                        {(compare || artworks[0].categories.length > 0) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Categories")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderCategories(artwork))}
                        </tr>}
                        {(compare || artworks[0].locations.length > 0) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Location")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderLocation(artwork))}
                        </tr>}
                        {(compare || artworks[0].url) && <tr>
                            <th className="text-right">
                                {this.props.gettext("Details")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderDetails(artwork))}
                        </tr>}
                        <tr>
                            <th className="text-right">
                                {this.props.gettext("Source")}
                            </th>
                            {artworks.map((artwork) =>
                                this.renderSource(artwork))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>;
    },

    renderTitle(artwork) {
        const size = Math.max(Math.round(12 / this.props.artworks.length), 3);
        let title = artwork.title || "";

        if (artwork.objectType) {
            const type = this.props.getType(artwork);
            title = title ? `${type}: ${title}` : type;
        }

        return <th className={`col-xs-${size} text-center`} key={artwork._id}>
            <h1 className="panel-title">{title}</h1>
        </th>;
    },

    renderImages(artwork) {
        const carouselId = artwork._id.replace("/", "-");

        return <td key={artwork._id}>
            <div id={carouselId} className="carousel" data-interval="0">
                <div className="carousel-inner" role="listbox">
                    {artwork.images.map((image, i) =>
                        this.renderImage(artwork, image, i))}
                </div>

                {artwork.images.length > 1 && this.renderCarousel(artwork)}
            </div>
        </td>;
    },

    renderImage(artwork, image, i) {
        const active = i === 0 ? "active" : "";

        return <div className={`item ${active}`} key={image._id}>
            <a href={image.getOriginalURL()}>
                <img src={image.getScaledURL()}
                    alt={this.props.getTitle(artwork)}
                    title={this.props.getTitle(artwork)}
                    className="img-responsive center-block"
                />
            </a>
        </div>;
    },

    renderCarousel(artwork) {
        const carouselId = artwork._id.replace("/", "-");

        return <div>
            <ol className="carousel-indicators">
                {artwork.images.map((image, i) =>
                    <li data-target={`#${carouselId}`} data-slide-to={i}
                        className={i === 0 ? "active" : ""} key={carouselId}
                    ></li>
                )}
            </ol>
            <a className="left carousel-control"
                href={`#${carouselId}`} role="button"
                data-slide="prev"
            >
                <span className="glyphicon glyphicon-chevron-left"
                    aria-hidden="true"
                ></span>
                <span className="sr-only">
                    {this.props.gettext("Previous")}
                </span>
            </a>
            <a className="right carousel-control"
                href={`#${carouselId}`} role="button"
                data-slide="next"
            >
                <span className="glyphicon glyphicon-chevron-right"
                    aria-hidden="true"
                ></span>
                <span className="sr-only">
                    {this.props.gettext("Next")}
                </span>
            </a>
        </div>;
    },

    renderArtist(artwork) {
        return <td key={artwork._id}>
            {artwork.artists.map((artist) => <span key={artist._id}>
                <a href={this.props.searchURL({artist: artist.name})}>
                    {artist.name}
                </a>
                {artist.pseudonym &&
                    (<a href={this.props.searchURL({artist: artist.pseudonym})}>
                        {artist.pseudonym}
                    </a>)}
                <br/>
            </span>)}
        </td>;
    },

    renderDate(artwork) {
        return <td key={artwork._id}>
            {artwork.dates.map((date) => <span key={date._id}>
                <a href={this.props.searchURL({
                    dateStart: date.start,
                    dateEnd: date.end,
                })}
                >
                    {this.props.getDate(date)}
                </a><br/>
            </span>)}
        </td>;
    },

    renderType(artwork) {
        return <td key={artwork._id}>
            {artwork.objectType && <a href={this.props.searchURL(
                {type: artwork.objectType})}
            >
                {this.props.getType(artwork)}
            </a>}
        </td>;
    },

    renderMedium(artwork) {
        return <td key={artwork._id}>{artwork.medium}</td>;
    },

    renderDimensions(artwork) {
        return <td key={artwork._id}>
            {artwork.dimensions.map((dimension) => <span key={dimension._id}>
                {this.props.getDimension(dimension)}<br/>
            </span>)}
        </td>;
    },

    renderCategories(artwork) {
        return <td key={artwork._id}>
            {artwork.categories.map((category, i) => <span key={category}>
                <a href={this.props.searchURL({filter: category})}>
                    {category}
                </a>
                {artwork.categories.length - 1 === i ? "" : ", "}
            </span>)}
        </td>;
    },

    renderLocation(artwork) {
        return <td key={artwork._id}>
            {artwork.locations.map((location) => <span key={location._id}>
                {location.name && <span>
                    <a href={this.props.searchURL({location: location.name})}>
                        {location.name}
                    </a><br/>
                </span>}
                {location.city && <span>{location.city}<br/></span>}
            </span>)}
        </td>;
    },

    renderDetails(artwork) {
        const source = artwork.getSource();
        let link = <a href={artwork.url}>
            {this.props.gettext("More information...")}</a>;

        if (source.inactive) {
            link = <small>{this.props.gettext(
                "Unfortunately the source of this artwork no longer exists.")}
            </small>;
        } else if (source.hideLinks) {
            link = <small>{this.props.gettext("There is no way to link to " +
                "this artwork on the source site. Please visit the source " +
                "and search for the artwork there.")}
            </small>;
        } else if (source.linkTitle) {
            link = <small><a href={artwork.url}
                title={artwork.getSource().linkTitle}
            >
                {this.props.getTitle(artwork)}
            </a></small>;
        }

        return <td key={artwork._id}>{link}</td>;
    },

    renderSource(artwork) {
        const source = artwork.getSource();

        if (source.inactive) {
            return <td key={artwork._id}>
                <a href={this.props.URL(source)}
                    title={this.props.fullName(source)}
                >
                    {this.props.fullName(source)}
                </a>
            </td>;
        }

        return <td key={artwork._id}>
            <a href={source.url}>
                {source.linkText || this.props.fullName(source)}
            </a><br/>
            <small><a href={this.props.URL(source)}
                title={this.props.fullName(source)}
            >
                {this.props.format(this.props.gettext(
                    "Browse all %(count)s artworks..."),
                    {count: this.props.stringNum(source.numArtworks)})}
            </a></small>
        </td>;
    },

    renderSimilar() {
        return <div className="col-md-3">
            <a href="?compare" className="btn btn-success btn-block"
                style={{marginBottom: 20}}
            >
                {this.props.gettext("Compare Artworks")} &raquo;
            </a>

            <div className="panel panel-default">
                <div className="panel-heading">
                    {this.props.gettext("Similar Artworks")}
                </div>
                <div className="panel-body row">
                    {this.props.similar.map((match) =>
                        this.renderSimilarMatch(match))}
                </div>
            </div>
        </div>;
    },

    renderSimilarMatch(match) {
        if (!match.artwork) {
            return null;
        }

        return <div className="img col-md-12 col-xs-6 col-sm-4" key={match._id}>
            <a href={this.props.URL(match.artwork)}>
                <img src={match.artwork.getThumbURL()}
                    alt={this.props.getTitle(match.artwork)}
                    title={this.props.getTitle(match.artwork)}
                    className="img-responsive center-block"
                />
            </a>
            <div className="details">
                <div className="wrap">
                    <span>{this.props.format(this.props.gettext(
                        "Score: %(score)s"), {score: match.score})}</span>

                    <a className="pull-right"
                        href={this.props.URL(match.artwork.getSource())}
                        title={this.props.fullName(match.artwork.getSource())}
                    >
                        {this.props.shortName(match.artwork.getSource())}
                    </a>
                </div>
            </div>
        </div>;
    },

    renderScript() {
        return <script
            dangerouslySetInnerHTML={{__html: `
                $(function() {
                    $(".carousel").carousel();
                });
            `}}
        />;
    },

    render() {
        return <Page
            {...this.props}
            title={this.props.artworks[0].title}
            scripts={this.renderScript()}
        >
            <div className="row">
                {this.renderArtwork()}
                {this.props.similar.length > 0 && this.renderSimilar()}
            </div>
        </Page>;
    },
});
