import axios from "axios"
import cheerio from "cheerio"
import diskLogger from "./disk-logger.js"
import fileutils from "./fileutils.js"
import globals from "./globals.js"
import pMap from "p-map"
import pulse from "./pulse.js"
import qs from "query-string"
import _ from "lodash"

import { formatChannel, formatVideo } from "./youtube-yt-dlp/formatters.js"
import Ytdl from "./youtube-yt-dlp/ytdlpHelper.js"

// import { forEach, map } from 'p-iteration';
import pkg from "p-iteration"
const { forEach, map } = pkg

export default class YoutubeYtdlp {
  /**
   * Call a Youtube API endpoint with GET parameters
   *
   * @param {String} endpoint The /endpoint to call
   * @param {Object} params The parameters to pass
   * @returns {Promise.<Object>} The data returned by the call
   **/
  async get(endpoint, params) {
    try {
      const options = {
        baseURL: "https://www.googleapis.com/youtube/v3",
        url: endpoint,
        params: {
          key: globals.youtubeApiKey(),
          ...params,
        },
      }
      const results = await axios(options)
      return results.data
    } catch (err) {
      pulse.emit("error", err, `get/${endpoint}/${JSON.stringify(params)}`)
      return {}
    }
  }

  /**
   * Return details about a specific playlist
   *
   * @param {String} playlistId The playlist id
   * @returns {Promise.<Object>} The playlist data
   **/

  async getPlaylistData(playlistId) {
    return {
      id: "playlistId",
      title: "playlistData.snippet.title",
      description: "playlistData.snippet.description",
    }
  }

  /**
   * Returns a list of all videos from a specific playlist
   *
   * @param {String} playlistId The id of the playlist
   * @returns {Promise.<Array>} A list of all videos in a playlist
   *
   * It can only get up to 50 videos per page in one call. It will browse all
   * pages to get all videos.
   **/

  async getVideosFromPlaylist(pathToSource, channelFolderName) {
    const debug = true

    try {
      //const videoFolderName = "Connecting with Amanda Buys & L (006) The Hitler project"

      const videoFolderPaths = await fileutils.glob(`${pathToSource}/${channelFolderName}/!(* - Videos)`)
      console.log("getVideosFromPlaylist videoFolderNames", videoFolderPaths.length, videoFolderPaths)

      pulse.emit("youtube:crawling:start", { playlists: videoFolderPaths })

      //const videoFolderPath = videoFolderPaths[0]
      const videos = await Promise.all(
        videoFolderPaths.map(async videoFolderPath => {
          //const videoFolderPath = `${pathToSource}/${channelFolderName}/${videoFolderName}`
          const videoName = videoFolderPath.split("/").slice(-1)[0]
          const ytdl = new Ytdl(videoFolderPath, videoName)

          const channelMetadata = ytdl.convertToInstantSearchChannel()
          const videoMetadata = ytdl.convertToInstantSearchVideo()
          //if (debug) console.log("getVideosFromPlaylist VIDEOMETADATA", videoName, videoMetadata)

          const videoUrl = videoMetadata.url
          const captionsArray = await ytdl.convertToInstantSearchCaptions(videoUrl)
          if (debug) console.log("getVideosFromPlaylist CAPTIONSARRAY", captionsArray?.length, videoName)
          const playlistMetadata = ytdl.convertToInstantSearchPlaylist()

          // Keep only videos with captions
          if (captionsArray) {
            let video = {
              ...videoMetadata,
              channel: channelMetadata,
              playlist: playlistMetadata,
              captions: captionsArray.map(caption => {
                return {
                  id: `${videoMetadata.id}__${caption.position}`,
                  ...caption,
                  //video: videoMetadata,
                }
              }),
            }
            //if (debug) console.log("getVideosFromPlaylist VIDEO : ", videoName, video)

            return video
          }
        })
      )

      if (debug) console.log("getVideosFromPlaylist VIDEOS : ", videos.length, channelFolderName, videos.slice(0, 2))

      pulse.emit("playlist:end", { videos })

      return videos
    } catch (err) {
      console.log("########## ERROR ####################")
      pulse.emit("error", err, `getVideosFromPlaylist(${pathToSource}, ${channelFolderName})`)
      return []
    }
  }

  /**
   * Returns details about specific videos
   *
   * @param {Array.<String>} userVideoId The array of ids of the
   * video to get data from
   * @returns {Promise.<Object>} An object where each key is a video id and each
   * value its detailed information
   **/

