#' Add a button toggle group to a website
#'
#' Adds a group of radio-like buttons, where only one can be selected at a time.
#'
#' @param label Label of the input for the user.
#' @param options A vector of options, the name of a variable from which to pull levels, or either \code{"datasets"}
#' or \code{"variables"} to select names of datasets or variables.
#' @param default Which of the options to default to; either its index or value.
#' @param display A display version of the options.
#' @param id Unique id of the element to be created.
#' @param ... Additional attributes to set on the element.
#' @param button_class Class name to add to each label (which appears as the button).
#' @param variable The name of a variable from which to get levels (overwritten by \code{depends}).
#' @param dataset The name of an included dataset, where \code{variable} should be looked for; only applies when
#' there are multiple datasets with the same variable name.
#' @param depends The id of another input on which the options depend; this will take president over \code{dataset}
#' and \code{variable}, depending on this type of input \code{depends} points to.
#' @seealso For a button to set an input or trigger a function, see \code{\link{input_button}}.
#' @examples
#' \dontrun{
#' input_buttongroup()
#' }
#' @return A character vector of the contents to be added.
#' @export

input_buttongroup <- function(
  label,
  options,
  default = 0,
  display = options,
  id = label,
  ...,
  button_class = NULL,
  variable = NULL,
  dataset = NULL,
  depends = NULL
) {
  if (!is.character(options) && is.character(default)) {
    default <- which(
      (if (default %in% display) display else options) == default
    )
  }
  id <- gsub("\\s", "", id)
  a <- list(...)
  r <- c(
    '<div class="wrapper buttongroup-wrapper">',
    paste0('<label for="', id, '">', label, "</label>"),
    paste0(
      '<div class="auto-input btn-group" role="group" data-autoType="buttongroup" id="',
      id,
      '" ',
      if (is.character(options) && length(options) == 1)
        paste0('data-optionSource="', options, '"'),
      if (!is.null(default)) paste0(' data-default="', default, '"'),
      if (!is.null(depends)) paste0(' data-depends="', depends, '"'),
      if (!is.null(dataset)) paste0(' data-dataset="', dataset, '"'),
      if (!is.null(variable)) paste0(' data-variable="', variable, '"'),
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
              '<input type="radio" class="btn-check" autocomplete="off" name="',
              id,
              '_options" id="',
              id,
              "_option",
              i,
              '" value="',
              options[i],
              '"',
              if (i == default) " checked",
              ">"
            ),
            paste0(
              '<label class="btn',
              if (!is.null(button_class)) paste("", button_class),
              '" for="',
              id,
              "_option",
              i,
              '">',
              display[i],
              "</label>"
            )
          )
        }),
        use.names = FALSE
      )
    },
    "</div>",
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
