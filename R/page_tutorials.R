#' Add a guided tour to a website
#'
#' Adds a set of instructions that will guide a user through a process.
#'
#' Tutorials take over control of the interface to walk the user through some process.
#'
#' @param ... Lists specifying each tutorial, or a single list of such lists:
#' \itemize{
#'   \item \strong{\code{name}}: Short name used for reference (as in links). Taken from
#'     the name of entries if omitted.
#'   \item \strong{\code{title}}: Display title of the tutorial.
#'   \item \strong{\code{description}}: A description of what the tutorial will do.
#'   \item \strong{\code{steps}} (required): A list containing step specifications:
#'   \itemize{
#'     \item \strong{\code{description}}: Text description to accompany the step.
#'     \item \strong{\code{focus}}: Query selector for the element to focus on (e.g., \code{"#input_a"}).
#'     \item \strong{\code{option}}: Name (value) of an option in a dropdown menu to highlight.
#'     \item \strong{\code{before}}: A vector of actions to perform before showing the step, where
#'     names are of input elements, and values are either \code{"click"} to click on the element
#'     (mainly for elements with toggleable menus -- elements that do not accept a value will always
#'     be clicked), \code{"reset"} to reset the input, or a value to set the input to
#'     (e.g., \code{c("input_a" = "a"}). An unnamed actions or values will apply to the \code{focus} element.
#'     If \code{focus} or the named element has options and \code{option} is included, \code{"set"},
#'     will set those options. If a dialogue-like element is open, \code{"close"} will close it.
#'     \item \strong{\code{after}}: A vector of actions to perform after the step has advanced,
#'     before the next step starts (if any).
#'     \item \strong{\code{wait}}: Number of milliseconds to wait before starting the step. Useful
#'     to add time to allow loads or animations to finish; defaults to \code{400}.
#'     \item \strong{\code{time}}: Number of seconds to wait before auto-advancing. If omitted,
#'     will not auto-advance.
#'     \item \strong{\code{disable_continue}}: Logical; if \code{TRUE}, will disable the continue button.
#'   }
#'   \item \strong{\code{reset}}: Logical; if \code{TRUE}, will reset the interface
#'   before starting the tutorial.
#' }
#' @param button Text to show a button to show the tutorials listing menu, or \code{FALSE}
#' to not create a button.
#' @param id Unique ID of the button element to be created.
#' @param class Additional class names to add to the button element.
#' @param note Text to display as a tooltip for the button.
#' @examples
#' page_tutorials(
#'   use_menu = list(
#'     title = "Use Settings Menu",
#'     steps = list(
#'       list(
#'         description = "Click on the settings button.",
#'         focus = "#navbar_menu .nav-item:nth-child(3)",
#'         after = "click"
#'       ),
#'       list(
#'         description = "Locate setting A.",
#'         focus = "setting.a"
#'       )
#'     )
#'   )
#' )
#' @return A character vector of the content to be added.
#' @export

page_tutorials <- function(
  ...,
  button = "Tutorials",
  id = NULL,
  class = NULL,
  note = NULL
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  parts <- new.env()
  attr(parts, "name") <- "community_site_parts"
  tutorials <- list(...)
  if (length(tutorials) == 1) {
    if ("name" %in% names(tutorials)) {
      tutorials <- list(tutorials)
    } else if (is.null(names(tutorials))) {
      tutorials <- unlist(tutorials, recursive = FALSE)
    }
  }
  for (i in seq_along(tutorials)) {
    if (is.null(tutorials[[i]]$name)) {
      tutorials[[i]]$name <- if (is.null(names(tutorials)[i]))
        paste("tutorial", i) else names(tutorials)[i]
    }
    tutorials[[i]]$steps <- lapply(tutorials[[i]]$steps, function(s) {
      if (!is.null(s$before)) s$before <- as.list(s$before)
      if (!is.null(s$after)) s$after <- as.list(s$after)
      s
    })
  }
  names(tutorials) <- vapply(tutorials, "[[", "", "name")
  r <- c(
    '<div class="wrapper button-wrapper">',
    paste0(
      '<button type="button" data-bs-toggle="modal" data-bs-target="#community_tutorials_menu" class="btn',
      if (!is.null(class)) paste("", class),
      '"',
      if (!is.null(id)) paste0(' id="', id, '"'),
      if (!is.null(note)) paste0(' aria-description="', note, '"'),
      ">",
      button,
      "</button>"
    ),
    "</div>"
  )
  if (building) {
    if (is.character(button)) caller$content <- c(caller$content, r)
    caller$tutorials <- c(caller$tutorials, tutorials)
  }
  r
}