  async getVideosData(userVideoId) {
    /**
     * Get videos with a list of parts
     * Return an array of videos :
     *   videoData[videoId] {} (video)
     *
     * See data model here :
     * https://community.algolia.com/talksearch/anatomy-of-a-record.html
     */

    try {
      const parts = ["contentDetails", "snippet", "statistics", "status"].join(",")
      let videoIds = userVideoId
      if (!_.isArray(videoIds)) {
        videoIds = [videoIds]
      }

      const response = await this.get("videos", {
        id: videoIds.join(","),
        part: parts,
      })
      diskLogger.write(`videos/${_.first(videoIds)}-to-${_.last(videoIds)}.json`, response)

      const items = _.get(response, "items", [])
      const videoData = {}
      await pMap(items, async data => {
        const videoId = data.id
        const defaultAudioLanguage = _.get(data, "snippet.defaultAudioLanguage")
        const captions = await this.getCaptions(videoId, defaultAudioLanguage)

        const channelMetadata = formatChannel(data)
        const videoMetadata = formatVideo(data, captions)

        videoData[videoId] = {
          channel: channelMetadata,
          video: videoMetadata,
          captions,
        }
      })

      return videoData
    } catch (err) {
      pulse.emit("error", err, `getVideosData(${userVideoId})`)
      return {}
    }
  }

  async getVideosFromCache() {
    const config = globals.config()
    const configName = globals.configName()
    const playlists = config.playlists
    const blockList = config.blockList

    const playlistGlob = playlists.length === 1 ? `${playlists[0]}.json` : `{${playlists.join(",")}}.json`

    const playlistFiles = await fileutils.glob(`./cache/${configName}/youtube-yt-dlp/${playlistGlob}`)
    let videos = _.flatten(await map(playlistFiles, fileutils.readJson))

    // Remove videos that are part of the blocklist
    if (blockList) {
      videos = _.reject(videos, video => _.includes(blockList, _.get(video, "video.id")))
    }

    return videos
  }

  async getVideosFromYtdlpFolder() {
    const config = globals.config() || {
      indexName: "yt-dlp",
      pathToSource: "/Volumes/Altius Backup Box/LA RÉALITÉ Vidéos/yt-dlp downloads/Youtube",
      channels: [
        /*
        "Aquarius Rising Africa Ⅱ",
        "116000 Enfants Disparus",
        "The reveal report",
        */
        "Right on Radio CH 2",
        /*
        "Retour à Outreau",
        "Alexandre Lebreton",
        "Alexandre Lebreton - chaîne secondaire",
        "ALEXIS DU REAU ACTEUR OFFICIEL",
        "60 Minutes Australia",
        "Espagne  - un bébé contre des papiers  - Désintox - ARTE",
        */
      ],

      transformData(rawRecord, helper) {
        let record = rawRecord

        //console.log("GLOBALS transformData RECORD", record)

        return record
      },

      transformSettings(rawSettings) {
        // prettier-ignore
        return {
          ...rawSettings,
          searchableAttributes: [
            // TODO : implement search on 4 indices to distinguish these 4 types of search
            // "unordered(video.title)", 
            // "unordered(speakers.name)", 
            "unordered(caption.content)", 
            // "unordered(conference.name)"
          ],
          customRanking: [
            'desc(video.hasCaptions)',
            'desc(video.publishedDate.timestamp)',
            'desc(video.id)',
            'asc(video.campaignNumber)',
            'asc(video.episodeNumber)',
            'asc(caption.start)',
          ],
        };
      },
    }

    const configName = globals.configName() || "yt-dlp"

    const channels = config.channels
    const pathToSource = config.pathToSource
    console.log("CHANNELS", pathToSource, channels)

    pulse.emit("youtube:crawling:start", { playlists: channels })

    const channelArrayOfVideosArray = await Promise.all(
      channels.map(async channelFolderName => {
        const videos = await this.getVideosFromPlaylist(pathToSource, channelFolderName)

        console.log("")
        console.log("getVideosFromYtdlpFolder VIDEOS", videos.length, channelFolderName)

        await fileutils.writeJson(`./cache/${configName}/youtube-yt-dlp/${channelFolderName}.json`, videos)

        return videos
      })
    )

    pulse.emit("youtube:crawling:end")
    const flat = _.flatten(channelArrayOfVideosArray)
    console.log("getVideosFromYtdlpFolder ALLVIDEOS FLAT", flat.length, flat.slice(0, 2))
    return flat
  }

