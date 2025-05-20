#' Add checkboxes, radio buttons, or switches to a website
#'
#' Adds a set of checkbox, radio buttons, or switches to a website.
#'
#' @param label Label of the input for the user.
#' @param options A vector of options, the name of a variable from which to pull levels, or either \code{"datasets"}
#' or \code{"variables"} to select names of datasets or variables.
#' @param default A vector of items to check by default (or "all" or "none") if \code{multi} is \code{TRUE}, or
#' the option to select by default.
#' @param display A display version of the options.
#' @param id Unique id of the element to be created.
#' @param ... Additional attributes to set on the element.
#' @param note Text to display as a tooltip for the input.
#' @param variable The name of a variable from which to get levels (overwritten by \code{depends}).
#' @param dataset The name of an included dataset, where \code{variable} should be looked for; only applies when
#' there are multiple datasets with the same variable name.
#' @param depends The id of another input on which the options depend; this will take president over \code{dataset}
#' and \code{variable}, depending on this type of input \code{depends} points to.
#' @param multi Logical; if \code{FALSE}, only one option can be selected at a time, turning the checkboxes into radio
#' buttons.
#' @param as.switch Logical; if \code{TRUE}, displays checkboxes or radio buttons as switches.
#' @examples
#' \dontrun{
#' input_checkbox("Label", c("a", "b", "c"))
#' }
#' @return A character vector of the contents to be added.
#' @seealso For a single switch or checkbox, use \code{\link{input_switch}}.
#' @export

input_checkbox <- function(
  label,
  options,
  default = "all",
  display = options,
  id = label,
  ...,
  note = NULL,
  variable = NULL,
  dataset = NULL,
  depends = NULL,
  multi = TRUE,
  as.switch = FALSE
) {
  if (multi && length(default) == 1) {
    if ((is.logical(default) && default) || default == "all") {
      default <- options
    } else if ((is.logical(default) && !default) || default == "none") {
      default <- NULL
    }
  } else if (!multi && is.character(default)) {
    default <- which(
      (if (default %in% display) display else options) == default
    )
    if (!length(default)) default <- 1
  }
  id <- gsub("\\s", "", id)
  a <- list(...)
  type <- if (multi) "checkbox" else "radio"
  r <- c(
    '<div class="wrapper checkbox-wrapper">',
    paste0(
      "<fieldset",
      if (length(a))
        paste("", paste(names(a), paste0('"', unlist(a), '"'), sep = "=")),
      ">"
    ),
    paste0("<legend>", label, "</legend>"),
    paste0(
      '<div class="auto-input" role="group" data-autoType="',
      type,
      '" id="',
      id,
      '" ',
      if (is.character(options) && length(options) == 1)
        paste0('data-optionSource="', options, '"'),
      if (!is.null(default))
        paste0(' data-default="', paste(default, collapse = ","), '"'),
      if (!is.null(depends)) paste0(' data-depends="', depends, '"'),
      if (!is.null(note)) paste0(' aria-description="', note, '"'),
      if (!is.null(dataset)) paste0(' data-dataset="', dataset, '"'),
      if (!is.null(variable)) paste0(' data-variable="', variable, '"'),
      if (as.switch) paste0(' data-switch="', as.switch, '"'),
      if (length(a))
        unlist(lapply(
          seq_along(a),
          function(i) paste0(" ", names(a)[i], '="', a[[i]], '"')
        )),
      ">"
    ),
    if (length(options) > 1) {
      unlist(
        lapply(seq_along(options), function(i) {
          c(
            paste0(
              '<div class="form-check',
              if (as.switch) " form-switch",
              '">'
            ),
            paste0(
              '<input type="',
              type,
              '" autocomplete="off" class="form-check-input" name="',
              id,
              '_options" id="',
              id,
              "_option",
              i,
              if (as.switch) '" role="switch',
              '" value="',
              options[i],
              '"',
              if ((multi && options[i] %in% default) || i == default)
                " checked",
              ">"
            ),
            paste0(
              '<label class="form-check-label" for="',
              id,
              "_option",
              i,
              '">',
              display[i],
              "</label>"
            ),
            "</div>"
          )
        }),
        use.names = FALSE
      )
    },
    "</div>",
    "</fieldset>",
    "</div>"
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
