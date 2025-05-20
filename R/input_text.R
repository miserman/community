#' Add a text input to a website
#'
#' Adds an direct text input element to a website.
#'
#' @param label Label of the input for the user.
#' @param id Unique ID of the element to be created.
#' @param ... Other attributes to add to the input.
#' @param default Default value of the input, which will appear as a placeholder.
#' @param multiline Logical; if \code{TRUE}, create a \code{textarea} element, instead of an \code{input} element
#' to accept multiple lines of text.
#' @param class Class names to add to the input's list.
#' @param note Text to display as a tooltip for the input or textarea.
#' @param floating_label Logical; if \code{FALSE}, labels are separate from their input elements.
#' @examples
#' \dontrun{
#' input_text("Enter Text:", "entered_text")
#' }
#' @return A character vector of the contents to be added.
#' @export

input_text <- function(
  label,
  id = label,
  ...,
  default = NULL,
  note = NULL,
  multiline = FALSE,
  class = NULL,
  floating_label = TRUE
) {
  id <- gsub("\\s", "", id)
  a <- list(...)
  r <- c(
    paste0(
      '<div class="wrapper text-wrapper',
      if (floating_label) " form-floating",
      '">'
    ),
    if (!floating_label) paste0('<label for="', id, '">', label, "</label>"),
    paste0(
      c(
        "<",
        if (multiline) "textarea" else 'input type="text"',
        ' id="',
        id,
        '"',
        if (!is.null(default)) {
          c(
            ' placeholder="',
            default,
            '"',
            ' value="',
            default,
            '"'
          )
        },
        if (length(a))
          unlist(lapply(
            seq_along(a),
            function(i) paste0(" ", names(a)[i], '="', a[[i]], '"')
          )),
        if (!is.null(note)) c(' aria-description="', note, '"'),
        ' class="form-control auto-input',
        if (!is.null(class)) paste("", class),
        '" data-autoType="intext">',
        if (multiline) "</textarea>",
        if (floating_label) paste0('<label for="', id, '">', label, "</label>")
      ),
      collapse = ""
    ),
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
