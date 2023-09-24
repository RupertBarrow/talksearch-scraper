import fileutils from "../fileutils.js"

const NB_SUBTITLES_PER_GROUP = 10
const CONTEXT_SIZE = 1

export class Srt {
  filename

  constructor(videoFolderPath, videoFilename, languageExtension) {
    this.filename = `${videoFolderPath}/${videoFilename}.${languageExtension}`
  }

  /**
   * Return SRT time into seconds, dropping milliseconds
   *
   * @param {*} time
   * @returns
   */
  parseSRTTime(time) {
    const timeParts = time.split(":")

    const secondsParts = timeParts[2].split(",")
    const hours = parseInt(timeParts[0])
    const minutes = parseInt(timeParts[1])
    const seconds = parseInt(secondsParts[0])
    const milliseconds = parseInt(secondsParts[1])

    return hours * 60 * 60 + minutes * 60 + seconds
  }

  parseSrtContents(srtContents) {
    const subs = srtContents.split("\n\n")

    return subs.map(sub => {
      const parts = sub.split("\n")

      const id = parts[0]

      if (id === "") {
        return {}
      } else {
        // Time attributes
        const time = parts[1]
        const [startPart, endPart] = time.split(" --> ")
        const start = this.parseSRTTime(startPart)
        const end = this.parseSRTTime(endPart)

        // Subtitle lines
        let lines = []
        if (parts.length >= 2) {
          parts.shift()
          parts.shift()
          lines = parts.map(part => part.replaceAll("\r", "").trim())
        }

        // prettier-ignore
        const sub = {
          id:    id,
          start: start,
          end:   end,
          dur:   end - start,
          lines: lines,
          text:  lines.join(" ").trim(),
        }

        //console.log("############################################### SUB ")
        //console.log(sub)

        return sub
      }
    })
  }

  /**
   * Convert a SRT JSON object to the JSON format expected by Talksearch
   *
   * @param {Object} subtitleJson SRT JSON object
   * @param {string} youtubeUrlString Youtube URL
   * @returns Talksearch caption object
   */

  static srtJsonToInstantSearch(subtitleJson, youtubeUrlString, timeMarker) {
    const sub = subtitleJson

    // prettier-ignore
    const subtitle = {
          languageCode: "fr",
          position: sub.id,
          start:    sub.start,
          duration: sub.dur,
          content:  sub.text,
          url:      `${youtubeUrlString}&t=${timeMarker}`
        }

    return [timeMarker + sub.dur, subtitle]
  }

  static groupSubs(subs, size, context) {
    const debug = false

    const newSubs = []

    let previousLine = undefined

    for (let i = context; i < subs.length; i += size) {
      const startIndex = i - context
      const endIndex = min(i + size + context, subs.length) - 1

      if (debug) console.log("############################################### SUBS ", endIndex)
      if (debug) console.log(subs.slice(startIndex, endIndex))

      const text = subs
        .slice(startIndex, endIndex + 1)
        .reduce((accumulator, sub) => accumulator.concat(sub.lines), []) // Merge the arrays
        .filter(line => {
          if (line !== "" && line !== previousLine) {
            previousLine = line
            return true
          }
          return false
        })
        .join(" ")
        .trim()

      const isEndOk = subs[endIndex - 1]?.end
      const start = subs[startIndex].start
      const end = isEndOk ? subs[endIndex - 1].end : start
      const duration = isEndOk ? end - start : 0

      if (debug) console.log(start, end)

      const newSub = {
        id: subs[startIndex].id,
        start: start,
        end: end,
        dur: duration,
        text: text,
      }

      newSubs.push(newSub)

      if (debug) console.log("############################################### NEWSUB ")
      if (debug) console.log(newSub)
    }

    return newSubs
  }

  static async getSubs(videoFolderPath, videoFilename, languageExtension) {
    const debug = false

    const srt = new Srt(videoFolderPath, videoFilename, languageExtension)
    const contents = await fileutils.read(`${srt.filename}`)

    const subs = srt.parseSrtContents(contents)
    if (debug) console.log("getSubs() SUBS", subs.slice(0, 24))
    const res = Srt.groupSubs(subs, NB_SUBTITLES_PER_GROUP, CONTEXT_SIZE)
    if (debug) console.log("getSubs() RES", res.slice(0, 2))
    return res
  }
}

function min(a, b) {
  return a < b ? a : b
}
