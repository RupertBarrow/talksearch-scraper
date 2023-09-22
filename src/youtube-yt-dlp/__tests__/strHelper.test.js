// SET UP THIS TEST CORRECTLY

import { Srt, selectLines } from "../srtHelper.js"

describe("strHelper", () => {
  describe("groupSubs()", () => {
    /*
    it("should work with subs with no identical lines (with context = 1)", () => {
      let subs = [
        {
          id: 1,
          lines: ["a", "b"],
        },
        {
          id: 2,
          lines: ["c", "d"],
        },
        {
          id: 3,
          lines: ["e", "f"],
        },
        {
          id: 4,
          lines: ["g", "h"],
        },
        {
          id: 5,
          lines: ["i", "j"],
        },
        {
          id: 6,
          lines: ["k", "l"],
        },
        {
          id: 7,
          lines: ["m", "n"],
        },
      ]
      expect(3).toEqual(Srt.groupSubs(subs, 2, 1).length)
      expect([
        { dur: 0, end: undefined, id: 1, start: undefined, text: "a b c d e f g h" },
        { dur: 0, end: undefined, id: 3, start: undefined, text: "e f g h i j k l" },
        { dur: 0, end: undefined, id: 5, start: undefined, text: "i j k l m n" },
      ]).toEqual(Srt.groupSubs(subs, 2, 1))
    }),

    it("should work with subs with no identical lines (with context = 0)", () => {
      let subs = [
        {
          id: 1,
          lines: ["a", "b"],
        },
        {
          id: 2,
          lines: ["c", "d"],
        },
        {
          id: 3,
          lines: ["e", "f"],
        },
        {
          id: 4,
          lines: ["g", "h"],
        },
        {
          id: 5,
          lines: ["i", "j"],
        },
        {
          id: 6,
          lines: ["k", "l"],
        },
        {
          id: 7,
          lines: ["m", "n"],
        },
      ]
      expect(Srt.groupSubs(subs, 2, 0).length).toEqual(4)
      expect(Srt.groupSubs(subs, 2, 0)).toEqual([
        { dur: 0, end: undefined, id: 1, start: undefined, text: "a b c d" },
        { dur: 0, end: undefined, id: 3, start: undefined, text: "e f g h" },
        { dur: 0, end: undefined, id: 5, start: undefined, text: "i j k l" },
        { dur: 0, end: undefined, id: 7, start: undefined, text: "m n" },
      ])
    }),
    */

    it("should work when testing for duplicate lines (with context = 0)", () => {
      let subs = [
        {
          id: "1",
          lines: ["", "well hello again everybody welcome to"],
          text: "well hello again everybody welcome to",
        },
        {
          id: "2",
          lines: ["well hello again everybody welcome to", ""],
          text: "well hello again everybody welcome to",
        },
        {
          id: "3",
          lines: ["well hello again everybody welcome to", "aquarius rising africa too"],
          text: "well hello again everybody welcome to aquarius rising africa too",
        },
      ]
      let previousSub = {
        lines: [undefined, undefined],
      }

      // prettier-ignore
      expect(selectLines(subs, 0, 2, previousSub)).toEqual([
        "well hello again everybody welcome to",
        "aquarius rising africa too"
      ])
    })

    it("should work with identical lines (with context = 0)", () => {
      let subs = [
        {
          id: "1",
          lines: ["", "well hello again everybody welcome to"],
          text: "well hello again everybody welcome to",
        },
        {
          id: "2",
          lines: ["well hello again everybody welcome to", ""],
          text: "well hello again everybody welcome to",
        },
        {
          id: "3",
          lines: ["well hello again everybody welcome to", "aquarius rising africa too"],
          text: "well hello again everybody welcome to aquarius rising africa too",
        },
      ]
      expect(Srt.groupSubs(subs, 3, 0).length).toEqual(1)
      expect(Srt.groupSubs(subs, 3, 0)).toEqual([{ dur: 0, end: undefined, id: "1", start: undefined, text: "well hello again everybody welcome to aquarius rising africa too" }])
    })
  })
})
