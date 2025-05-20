#' Adds an organizational panel to a website
#'
#' Adds a panel to a website outside of the main content area.
#'
#' @param title Text to appear in the panel's header area.
#' @param ... Elements to appear in the panel's body area.
#' @param foot Content to appear in the panel's footer area.
#' @param position The side of the screen on which the panel appears; \code{"left"} (default) or \code{"right"}.
#' @param wraps The class of wrapper to place elements in; either \code{"row"}, \code{"col"}, or \code{""}
#' (to not wrap the element). Can specify 1 for every element, or a different class for each element.
#' @param sizes The relative size of each wrapper, between 1 and 12, or \code{"auto"}; default is equal size.
#' @param breakpoints Bootstrap breakpoint of each wrapper; one of \code{""} (extra small), \code{"sm"},
#' \code{"md"}, \code{"lg"}, \code{"xl"}, or \code{"xxl"}.
#' @param conditions A character for each element representing the conditions in which that should be showing
#' (e.g., \code{c("", "input_a == a", "")}); \code{""} means the element's display is not conditional.
#' Adding \code{"lock: "} before the condition will disable inputs rather than hide the element.
#' @param id Unique ID of the section.
#' @details See the \href{https://getbootstrap.com/docs/5.1/layout/grid}{Bootstrap grid documentation}.
#' @examples
#' \dontrun{
#' page_panel(
#'   "<h1>Title</h1>",
#'   "<p>body</p>",
#' )
#' }
#' @return A character vector of the content to be added.
#' @export

page_panel <- function(
  title = "Side Panel",
  ...,
  foot = NULL,
  position = "left",
  wraps = NA,
  sizes = NA,
  breakpoints = NA,
  conditions = "",
  id = NULL
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  parts <- new.env()
  attr(parts, "name") <- "community_site_parts"
  parts$uid <- caller$uid
  pid <- paste0("panel", parts$uid)
  elements <- substitute(...())
  footer <- if (missing(foot)) NULL else substitute(foot)
  n <- length(elements)
  wraps <- rep_len(wraps, n)
  sizes <- rep_len(sizes, n)
  breakpoints <- rep_len(breakpoints, n)
  conditions <- rep_len(conditions, n)
  ids <- paste0("panel", parts$uid, seq_len(n))
  title <- substitute(title)
  r <- c(
    paste0('<div class="card panel panel-', position, '" id="', pid, '">'),
    paste0(
      c('<div class="card-header">', eval(title, parts, caller), "</div>"),
      collapse = ""
    ),
    '<div class="card-body">',
    unlist(
      lapply(seq_len(n), function(i) {
        wrap <- !is.na(wraps[i]) || conditions[i] != ""
        c(
          if (wrap) {
            paste(
              c(
                '<div class="',
                if (is.na(wraps[i])) "" else wraps[i],
                if (!is.na(breakpoints[i])) c("-", breakpoints[i]),
                if (!is.na(sizes[i])) c("-", sizes[i]),
                '"',
                if (conditions[i] != "") c(' id="', ids[i], '"'),
                ">"
              ),
              collapse = ""
            )
          },
          eval(elements[[i]], parts, caller),
          if (wrap) "</div>"
        )
      }),
      use.names = FALSE
    ),
    "</div>",
    if (length(footer)) {
      c(
        '<div class="card-footer">',
        unlist(
          lapply(if (is.list(footer)) footer else list(footer), eval, parts),
          use.names = FALSE
        ),
        "</div>"
      )
    },
    paste0(
      '<button type="button" title="toggle panel" aria-controls="',
      pid,
      '" aria-expanded="true" class="btn panel-toggle">&Verbar;</button>'
    ),
    "</div>"
  )
  if (building) {
    caller$body <- c(caller$body, r)
    for (n in names(parts))
      if (n != "content" && n != "uid")
        caller[[n]] <- c(caller[[n]], parts[[n]])
    process_conditions(conditions, ids, caller)
    caller$uid <- parts$uid + 1
  }
  r
}
