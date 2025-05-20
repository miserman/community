#' Add static text elements to a website.
#'
#' Adds regular text elements to a website.
#'
#' @param text A character vector of text to add. Each entry will be a separate element. Text can include
#' links to be embedded, in the form \code{"[text](url)"}.
#' @param ... Attributes to add to each element.
#' @param tag The tag name of each element.
#' @examples
#' \dontrun{
#' # regular text
#' page_text("text to be added")
#' }
#' @return A character vector of the content to be added.
#' @export

page_text <- function(text, ..., tag = "p") {
  n <- length(text)
  tag <- rep_len(tag, n)
  atr <- lapply(list(...), function(a) rep_len(as.character(a), n))
  r <- unlist(
    lapply(seq_len(n), function(i) {
      txt <- text[i]
      m <- regmatches(txt, gregexpr("\\[.*?\\]\\(.*?\\)", txt))[[1]]
      for (l in m) {
        parts <- strsplit(substr(l, 2, nchar(l) - 1), "](", fixed = TRUE)[[1]]
        txt <- sub(
          l,
          paste0(
            '<a target="_blank" rel="noreferrer" href="',
            parts[2],
            '">',
            parts[1],
            "</a>"
          ),
          txt,
          fixed = TRUE
        )
      }
      paste0(
        "<",
        tag[i],
        if (length(atr))
          paste(
            "",
            paste(
              paste0(names(atr), '="', vapply(atr, "[[", "", i), '"'),
              collapse = " "
            )
          ) else "",
        ">",
        txt,
        "</",
        tag[i],
        ">"
      )
    }),
    use.names = FALSE
  )
  caller <- parent.frame()
  if (
    !is.null(attr(caller, "name")) &&
      attr(caller, "name") == "community_site_parts"
  ) {
    caller$content <- c(caller$content, r)
  }
  r
}
