import fs from "fs"
import _ from "lodash"

import { Srt } from "./srtHelper.js"

export default class Ytdl {
  videoFolderPath
  videoName
  videoUrl

  constructor(videoFolderPath, videoName, videoUrl) {
    this.videoFolderPath = videoFolderPath
    this.videoName = videoName
    this.videoUrl = videoUrl
  }

  _videoInfo

  get videoInfo() {
    if (!this._videoInfo) {
      const videoInfoJsonFilepath = `${this.videoFolderPath}/${this.videoName}.info.json`
      this._videoInfo = JSON.parse(fs.readFileSync(videoInfoJsonFilepath, "utf8"))
    }

    return this._videoInfo
  }

  /**
   * Convert a yt-dlp video folder to an array of InstantSearch JSON objects for the captions
   *
   * @param {*} videoFolderPath where the yt-dlp video is stored
   * @param {*} videoFolderName where the yt-dlp video is stored
   * @returns {Array<Object>} array of InstantSearch JSON objects for the captions
   */

  async convertToInstantSearchCaptions(videoUrl) {
    this.videoUrl = videoUrl || this.videoUrl

    try {
      const subs = await Srt.getSubs(this.videoFolderPath, this.videoName, "fr.srt")

      let duration = 0,
        subtitle
      const captions = _.map(subs, sub => {
        if (sub) {
          ;[duration, subtitle] = Srt.srtJsonToInstantSearch(sub, this.videoUrl, duration)
          return subtitle
        } else {
          return {}
        }
      })

      return captions
    } catch (error) {
      console.log("convertToInstantSearchCaptions : pas de sous-titres pour cette vidéo : ", this.videoName)
      //console.error("ERROR in convertToInstantSearchCaptions", error)
      return []
    }
  }

  /**
   * Convert a yt-dlp video folder to an InstantSearch JSON object for the video
   *
   * @param {*} videoFolderPath where the yt-dlp video is stored
   * @param {*} videoFolderName where the yt-dlp video is stored
   * @returns {Object} InstantSearch JSON object for the video
   */

  convertToInstantSearchVideo() {
    // prettier-ignore
    return {
        id:          this.videoInfo.id,
        title:       this.videoInfo.fulltitle,
        //description: this.videoInfo.description,
        languageCode: "fr",
        thumbnails: {
          default: {
            url:    this.videoInfo.thumbnail,
            width:  120,
            height:  90,
          },
        },
        languageCode:  this.videoInfo.language,
        publishedDate: parseDate(this.videoInfo.upload_date || this.videoInfo.release_date || this.videoInfo.upload_date),
        popularity: {
          views:     this.videoInfo.view_count,
          likes:     this.videoInfo.like_count,
          dislikes:  this.videoInfo.dislike_count,
          favorites: this.videoInfo.favorite_count,
          comments:  this.videoInfo.comment_count,
        },
        duration: {
          minutes: this.videoInfo.duration / 60,
          seconds: this.videoInfo.duration % 60,
        },
        url:              this.videoInfo.webpage_url, 
        hasCaptions:      true,
        hasManualCaptions: true,
      }
  }

  convertToInstantSearchChannel() {
    //prettier-ignore
    return {
      id:    this.videoInfo.channel_id,
      title: this.videoInfo.channel,
    }
  }

  convertToInstantSearchPlaylist() {
    //prettier-ignore
    return {
      id:          this.videoInfo.playlist_id,
      title:       this.videoInfo.playlist,
      description: this.videoInfo.playlist_title,
    }
  }
}

/**
 * Converts date into timestamp
 * @param {string} dt in the format "yyyymmdd"
 *
 * @returns {number} timestamp
 */
function parseDate(dt) {
  var year = dt.substring(0, 4)
  var month = dt.substring(4, 6)
  var day = dt.substring(6, 8)
  return new Date(year, month - 1, day).getTime()
}
