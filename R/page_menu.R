#' Adds a menu to a website
#'
#' Adds a section to arrange inputs, that can optionally be collapsed, and positioned on any side.
#'
#' @param ... Elements to appear in the menu.
#' @param position A character indicating which side to place the menu on; one of
#' \code{"top"}, \code{"right"}, \code{"bottom"}, or \code{"left"}.
#' @param width Width of the menu, if \code{position} is \code{"left"} or \code{"right"}.
#' @param height Height of the menu, if \code{position} is \code{"top"} or \code{"bottom"}.
#' @param collapsible Logical; if \code{FALSE}, removes the button to open or close the menu.
#' @param default_open Logical; if \code{TRUE}, the menu will start open.
#' @param wraps Logical or character (\code{"row" or "col"}); if \code{FALSE},
#' elements of the menu will not be wrapped in row or column elements.
#' @param sizes The relative size of each wrapper, between 1 and 12, or \code{"auto"}; default is equal size.
#' @param breakpoints Bootstrap breakpoint of each wrapper; one of \code{""} (extra small), \code{"sm"},
#' @param conditions A character for each element representing the conditions in which that should be showing
#' (e.g., \code{c("", "input_a == a", "")}); \code{""} means the element's display is not conditional.
#' Adding \code{"lock: "} before the condition will disable inputs rather than hide the element.
#' @examples
#' \dontrun{
#' page_menu(
#'   input_select("menu item", c("a", "b", "c"))
#' )
#' }
#' @return A character vector of the content to be added.
#' @export

page_menu <- function(
  ...,
  position = "right",
  width = "300px",
  height = NULL,
  collapsible = TRUE,
  default_open = FALSE,
  wraps = TRUE,
  sizes = NA,
  breakpoints = NA,
  conditions = ""
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  parts <- new.env()
  attr(parts, "name") <- "community_site_parts"
  parts$uid <- caller$uid
  elements <- substitute(...(), environment())
  n <- length(elements)
  vertical <- position %in% c("left", "right")
  wraps <- rep_len(
    if (length(wraps) == 1 && !is.character(wraps) && wraps) {
      if (vertical) "row" else "col"
    } else {
      wraps
    },
    n
  )
  sizes <- rep_len(sizes, n)
  breakpoints <- rep_len(breakpoints, n)
  conditions <- rep_len(conditions, n)
  ids <- paste0("menu", parts$uid, seq_len(n))
  parts$uid <- parts$uid + 1
  if (is.numeric(width)) width <- paste0(width, "px")
  if (is.numeric(height)) height <- paste0(height, "px")
  r <- c(
    paste0(
      c(
        '<div data-state="',
        if (default_open) "open" else "closed",
        '" class="menu-wrapper menu-',
        position,
        '"',
        c(
          ' style="',
          position,
          ": ",
          if (default_open) 0 else paste0("-", width),
          "; ",
          if (!is.null(height)) c("; height: ", height),
          '"'
        ),
        ">"
      ),
      collapse = ""
    ),
    paste0(
      '<div class="menu',
      if (vertical) " col" else " row",
      if (!default_open) " hidden",
      " menu-",
      position,
      '">'
    ),
    unlist(
      lapply(seq_len(n), function(i) {
        c(
          if (!is.na(wraps[i])) {
            paste(
              c(
                '<div class="',
                wraps[i],
                if (!is.na(breakpoints[i])) c("-", breakpoints[i]),
                if (!is.na(sizes[i])) c("-", sizes[i]),
                '"',
                if (conditions[i] != "") paste0(' id="', ids[i], '"'),
                ">"
              ),
              collapse = ""
            )
          },
          eval(elements[[i]], parts),
          if (!is.na(wraps[i])) "</div>"
        )
      }),
      use.names = FALSE
    ),
    "</div>",
    if (collapsible)
      paste0(
        '<button type="button" class="menu-toggle" title="',
        position,
        ' menu"></button>'
      ),
    "</div>"
  )
  if (building) {
    caller$body <- c(caller$body, r)
    for (n in names(parts))
      if (n != "content") caller[[n]] <- c(caller[[n]], parts[[n]])
    caller$uid <- parts$uid
    process_conditions(conditions, ids, caller)
  }
  r
}
