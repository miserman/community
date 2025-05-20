#' Add dynamic text to a website
#'
#' Adds a textual output based on the current state of input elements.
#'
#' @param text A vector of text to be parsed; see details.
#' @param tag Tag name of the element containing the text.
#' @param id Unique ID of the output element.
#' @param class Class names to add to the output's element.
#' @param condition A conditional statement to decide visibility of the entire output element.
#' @details
#' \describe{
#'   \item{Input References}{\code{text} can include references to inputs by ID within curly brackets
#'     (e.g., \code{"{input_id}").}}
#'   \item{Conditions}{Multiple entries in \code{text} translate to separate elements. Each entry can be
#'     conditioned on a statement within curly brackets following an initial question mark
#'     (e.g., \code{"?{input_a != 1}Input A is not 1"}). If no statement is included after the question mark,
#'     the entry will be conditioned on a referred to input (\code{TRUE} if anything is selected).}
#'   \item{Buttons}{Embedded reset buttons can be specified within square brackets (e.g., \code{"Reset[r input_id]"}).
#'     Text before the brackets will be the button's display text, with multiple words included within parentheses
#'     (e.g., \code{"(Reset Input A)[r input_a]"}). If the text is a reference, this will be the default reset
#'     reference (e.g., \code{"{input_a}[r]"} is the same as \code{"{input_a}[r input_a]"}).}
#' }
#' @examples
#' # text that shows the current value of `input_a`, and resets it on click
#' output_text("Selection: {input_a}[r]")
#'
#' # adds a parenthetical if the value of the input is 0
#' output_text(c("Selection: {input_a}[r]", "?{input_a == 0}(input is zero)"))
#' @return A character vector of the containing element of the text.
#' @export

output_text <- function(
  text,
  tag = "p",
  id = NULL,
  class = NULL,
  condition = NULL
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  if (is.null(id)) id <- paste0("text", caller$uid)
  parsed <- list()
  if (!is.null(names(text))) text <- list(text)
  parse_text <- function(e) {
    res <- list()

    # extracting expressions
    ex <- gsub("^\\{|\\}$", "", regmatches(e, gregexpr("\\{.*?\\}", e))[[1]])

    # extracting conditional expressions
    if (grepl("^\\?", e)) {
      if (grepl("^\\?\\{", e)) {
        res$condition <- parse_rule(ex[1])
        ex <- ex[-1]
        e <- sub("^\\?\\{.*?\\}", "", e)
      } else {
        res$condition <- parse_rule(paste(ex, collapse = " & "))
        e <- gsub("?", "", e, fixed = TRUE)
      }
    }

    # extracting buttons
    if (grepl("[", e, fixed = TRUE)) {
      m <- gregexpr("(?:\\([^)[]*?\\)|\\{[^}[]*?\\}|\\b\\w+?)?\\[.*?\\]", e)
      rb <- regmatches(e, m)[[1]]
      if (length(rb)) {
        res$button <- list()
        for (b in seq_along(rb)) {
          rbb <- rb[b]
          bid <- paste0("b", b)
          res$button[[bid]] <- list(
            text = as.list(sub(
              "}",
              "",
              strsplit(gsub("^\\(|\\)?\\[.*$", "", rbb), "{", fixed = TRUE)[[
                1
              ]],
              fixed = TRUE
            )),
            type = if (grepl("[r", rbb, fixed = TRUE)) "reset" else if (
              grepl("[n", rbb, fixed = TRUE)
            )
              "note" else "update",
            target = strsplit(
              gsub("^[^[]*\\[[^\\s]+\\s?|\\]$", "", rbb, perl = TRUE),
              ","
            )[[1]]
          )
          if (!length(res$button[[bid]]$target)) {
            res$button[[bid]]$target <- strsplit(
              if (grepl("{", rbb, fixed = TRUE)) {
                gsub("^[^{].*\\{|\\}.*$", "", rbb)
              } else {
                sub("\\[.*$", "", rbb)
              },
              ","
            )[[1]]
          }
        }
        regmatches(e, m) <- as.list(paste0(
          "_SPLT_",
          paste0("b", seq_along(rb)),
          "_SPLT_"
        ))
      }
    }

    res$text <- Filter(nchar, strsplit(e, "[{}]|_SPLT_")[[1]])
    res
  }
  for (i in seq_along(text)) {
    e <- text[[i]]
    if (is.null(names(e))) {
      parsed[[i]] <- parse_text(e)
    } else {
      parsed[[i]] <- lapply(seq_along(e), function(i) {
        r <- parse_text(e[[i]])
        r$condition <- parse_rule(names(e)[i])
        r
      })
    }
  }
  r <- paste0(
    c(
      "<",
      tag,
      ' data-autoType="text" id="',
      id,
      '"',
      ' class="auto-output output-text',
      if (!is.null(class)) paste("", class),
      '"',
      "></",
      tag,
      ">"
    ),
    collapse = ""
  )
  if (building) {
    caller$text[[id]] <- c(
      list(text = parsed),
      if (!is.null(condition)) condition <- parse_rule(condition)
    )
    caller$content <- c(caller$content, r)
    caller$uid <- caller$uid + 1
  }
  r
}
