/**
 * Implements several HTML helpers.
 */
class HtmlHelper {
  /**
   * Embeds tbe given text into a span element with selection of Apple system font. The default
   * size is equivalent to a 15pt font on iOS.
   * @param {String} text - The text to fontify
   * @param {String} [size="130%"] - HTML font specification
   * @return {String} Fontified text
   */
  static fontify(text, size = '130%') {
    return `<span style='font-family: --apple-system, HelveticaNeue; font-size: ${size}'>${text}</span>`;
  }
}

module.exports = HtmlHelper;
