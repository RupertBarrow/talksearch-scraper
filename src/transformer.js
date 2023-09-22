import _ from "lodash"
import dayjs from "dayjs"
import globals from "./globals.js"
import configHelper from "../configs/config-helper.js"
import language from "../src/language.js"

const module = {
  /**
   * Compute a value for ranking based on the various popularity metrics.
   * So far, it's an easy sum of all interactions (like/dislike/views/comments,
   * etc).
   * @param {Object} videoData Object of all interactions
   * @return {Number} Popularity score
   **/
  getPopularityScore(videoData) {
    if (!_.has(videoData, "popularity")) {
      return 0
    }
    return _.sum(_.values(_.get(videoData, "popularity")))
  },

  /**
   * Return an object representation of the date, with timestamp values capped at
   * the start of the day, month and year. This will be used to limit ties in the
   * custom ranking
   * @param {Number} timestamp The exact timestamp
   * @returns {Object} An object of capped timestamps
   **/
  getBucketedDate(timestamp) {
    const date = dayjs(timestamp * 1000)
    const yearGranularity = date.startOf("year")
    const monthGranularity = date.startOf("month")
    const dayGranularity = date.startOf("day")

    return {
      year: yearGranularity.unix(),
      month: monthGranularity.unix(),
      day: dayGranularity.unix(),
      timestamp: date.unix(),
    }
  },

  /**
   * Return a url to go to the specific time in the video
   * @param {String} videoId Video id
   * @param {Number} start Start time, in seconds
   * @returns {String} Url pointing to the specific time in the video
   **/
  getCaptionUrl(videoId, start) {
    let url = `https://www.youtube.com/watch?v=${videoId}`
    if (start > 0) {
      url = `${url}&t=${start}s`
    }
    return url
  },

  /**
   * Return an object representing a caption
   * @param {String} userCaption Caption string
   * @param {Number} position Position index in the list of all captions
   * @param {String} videoId The YouUbe videoId
   * @returns {Object} An object representing a caption
   **/
  getCaptionDetails(userCaption, position, videoId) {
    let caption = userCaption
    // Always adding a caption, even if empty, it makes the front-end logic easier
    // to handle
    if (!caption) {
      caption = {
        content: null,
        duration: 0,
        start: 0,
      }
    }

    // Round start to exact second because we can't jump to more precise than
    // that
    const start = _.floor(caption.start)
    const url = this.getCaptionUrl(videoId, start)

    return {
      ...caption,
      position,
      start,
      url,
    }
  },

  /**
   * Returns an array of record from a video
   * @param {Object} video The video object
   * @returns {Array} An array of all records for this video, one per caption
   **/
  recordsFromVideo(video) {
    // Enhanced video data
    const videoDetails = { ...video.video }

    //console.log("recordsFromVideo VIDEO", video)

    _.set(videoDetails, "id", video.id)
    _.set(videoDetails, "title", video.title)
    _.set(videoDetails, "url", video.url)
    _.set(videoDetails, "duration", video.duration) // in seconds
    _.set(videoDetails, "popularity.score", this.getPopularityScore(video))
    _.set(videoDetails, "publishedDate", this.getBucketedDate(video.publishedDate))
    try {
      _.set(videoDetails, "thumbnail", video.thumbnails.default.url)
    } catch (error) {
      // NOTHING : in case the thumbnail cannot be found
    }

    // Base record metadata to add to all records
    let baseRecord = {
      video: videoDetails,
      playlist: video.playlist,
      channel: video.channel,
      //speakers: video.speakers,
      //conference: video.conference,
    }

    // Config specific updates
    const config = globals.config()
    if (_.get(config, "transformData")) {
      baseRecord = config.transformData(baseRecord, configHelper)
    }

    // One record per caption, with a minimum of 1 even if no captions
    let captions = _.get(video, "captions")
    if (_.isEmpty(captions)) {
      captions = [undefined]
    }

    return _.map(captions, (caption, position) => {
      const videoId = baseRecord.video.id
      const captionDetails = this.getCaptionDetails(caption, position, videoId)
      const record = {
        ...baseRecord,
        caption: captionDetails,
      }

      return record
    })
  },

  /**
   * Guess the conference year based on the playlist name
   * @param {Object} video The video object
   * @returns {Number} The conference year
   **/
  guessConferenceYear(video) {
    const playlistTitle = _.get(video, "playlist.title", null)
    if (!playlistTitle) {
      return null
    }
    const matches = playlistTitle.match(/[0-9]{4}/)
    if (!matches) {
      return null
    }
    return _.parseInt(matches)
  },

  /**
   * Enrich the raw video data as extracted from YouTube with some guess about
   * other fields
   * @param {Array} inputVideos List of raw videos
   * @returns {Array} The enriched list of videos
   * Note that this will create .conference and .speakers keys to the object
   **/
  async enrichVideos(inputVideos) {
    // Extract speakers from text analysis of the title
    let videos = await language.enrichVideos(inputVideos)

    // Guessing conference year
    videos = _.map(videos, video => ({
      ...video,
      conference: {
        year: this.guessConferenceYear(video),
      },
    }))

    return videos
  },

  async run(inputVideos) {
    console.log("transformer.run INPUT VIDEOS", inputVideos)

    // Enrich videos
    const videos = await this.enrichVideos(inputVideos)
    console.log("transformer.run VIDEOS", videos)

    // Convert videos to records
    const records = _.flatten(_.map(videos, this.recordsFromVideo))

    console.log("transformer.run RECORDS", records.length, records.slice(14, 16))
    return records
  },
}

export default _.bindAll(module, _.functions(module))
