#' Add a tooltip-like display to a website
#'
#' Adds an output to display information about a hovered-over or selected data point.
#'
#' @param title Title text, or the source of title text.
#' @param body A list of entries in the info body section, which can be raw text or references to features or
#' data variables.
#' @param row_style A character specifying how rows should be displayed: \code{"table"} (default)
#' to place names and values in separate columns of a table row, or \code{"stack"} to place names over values.
#' Repeats over rows.
#' @param default A list with entries for \code{"title"} and \code{"body"}, which are treated as raw text.
#' @param dataview The ID of a dataview, used for the persistent display.
#' @param variable Name of the variable from which to display variable information and values. If not specified,
#' this will default to the coloring variable of maps and plots, or the y variable of a dataview.
#' @param subto A vector of output IDs to receive hover events from.
#' @param id Unique id of the element.
#' @param variable_info Logical; if \code{TRUE} (default), variable names can be clicked for more information.
#' @param floating Logical; if \code{TRUE}, the information pane will appear next to the cursor.
#' @examples
#' \dontrun{
#' output_info("Initial View", "Hover over plot elements for more information.")
#' }
#' @return A character vector of the content to be added.
#' @export

output_info <- function(
  title = NULL,
  body = NULL,
  row_style = "table",
  default = NULL,
  dataview = NULL,
  variable = NULL,
  subto = NULL,
  id = NULL,
  variable_info = TRUE,
  floating = FALSE
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  if (is.null(id)) id <- paste0("info", caller$uid)
  r <- paste0(
    '<div class="auto-output text-display',
    if (floating) ' floating"' else '"',
    if (!is.null(dataview)) paste0(' data-view="', dataview, '"'),
    ' data-autoType="info" id="',
    id,
    '"></div>'
  )
  row_style <- rep_len(row_style, length(body))
  if (building) {
    caller$content <- c(caller$content, r)
    caller$info[[id]] <- Filter(
      function(e) length(e) > 1 || (length(e) && e != "" && !isFALSE(e)),
      list(
        title = if (is.null(title)) "" else title,
        body = lapply(seq_along(body), function(i) {
          list(
            name = if (is.null(names(body))) "" else names(body)[i],
            value = body[[i]],
            style = row_style[[i]]
          )
        }),
        default = as.list(default),
        floating = floating
      )
    )
    if (!is.null(dataview)) caller$info[[id]]$dataview <- dataview
    if (!is.null(variable)) caller$info[[id]]$variable <- variable
    if (!is.null(subto)) caller$info[[id]]$subto <- subto
    if (variable_info) caller$info[[id]]$variable_info <- variable_info
    caller$uid <- caller$uid + 1
  }
  r
}
