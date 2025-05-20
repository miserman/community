#' Add a number input to a website
#'
#' Adds an direct number input element to a website.
#'
#' @param label Label of the input for the user.
#' @param id Unique ID of the element to be created.
#' @param ... Other attributes to add to the input.
#' @param default Default value of the input, the ID of an input to use as the default, or \code{"min"} or \code{"max"}
#' to default to the current minimum or maximum value.
#' @param variable The name of a variable or ID of a variable selector to get a range from.
#' @param min The smallest allowed value.
#' @param max The largest allowed value.
#' @param step Amount to increase or decrease the value by when changed with arrows.
#' @param type Name of the input's type -- other number-based types like \code{date} might make sense.
#' @param class Class names to add to the input's list.
#' @param note Text to display as a tooltip for the input.
#' @param dataview ID of a \code{\link{input_dataview}}, to use as a source of variables.
#' @param floating_label Logical; if \code{FALSE}, labels are separate from their input elements.
#' @param buttons Logical; if \code{TRUE}, adds increment and decrement buttons to the sides of the input.
#' @param show_range Logical; if \code{TRUE}, adds min and max indicators around the input field.
#' @examples
#' \dontrun{
#' input_text("entered_text", "Enter Text:")
#' }
#' @return A character vector of the contents to be added.
#' @export

input_number <- function(
  label,
  id = label,
  ...,
  default = NULL,
  variable = NULL,
  min = NULL,
  max = NULL,
  step = NULL,
  type = "number",
  class = NULL,
  note = NULL,
  dataview = NULL,
  floating_label = TRUE,
  buttons = FALSE,
  show_range = FALSE
) {
  id <- gsub("\\s", "", id)
  r <- c(
    if (buttons || show_range) '<div class="wrapper number-input-row">',
    if (show_range) {
      paste0(
        '<div><button role="button" label="set value to min" class="text-muted indicator-min"><span>',
        min,
        "</span></button></div>"
      )
    },
    if (buttons)
      '<button role="button" label="decrease value" class="btn number-down">&lt;</button>',
    paste0(
      '<div class="wrapper text-wrapper',
      if (floating_label) " form-floating",
      '">'
    ),
    if (!floating_label) paste0('<label for="', id, '">', label, "</label>"),
    paste0(
      c(
        '<input type="',
        type,
        '"',
        ' id="',
        id,
        '"',
        if (!is.null(default)) paste0(' data-default="', default, '"'),
        if (!is.null(note)) paste0(' aria-description="', note, '"'),
        if (!is.null(variable)) paste0(' data-variable="', variable, '"'),
        if (!is.null(min)) paste0(' min="', min, '"'),
        if (!is.null(max)) paste0(' max="', max, '"'),
        if (!is.null(step)) paste0(' step="', step, '"'),
        if (!is.null(dataview)) paste0(' data-view="', dataview, '"'),
        unlist(list(...)),
        ' class="form-control auto-input',
        if (!is.null(class)) paste("", class),
        '" data-autoType="number">',
        if (floating_label) paste0('<label for="', id, '">', label, "</label>")
      ),
      collapse = ""
    ),
    "</div>",
    if (buttons)
      '<button role="button" label="increase value" class="btn number-up">&gt;</button>',
    if (show_range) {
      paste0(
        '<div><button role="button" label="set value to max" class="text-muted indicator-max"><span>',
        max,
        "</span></button></div>"
      )
    },
    if (buttons || show_range) "</div>"
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