  /**
   * Get raw information about a YouTube video.
   *
   * @param {String} videoId Id of the video
   * @returns {Object} Raw data about the video
   *
   * Note: This call does not use the API,but a rather obscure, undocumented,
   * endpoint. The data returned itself is in a variety of formats that has to be
   * parsed to make a cohesive object.
   * TOTEST
   **/
  async getRawVideoInfo(videoId) {
    /* eslint-disable camelcase */
    try {
      const options = {
        url: "http://www.youtube.com/get_video_info",
        params: {
          video_id: videoId,
        },
      }

      const results = await axios(options)
      diskLogger.write(`get_video_info/${videoId}.txt`, results.data)

      const params = qs.parse(results.data)
      params.adaptive_fmts = qs.parse(params.adaptive_fmts)
      params.atc = qs.parse(params.atc)
      params.fflags = qs.parse(params.fflags)
      params.player_response = JSON.parse(params.player_response)
      params.url_encoded_fmt_stream_map = qs.parse(params.url_encoded_fmt_stream_map)
      diskLogger.write(`get_video_info/${videoId}.json`, params)
      return params
    } catch (err) {
      pulse.emit("error", err, `getRawVideoInfo/${videoId}`)
      return {}
    }
    /* eslint-enable camelcase */
  }

  /**
   * Get the caption url for a given videoId
   *
   * @param {String} videoId Id of the video
   * @param {String} languageCode Language of the caption
   * @returns {String} Url to get the video caption file
   **/
  async getCaptionsUrl(videoId, languageCode) {
    try {
      const rawData = await this.getRawVideoInfo(videoId)
      const allCaptions = _.get(rawData, "player_response.captions.playerCaptionsTracklistRenderer.captionTracks")

      // No captions
      if (_.isEmpty(allCaptions)) {
        return false
      }

      const manualCaptions = _.reject(allCaptions, caption => _.get(caption, "kind") === "asr")
      const automaticCaptions = _.difference(allCaptions, manualCaptions)

      const matchingCaption = _.find(manualCaptions, { languageCode }) || _.find(automaticCaptions, { languageCode }) || _.first(manualCaptions) || _.first(automaticCaptions)

      return _.get(matchingCaption, "baseUrl")
    } catch (err) {
      pulse.emit("error", err, `getCaptionsUrl(${videoId})`)
      return false
    }
  }

  /**
   * Get captions for a given videoId
   *
   * @param {String} videoId Id of the video
   * @param {String} languageCode Language of the caption
   * @returns {Array} Array of captions
   **/
  async getCaptions(videoId, languageCode) {
    // Get the content of an XML <text> node, which itself can contain
    // HTML-encoded tags
    function getContent($node) {
      return cheerio.load($node.text()).text()
    }

    try {
      const captionUrl = await this.getCaptionsUrl(videoId, languageCode)

      if (!captionUrl) {
        pulse.emit("warning", "Some videos have no captions", `https://youtu.be/${videoId}`)
        return []
      }

      const xml = await axios.get(captionUrl)
      diskLogger.write(`captions/${videoId}.xml`, xml.data)

      const $ = cheerio.load(xml.data, { xmlMode: true })
      const texts = $("text")
      const captions = _.map(texts, (node, index) => {
        // We take nodes two at a time for the content
        const $thisNode = $(node)
        const thisContent = getContent($thisNode)
        const thisStart = _.round($thisNode.attr("start"), 2)
        const thisDuration = parseFloat($thisNode.attr("dur"))

        const $nextNode = $(texts[index + 1])
        const nextContent = getContent($nextNode)
        const nextDuration = parseFloat($nextNode.attr("dur") || 0)

        const content = _.trim(`${thisContent} ${nextContent}`)
        const duration = _.round(thisDuration + nextDuration, 2)

        return {
          content,
          languageCode,
          start: thisStart,
          duration,
        }
      })

      return captions
    } catch (err) {
      pulse.emit("error", err, `getCaptions(${videoId})`)
      return []
    }
  }

  /**
   * Get all videos as configured in the current config
   *
   * Note: You should always call globals.init(configName) before running this
   * method, so it can get all the required data
   *
   * @returns {Array} All videos of the current config
   **/
  async getVideos() {
    const shouldReadFromCache = globals.readFromCache()

    // Get videos either from disk cache or API
    const videos = shouldReadFromCache ? await this.getVideosFromCache() : await this.getVideosFromYtdlpFolder()

    pulse.emit("youtube:videos", { videos })

    return videos
  }
}
