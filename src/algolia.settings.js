import _ from "lodash"

// We manually disable typo on years
const yearsTypoDisabled = _.times(60, year => `${1970 + year}`)

// prettier-ignore
const module = {
  searchableAttributes: [
    // TODO : implement search on 4 indices to distinguish these 4 types of search
    // "unordered(video.title)", 
    // "unordered(speakers.name)", 
    "unordered(caption.content)", 
    // "unordered(conference.name)"
  ],
  customRanking: [
    "desc(video.hasCaptions)",
    "desc(video.popularity.score)", 
    "desc(video.hasManualCaptions)",
    "desc(video.publishedDate.day)",
    "desc(video.duration.minutes)",
    "asc(video.positionInPlaylist)",
    "asc(caption.start)"
  ],
  attributesForFaceting: [
    "speakers.name",
    "conference.name",
    "conference.year",
    "video.hasManualCaptions",
    "video.id",
    "video.languageCode",
    "caption.languageCode",
    "playlist.id",
    "playlist.title",
    "channel.id",
    "channel.title"
  ],

  // SNIPPETING
  attributesToSnippet: ["caption.content:8"],
  snippetEllipsisText: "...",

  // HIGHLIGHTING
  highlightPreTag: '<em class="ats-highlight">',
  highlightPostTag: "</em>",
  replaceSynonymsInHighlight: true,
  
  // GROUPING
  hitsPerPage: 7,
  distinct: 5,
  attributeForDistinct: "video.id",

  advancedSyntax: true,
  disableTypoToleranceOnWords: yearsTypoDisabled,
}

export default module
