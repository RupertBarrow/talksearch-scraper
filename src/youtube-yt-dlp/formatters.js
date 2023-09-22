import _ from "lodash"

import dayjs from "dayjs"
import parseIsoDuration from "parse-iso-duration"

/**
 * Format the statistics as returned by the API into an object
 * @param {Object} data Video data object as received by the API
 * @return {Object} Object containing .views, .likes, .dislikes, .favorites,
 * .comments counts as numbers
 **/

function _formatPopularity(data) {
  const viewCount = _.parseInt(_.get(data, "statistics.viewCount"))
  const likeCount = _.parseInt(_.get(data, "statistics.likeCount"))
  const dislikeCount = _.parseInt(_.get(data, "statistics.dislikeCount"))
  const favoriteCount = _.parseInt(_.get(data, "statistics.favoriteCount"))
  const commentCount = _.parseInt(_.get(data, "statistics.commentCount"))
  return {
    views: viewCount,
    likes: likeCount,
    dislikes: dislikeCount,
    favorites: favoriteCount,
    comments: commentCount,
  }
}

/**
 * Extract hasCaptions and hasManualCaptions from the data received from the
 * API.
 * @param {Object} data Video data object as received by the API
 * @param {Array} captions The array of captions
 * @return {Object} Object containing boolean keys .hasCaptions and
 * .hasManualCaptions
 **/

function _formatCaptions(data, captions) {
  const hasCaptions = captions.length > 0
  const hasManualCaptions = _.get(data, "contentDetails.caption") === "true"
  return { hasCaptions, hasManualCaptions }
}

/**
 * Format the duration as returned by the API into an object
 * @param {Object} data Video data object as received by the API
 * @return {Object} Object containing a .minutes and .seconds keys
 **/

function _formatDuration(data) {
  const durationInSeconds = parseIsoDuration(_.get(data, "contentDetails.duration")) / 1000
  return {
    minutes: Math.floor(durationInSeconds / 60),
    seconds: durationInSeconds % 60,
  }
}

export function formatChannel(data) {
  return {
    id: _.get(data, "snippet.channelId"),
    title: _.get(data, "snippet.channelTitle"),
  }
}

export function formatVideo(data, captions) {
  const videoId = data.id
  const captionsMetadata = _formatCaptions(data, captions)
  const popularity = _formatPopularity(data)
  const duration = _formatDuration(data)
  const publishedDate = dayjs(_.get(data, "snippet.publishedAt")).unix()
  const url = `https://www.youtube.com/watch?v=${videoId}`

  return {
    id: videoId,
    title: _.get(data, "snippet.title"),
    //description: _.get(data, "snippet.description"),
    thumbnails: _.get(data, "snippet.thumbnails"),
    languageCode: _.get(data, "snippet.defaultAudioLanguage"),
    publishedDate,
    popularity,
    duration,
    url,
    ...captionsMetadata,
  }
}
