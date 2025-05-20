#' Adds a legend to a website
#'
#' Adds a legend based on a specified color palette.
#'
#' @param palette Name of an included color palette, or palette selection input;
#' for discrete scales, one of \code{"rdylbu7"}, \code{"orrd7"}, \code{"gnbu7"},
#' \code{"brbg7"}, \code{"puor7"}, \code{"prgn6"}, \code{"reds5"}, \code{"greens5"}, \code{"greys4"}, \code{"paired4"} (from
#' \href{https://colorbrewer2.org}{colorbrewer}); for continuous scales, one of \code{"grey"}, \code{"brown"}, \code{"purple"},
#' \code{"prgn"}, \code{"puor"}, \code{"rbbu"}, \code{"prgn"}, \code{"vik"} (default), or \code{"lajolla"}.
#' @param variable Name of a variable or ID of a variable selector to display values of. Defaults to
#' the \code{y} variable of \code{dataview} if one is specified.
#' @param dataview The ID of an \code{\link{input_dataview}} component.
#' @param id Unique ID of the legend element.
#' @param subto A vector of output IDs to receive hover events from.
#' @param click The ID of an input to set to an entity's ID near the current cursor location on the current scale.
#' @param class Class names to add to the legend element.
#' @param show_na Logical; if \code{FALSE}, does not add the separate section showing the color of missing values.
#' @examples
#' output_legend()
#' @return A character vector of the contents to be added.
#' @export

output_legend <- function(
  palette = "",
  variable = NULL,
  dataview = NULL,
  id = NULL,
  click = NULL,
  subto = NULL,
  class = "",
  show_na = TRUE
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  if (is.null(id)) id <- paste0("legend", caller$uid)
  r <- c(
    if (show_na) {
      c(
        '<div class="legend-wrap">',
        '<div class="legend-na">',
        '<div class="legend-ticks"></div>',
        '<div class="legend-scale"><span class="na"></span></div>',
        '<div class="legend-summary"><p>NA</p></div>',
        "</div>"
      )
    },
    paste(
      c(
        '<div id="',
        id,
        '" data-autoType="legend" class="auto-output legend',
        if (class != "") c(" ", class),
        '"',
        if (!is.null(variable)) paste0(' data-variable="', variable, '"'),
        if (!is.null(dataview)) paste0(' data-view="', dataview, '"'),
        if (!is.null(click)) paste0(' data-click="', click, '"'),
        ">"
      ),
      collapse = ""
    ),
    '<div class="legend-ticks"></div>',
    '<div class="legend-scale"></div>',
    '<div class="legend-summary"></div>',
    "</div>",
    if (show_na) "</div>"
  )
  if (building) {
    caller$legend[[id]] <- list(palette = palette, subto = subto)
    caller$content <- c(caller$content, r)
    caller$uid <- caller$uid + 1
  }
  r
}
