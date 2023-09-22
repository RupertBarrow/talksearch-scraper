//import youtube from '../src/youtube';
import Youtube from "../src/youtube-yt-dlp.js"
import globals from "../src/globals.js"
import transformer from "../src/transformer.js"
import progress from "../src/progress.js"
import algolia from "../src/algolia.js"
import yargs from "yargs"

/**
 * Parsing command line arguments
 **/
const argv = yargs.usage("Usage: yarn index [config]").command("$0 config", "Index the videos of the specified config").help(false).version(false).argv

;(async () => {
  try {
    globals.init(argv.config)

    // Get all video data from YouTube
    const youtube = new Youtube()
    const videos = await youtube.getVideos()
    progress.displayWarnings()

    // Transform videos in records
    const records = await transformer.run(videos)
    progress.displayWarnings()

    // Push records
    await algolia.run(records)
  } catch (err) {
    console.info(err)
  }
})()
