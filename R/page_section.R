#' Adds an organizational section to a website
#'
#' Adds a section (such as a row or column) to a website, optionally placing its elements within rows or columns.
#'
#' @param ... Elements to appear in the section.
#' @param type The class of the top-level section; usually either \code{"row"} or \code{"col"};
#' \code{NULL} for no class.
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
#' page_section(
#'   "<p>column</p>",
#'   "<p>row</p>",
#'   type = "row",
#'   wraps = c("col", "row")
#' )
#' }
#' @return A character vector of the content to be added.
#' @export

page_section <- function(
  ...,
  type = "row",
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
  elements <- substitute(...())
  n <- length(elements)
  wraps <- rep_len(wraps, n)
  sizes <- rep_len(sizes, n)
  breakpoints <- rep_len(breakpoints, n)
  conditions <- rep_len(conditions, n)
  ids <- paste0("sec", parts$uid, seq_len(n))
  r <- c(
    paste(
      c(
        "<div",
        if (!is.null(id)) c(' id="', id, '"'),
        if (!is.null(type)) c(' class="', type, '"'),
        ">"
      ),
      collapse = ""
    ),
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
                if (conditions[i] != "") paste0(' id="', ids[i], '"'),
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
    "</div>"
  )
  if (building) {
    caller$content <- c(caller$content, r)
    for (n in names(parts))
      if (n != "content" && n != "uid")
        caller[[n]] <- c(caller[[n]], parts[[n]])
    process_conditions(conditions, ids, caller)
    caller$uid <- parts$uid + 1
  }
  r
}
